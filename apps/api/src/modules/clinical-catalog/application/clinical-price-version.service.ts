import { Inject, Injectable } from '@nestjs/common';
import { ClinicalPriceVersionStatus, ClinicalPricingUnit, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../infrastructure/prisma.service';
import {
  ClinicalCatalogConflictError,
  ClinicalCatalogErrorCode,
  ClinicalCatalogNotFoundError,
  ClinicalCatalogValidationError,
  ClinicalPriceLookupFailClosedError,
  ClinicalPriceNotFoundError,
} from '../domain/clinical-catalog.errors';
import {
  CLINICAL_CATALOG_AUDIT_LOG,
  ClinicalCatalogAuditLog,
} from './ports/clinical-catalog-audit-log.port';
import type { CreateClinicalPriceDraftDto } from './dto/clinical-catalog.dto';
import type { ClinicalCatalogActorContext } from './clinical-catalog.service';

type PriceRow = {
  id: string;
  tenantId: string;
  branchId: string | null;
  clinicalServiceId: string;
  serviceVariantId: string | null;
  pricingUnit: ClinicalPricingUnit;
  currency: string;
  unitPrice: Decimal;
  taxPercent: Decimal;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  status: ClinicalPriceVersionStatus;
};

@Injectable()
export class ClinicalPriceVersionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLINICAL_CATALOG_AUDIT_LOG)
    private readonly auditLog: ClinicalCatalogAuditLog,
  ) {}

  async listVersions(
    actor: ClinicalCatalogActorContext,
    query: {
      clinicalServiceId?: string;
      branchId?: string;
      status?: ClinicalPriceVersionStatus;
    } = {},
  ) {
    const tenantId = this.requireTenantId(actor);
    return this.prisma.withPlatformBypass((client) =>
      client.clinicalServicePriceVersion.findMany({
        where: {
          tenantId,
          clinicalServiceId: query.clinicalServiceId,
          branchId: query.branchId === undefined ? undefined : query.branchId || null,
          status: query.status,
        },
        orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      }),
    );
  }

  async lookupActivePrice(
    actor: ClinicalCatalogActorContext,
    clinicalServiceId: string,
    branchId?: string | null,
    at: Date = new Date(),
  ) {
    const tenantId = this.requireTenantId(actor);

    if (branchId) {
      const branchPrice = await this.findActiveAtScope(
        tenantId,
        clinicalServiceId,
        branchId,
        at,
      );
      if (branchPrice) {
        return { scope: 'branch' as const, price: branchPrice };
      }
    }

    const tenantPrice = await this.findActiveAtScope(tenantId, clinicalServiceId, null, at);
    if (tenantPrice) {
      return { scope: 'tenant' as const, price: tenantPrice };
    }

    throw new ClinicalPriceLookupFailClosedError();
  }

  async createDraft(actor: ClinicalCatalogActorContext, body: CreateClinicalPriceDraftDto) {
    const tenantId = this.requireTenantId(actor);
    if (body.branchId) {
      await this.assertBranchBelongsToTenant(tenantId, body.branchId);
    }
    await this.assertServiceReadable(tenantId, body.clinicalServiceId);

    const effectiveFrom = new Date(body.effectiveFrom);
    const effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : null;
    this.assertEffectiveRange(effectiveFrom, effectiveTo);

    return this.prisma.withPlatformBypass(async (client) => {
      const created = await client.clinicalServicePriceVersion.create({
        data: {
          tenantId,
          branchId: body.branchId ?? null,
          clinicalServiceId: body.clinicalServiceId,
          serviceVariantId: body.serviceVariantId ?? null,
          pricingUnit: body.pricingUnit ?? 'PER_VISIT',
          currency: body.currency.trim().toUpperCase(),
          unitPrice: new Decimal(body.unitPrice),
          taxPercent: new Decimal(body.taxPercent ?? 0),
          effectiveFrom,
          effectiveTo,
          status: 'DRAFT',
        },
      });

      await this.auditLog.recordInTransaction(client, {
        tenantId,
        action: 'clinical_catalog.price.create_draft',
        resourceId: created.id,
        actorId: actor.actorId,
        actorRoles: actor.actorRoles,
        descriptionEn: 'Created clinical price draft',
        descriptionAr: 'تم إنشاء مسودة سعر سريري',
        details: {
          clinicalServiceId: body.clinicalServiceId,
          currency: created.currency,
        },
      });

      return created;
    });
  }

  async publish(
    actor: ClinicalCatalogActorContext,
    priceVersionId: string,
    reason?: string | null,
  ) {
    const tenantId = this.requireTenantId(actor);
    const draft = await this.loadOwnedVersion(tenantId, priceVersionId);

    if (draft.status !== 'DRAFT') {
      throw new ClinicalCatalogValidationError(
        'Only DRAFT price versions may be published.',
        ClinicalCatalogErrorCode.APPEND_ONLY_VIOLATION,
      );
    }

    return this.prisma.withPlatformBypass(async (client) => {
      await client.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext($1))`,
        this.commercialLockKey(draft),
      );

      const fresh = await client.clinicalServicePriceVersion.findUniqueOrThrow({
        where: { id: priceVersionId },
      });
      if (fresh.status !== 'DRAFT') {
        throw new ClinicalCatalogConflictError('Price version is no longer DRAFT.');
      }

      // Same commercial key: close prior ACTIVE rows, then fail closed if any
      // overlapping ACTIVE would still remain (race / non-replaceable conflict).
      const toSupersede = await client.clinicalServicePriceVersion.findMany({
        where: {
          tenantId: fresh.tenantId,
          branchId: fresh.branchId,
          clinicalServiceId: fresh.clinicalServiceId,
          pricingUnit: fresh.pricingUnit,
          currency: fresh.currency,
          serviceVariantId: fresh.serviceVariantId,
          status: 'ACTIVE',
        },
      });

      const now = new Date();
      for (const active of toSupersede) {
        if (
          !this.rangesOverlap(
            fresh.effectiveFrom,
            fresh.effectiveTo,
            active.effectiveFrom,
            active.effectiveTo,
          )
        ) {
          continue;
        }
        // Closing at fresh.effectiveFrom must leave a valid prior range.
        if (!(fresh.effectiveFrom > active.effectiveFrom)) {
          throw new ClinicalCatalogConflictError(
            'An ACTIVE price version overlaps the requested effective range.',
            ClinicalCatalogErrorCode.PRICE_OVERLAP,
          );
        }
        await client.clinicalServicePriceVersion.update({
          where: { id: active.id },
          data: {
            status: 'SUPERSEDED',
            supersededAt: now,
            supersededByVersionId: fresh.id,
            effectiveTo: fresh.effectiveFrom,
          },
        });
      }

      const overlapping = await this.findOverlappingActive(client, fresh);
      if (overlapping.length > 0) {
        throw new ClinicalCatalogConflictError(
          'An ACTIVE price version overlaps the requested effective range.',
          ClinicalCatalogErrorCode.PRICE_OVERLAP,
        );
      }

      const published = await client.clinicalServicePriceVersion.update({
        where: { id: priceVersionId },
        data: {
          status: 'ACTIVE',
          publishedAt: now,
          publishedBy: actor.actorId,
        },
      });

      await this.auditLog.recordInTransaction(client, {
        tenantId,
        action: 'clinical_catalog.price.publish',
        resourceId: published.id,
        actorId: actor.actorId,
        actorRoles: actor.actorRoles,
        descriptionEn: 'Published clinical price version',
        descriptionAr: 'تم نشر إصدار السعر السريري',
        details: {
          clinicalServiceId: published.clinicalServiceId,
          reason: reason ?? '',
        },
      });

      return published;
    });
  }

  async supersede(actor: ClinicalCatalogActorContext, priceVersionId: string) {
    const tenantId = this.requireTenantId(actor);
    const version = await this.loadOwnedVersion(tenantId, priceVersionId);
    if (version.status !== 'ACTIVE') {
      throw new ClinicalCatalogValidationError('Only ACTIVE versions may be superseded.');
    }

    return this.transitionStatus(actor, priceVersionId, 'SUPERSEDED', {
      supersededAt: new Date(),
    });
  }

  async inactivate(actor: ClinicalCatalogActorContext, priceVersionId: string) {
    const tenantId = this.requireTenantId(actor);
    const version = await this.loadOwnedVersion(tenantId, priceVersionId);
    if (version.status !== 'ACTIVE' && version.status !== 'DRAFT') {
      throw new ClinicalCatalogValidationError(
        'Only DRAFT or ACTIVE price versions may be inactivated.',
      );
    }

    return this.transitionStatus(actor, priceVersionId, 'INACTIVE', {
      inactivatedAt: new Date(),
      inactivatedBy: actor.actorId,
    });
  }

  /** Exported for unit tests — deterministic commercial lock key. */
  commercialLockKey(row: {
    tenantId: string;
    branchId: string | null;
    clinicalServiceId: string;
    pricingUnit: ClinicalPricingUnit;
    currency: string;
    serviceVariantId: string | null;
  }): string {
    return [
      'clinical-price',
      row.tenantId,
      row.branchId ?? 'default',
      row.clinicalServiceId,
      row.pricingUnit,
      row.currency.toUpperCase(),
      row.serviceVariantId ?? '',
    ].join('|');
  }

  /** Exported for unit tests — overlap detection between effective ranges. */
  rangesOverlap(
    aFrom: Date,
    aTo: Date | null,
    bFrom: Date,
    bTo: Date | null,
  ): boolean {
    const aEnd = aTo ?? new Date('9999-12-31T23:59:59.999Z');
    const bEnd = bTo ?? new Date('9999-12-31T23:59:59.999Z');
    return aFrom < bEnd && bFrom < aEnd;
  }

  private async transitionStatus(
    actor: ClinicalCatalogActorContext,
    priceVersionId: string,
    status: ClinicalPriceVersionStatus,
    extra: Prisma.ClinicalServicePriceVersionUpdateInput,
  ) {
    const tenantId = this.requireTenantId(actor);
    await this.loadOwnedVersion(tenantId, priceVersionId);

    return this.prisma.withPlatformBypass(async (client) => {
      const updated = await client.clinicalServicePriceVersion.update({
        where: { id: priceVersionId },
        data: { status, ...extra },
      });

      await this.auditLog.recordInTransaction(client, {
        tenantId,
        action: `clinical_catalog.price.${status.toLowerCase()}`,
        resourceId: updated.id,
        actorId: actor.actorId,
        actorRoles: actor.actorRoles,
        descriptionEn: `Clinical price version → ${status}`,
        descriptionAr: `إصدار السعر السريري → ${status}`,
      });

      return updated;
    });
  }

  private async findActiveAtScope(
    tenantId: string,
    clinicalServiceId: string,
    branchId: string | null,
    at: Date,
  ) {
    const rows = await this.prisma.withPlatformBypass((client) =>
      client.clinicalServicePriceVersion.findMany({
        where: {
          tenantId,
          clinicalServiceId,
          branchId,
          status: 'ACTIVE',
          effectiveFrom: { lte: at },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
        },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
      }),
    );
    return rows[0] ?? null;
  }

  private async findOverlappingActive(
    client: Prisma.TransactionClient,
    candidate: PriceRow,
  ) {
    const actives = await client.clinicalServicePriceVersion.findMany({
      where: {
        tenantId: candidate.tenantId,
        branchId: candidate.branchId,
        clinicalServiceId: candidate.clinicalServiceId,
        pricingUnit: candidate.pricingUnit,
        currency: candidate.currency,
        serviceVariantId: candidate.serviceVariantId,
        status: 'ACTIVE',
        id: { not: candidate.id },
      },
    });

    return actives.filter((active) =>
      this.rangesOverlap(
        candidate.effectiveFrom,
        candidate.effectiveTo,
        active.effectiveFrom,
        active.effectiveTo,
      ),
    );
  }

  private async loadOwnedVersion(tenantId: string, priceVersionId: string) {
    const row = await this.prisma.withPlatformBypass((client) =>
      client.clinicalServicePriceVersion.findFirst({
        where: { id: priceVersionId, tenantId },
      }),
    );
    if (!row) {
      throw new ClinicalPriceNotFoundError();
    }
    return row;
  }

  private requireTenantId(actor: ClinicalCatalogActorContext): string {
    if (!actor.tenantId) {
      throw new ClinicalCatalogValidationError('Tenant context required.');
    }
    return actor.tenantId;
  }

  private assertEffectiveRange(from: Date, to: Date | null) {
    if (Number.isNaN(from.getTime())) {
      throw new ClinicalCatalogValidationError('effectiveFrom is invalid.');
    }
    if (to && (Number.isNaN(to.getTime()) || to <= from)) {
      throw new ClinicalCatalogValidationError('effectiveTo must be after effectiveFrom.');
    }
  }

  private async assertBranchBelongsToTenant(tenantId: string, branchId: string) {
    const branch = await this.prisma.withPlatformBypass((client) =>
      client.branch.findFirst({
        where: { id: branchId, tenantId, deletedAt: null },
        select: { id: true },
      }),
    );
    if (!branch) {
      throw new ClinicalCatalogValidationError(
        'Branch must belong to tenant.',
        ClinicalCatalogErrorCode.BRANCH_TENANT_MISMATCH,
      );
    }
  }

  private async assertServiceReadable(tenantId: string, clinicalServiceId: string) {
    const service = await this.prisma.withPlatformBypass((client) =>
      client.canonicalClinicalServiceDefinition.findUnique({
        where: { id: clinicalServiceId },
        select: { id: true, provenance: true, tenantId: true },
      }),
    );
    if (!service) {
      throw new ClinicalCatalogNotFoundError();
    }
    if (service.provenance === 'TENANT_CUSTOM' && service.tenantId !== tenantId) {
      throw new ClinicalCatalogValidationError(
        'Cross-tenant clinical service access denied.',
        ClinicalCatalogErrorCode.TENANT_ISOLATION,
      );
    }
  }
}
