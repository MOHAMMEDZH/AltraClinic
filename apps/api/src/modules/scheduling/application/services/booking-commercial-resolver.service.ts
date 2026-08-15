import { Injectable } from '@nestjs/common';
import { ClinicalPricingUnit } from '@prisma/client';
import { ClinicalPriceVersionService } from '../../../clinical-catalog/application/clinical-price-version.service';
import { TenantServiceConfigService } from '../../../clinical-catalog/application/tenant-service-config.service';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import {
  AppointmentSnapshotService,
  ResolvedCanonicalCommercial,
} from './appointment-snapshot.service';

@Injectable()
export class BookingCommercialResolver {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prices: ClinicalPriceVersionService,
    private readonly configs: TenantServiceConfigService,
    private readonly snapshots: AppointmentSnapshotService,
  ) {}

  async resolveCanonical(params: {
    tenantId: string;
    actorId: string;
    actorRoles?: string[];
    clinicalServiceId: string;
    branchId: string | null;
    pricingUnit: ClinicalPricingUnit;
    currency: string;
    quantity?: number;
    commercialReason?: string | null;
  }): Promise<ResolvedCanonicalCommercial> {
    const actor = {
      actorId: params.actorId,
      actorRoles: params.actorRoles ?? ['owner'],
      tenantId: params.tenantId,
    };
    const cfgResult = await this.configs.getEffectiveConfig(
      actor as never,
      params.clinicalServiceId,
      params.branchId,
    );
    const priceLookup = await this.prices.lookupActivePrice(
      actor as never,
      params.clinicalServiceId,
      params.branchId,
      {
        pricingUnit: params.pricingUnit,
        currency: params.currency,
      },
    );
    const price = priceLookup.price;
    const unitPrice = Number(price.unitPrice);
    const taxPercent = Number(price.taxPercent ?? 0);
    this.snapshots.assertZeroAllowed(unitPrice, params.commercialReason);

    const service = await this.prisma.withPlatformBypass((c) =>
      c.canonicalClinicalServiceDefinition.findFirst({
        where: { id: params.clinicalServiceId },
        include: { translations: true },
      }),
    );
    const en =
      service?.translations.find((t) => t.locale.startsWith('en'))?.displayName ??
      service?.stableKey ??
      params.clinicalServiceId;
    const ar =
      service?.translations.find((t) => t.locale.startsWith('ar'))?.displayName ?? en;

    return {
      clinicalServiceId: params.clinicalServiceId,
      stableKey: service?.stableKey ?? params.clinicalServiceId,
      displayNameAr: ar,
      displayNameEn: en,
      tenantServiceConfigurationId: cfgResult.config.id,
      priceVersionId: price.id,
      pricingUnit: params.pricingUnit,
      currency: params.currency,
      unitPrice,
      taxPercent,
      quantity: params.quantity ?? 1,
      commercialReason: params.commercialReason ?? null,
    };
  }
}
