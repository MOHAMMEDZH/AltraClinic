import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../infrastructure/prisma.service';
import {
  KNOWN_SCHEDULING_IDS,
  SCHEDULING_CANONICAL_SEED,
  SCHEDULING_CANONICAL_SOURCE_SYSTEM,
  findSchedulingSeedById,
} from '../domain/scheduling-seed.inventory';

export interface WaveABackfillSummary {
  canonicalCreated: number;
  canonicalSkipped: number;
  serviceMappingsCreated: number;
  serviceMappingsSkipped: number;
  tenantConfigsCreated: number;
  priceVersionsCreated: number;
  priceMappingsMapped: number;
  priceMappingsLegacyUnmapped: number;
}

@Injectable()
export class WaveABackfillService {
  private readonly logger = new Logger(WaveABackfillService.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(): Promise<WaveABackfillSummary> {
    const summary: WaveABackfillSummary = {
      canonicalCreated: 0,
      canonicalSkipped: 0,
      serviceMappingsCreated: 0,
      serviceMappingsSkipped: 0,
      tenantConfigsCreated: 0,
      priceVersionsCreated: 0,
      priceMappingsMapped: 0,
      priceMappingsLegacyUnmapped: 0,
    };

    await this.prisma.withPlatformBypass(async (client) => {
      const stableKeyToServiceId = new Map<string, string>();

      for (const seed of SCHEDULING_CANONICAL_SEED) {
        let service = await client.canonicalClinicalServiceDefinition.findUnique({
          where: { stableKey: seed.stableKey },
        });

        if (!service) {
          service = await client.canonicalClinicalServiceDefinition.create({
            data: {
              tenantId: null,
              provenance: 'SYSTEM_CANONICAL',
              stableKey: seed.stableKey,
              domain: 'GENERAL',
              lifecycle: 'PUBLISHED',
              defaultDurationMin: seed.defaultDurationMin,
              publishedAt: new Date(),
              translations: {
                create: [
                  { locale: 'en', displayName: seed.displayNameEn },
                  { locale: 'ar', displayName: seed.displayNameAr },
                ],
              },
            },
          });
          summary.canonicalCreated += 1;
          this.logger.log(`Seeded SYSTEM_CANONICAL ${seed.stableKey}`);
        } else {
          summary.canonicalSkipped += 1;
        }

        stableKeyToServiceId.set(seed.stableKey, service.id);

        const existingMapping = await client.legacyClinicalServiceMapping.findFirst({
          where: {
            tenantId: null,
            sourceSystem: SCHEDULING_CANONICAL_SOURCE_SYSTEM,
            sourceCode: seed.schedulingId,
          },
        });

        if (!existingMapping) {
          await client.legacyClinicalServiceMapping.create({
            data: {
              tenantId: null,
              sourceSystem: SCHEDULING_CANONICAL_SOURCE_SYSTEM,
              sourceCode: seed.schedulingId,
              sourceLabelEn: seed.displayNameEn,
              sourceLabelAr: seed.displayNameAr,
              status: 'MAPPED',
              clinicalServiceId: service.id,
              decisionNote: 'Seeded from scheduling.service_type keys (Wave A)',
              decidedAt: new Date(),
            },
          });
          summary.serviceMappingsCreated += 1;
        } else {
          summary.serviceMappingsSkipped += 1;
        }
      }

      const servicePrices = await client.servicePrice.findMany({
        orderBy: [{ tenantId: 'asc' }, { serviceCode: 'asc' }],
      });

      for (const row of servicePrices) {
        const existingPriceMapping = await client.legacyClinicalPriceMapping.findUnique({
          where: { servicePriceId: row.id },
        });
        if (existingPriceMapping) {
          continue;
        }

        const seed = findSchedulingSeedById(row.serviceCode);
        if (!seed || !KNOWN_SCHEDULING_IDS.has(row.serviceCode)) {
          await client.legacyClinicalPriceMapping.create({
            data: {
              tenantId: row.tenantId,
              servicePriceId: row.id,
              status: 'LEGACY_UNMAPPED',
              decisionNote: 'No deterministic scheduling.service_type match (Wave A)',
              decidedAt: new Date(),
            },
          });
          summary.priceMappingsLegacyUnmapped += 1;
          continue;
        }

        const clinicalServiceId = stableKeyToServiceId.get(seed.stableKey);
        if (!clinicalServiceId) {
          await client.legacyClinicalPriceMapping.create({
            data: {
              tenantId: row.tenantId,
              servicePriceId: row.id,
              status: 'LEGACY_UNMAPPED',
              decisionNote: 'Canonical seed missing unexpectedly',
              decidedAt: new Date(),
            },
          });
          summary.priceMappingsLegacyUnmapped += 1;
          continue;
        }

        const existingConfig = await client.tenantServiceConfiguration.findFirst({
          where: {
            tenantId: row.tenantId,
            clinicalServiceId,
            branchId: null,
          },
        });
        if (!existingConfig) {
          await client.tenantServiceConfiguration.create({
            data: {
              tenantId: row.tenantId,
              clinicalServiceId,
              branchId: null,
              enabled: row.isActive,
              defaultDurationOverride: seed.defaultDurationMin,
            },
          });
          summary.tenantConfigsCreated += 1;
        }

        const effectiveFrom = row.createdAt ?? new Date();
        const existingActive = await client.clinicalServicePriceVersion.findFirst({
          where: {
            tenantId: row.tenantId,
            clinicalServiceId,
            branchId: null,
            status: 'ACTIVE',
            currency: row.currency,
            pricingUnit: 'PER_VISIT',
          },
        });

        let priceVersionId: string | null = existingActive?.id ?? null;
        if (!existingActive) {
          const createdPrice = await client.clinicalServicePriceVersion.create({
            data: {
              tenantId: row.tenantId,
              branchId: null,
              clinicalServiceId,
              pricingUnit: 'PER_VISIT',
              currency: row.currency,
              unitPrice: new Decimal(row.unitPrice),
              taxPercent: new Decimal(row.taxPercent),
              effectiveFrom,
              status: row.isActive ? 'ACTIVE' : 'INACTIVE',
              publishedAt: row.isActive ? effectiveFrom : null,
            },
          });
          priceVersionId = createdPrice.id;
          summary.priceVersionsCreated += 1;
        }

        await client.legacyClinicalPriceMapping.create({
          data: {
            tenantId: row.tenantId,
            servicePriceId: row.id,
            status: 'MAPPED',
            clinicalServiceId,
            priceVersionId,
            decisionNote: 'Mapped from ServicePrice.serviceCode scheduling key (Wave A)',
            decidedAt: new Date(),
          },
        });
        summary.priceMappingsMapped += 1;
      }
    });

    return summary;
  }
}
