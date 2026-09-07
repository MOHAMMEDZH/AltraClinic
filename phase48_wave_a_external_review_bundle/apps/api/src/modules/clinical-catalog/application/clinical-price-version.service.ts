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

export type ClinicalPriceLookupDims = {
  pricingUnit: ClinicalPricingUnit;
  currency: string;
  serviceVariantId?: string | null;
  at?: Date;
};

const PRICING_UNITS = new Set<string>(Object.values(ClinicalPricingUnit));

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
      /** Explicit scope — never infer from omitted branchId. */
      scope: 'tenant' | 'branch' | 'all';
      branchId?: string;
      status?: ClinicalPriceVersionStatus;
    },
  ) {
    const tenantId = this.requireTenantId(actor);
    const where: Prisma.ClinicalServicePriceVersionWhereInput = {
      tenantId,
      clinicalServiceId: query.clinicalServiceId,
      status: query.status,
    };

    if (query.scope === 'tenant') {
      where.branchId = null;
    } else if (query.scope === 'branch') {
      if (!query.branchId) {
        throw new ClinicalCatalogValidationError('branchId is required when scope=branch.');
      }
      await this.assertBranchBelongsToTenant(tenantId, query.branchId);
      where.branchId = query.branchId;
    } else if (query.scope === 'all') {
      // Administrative all-scopes: no branch filter.
      if (query.branchId) {
        throw new ClinicalCatalogValidationError('branchId must not be set when scope=all.');
      }
    } else {
      throw new ClinicalCatalogValidationError('scope must be tenant|branch|all.');
    }

    return this.prisma.withPlatformBypass((client) =>
      client.clinicalServicePriceVersion.findMany({
        where,
        orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
      }),
    );
  }

  async lookupActivePrice(
    actor: ClinicalCatalogActorContext,
    clinicalServiceId: string,
    branchId: string | null | undefined,
    dims: ClinicalPriceLookupDims,
  ) {
    const tenantId = this.requireTenantId(actor);
    const commercial = this.normalizeCommercialDims(dims);
    const at = dims.at ?? new Date();

    // PA-06: validate branch ownership BEFORE any fallback.
    if (branchId) {
      await this.assertBranchBelongsToTenant(tenantId, branchId);
      const branchPrice = await this.findActiveAtScope(
        tenantId,
        clinicalServiceId,
        branchId,
        commercial,
        at,
      );
      if (branchPrice) {
        return { scope: 'branch' as const, price: branchPrice };
      }
    }

    const tenantPrice = await this.findActiveAtScope(
      tenantId,
      clinicalServiceId,
      null,
      commercial,
      at,
    );
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

    const commercial = this.normalizeCommercialDims({
      pricingUnit: body.pricingUnit ?? 'PER_VISIT',
      currency: body.currency,
      serviceVariantId: body.serviceVariantId ?? null,
    });
    const unitPrice = this.assertNonNegativeMoney(body.unitPrice, 'unitPrice');
    const taxPercent = this.assertTaxPercent(body.taxPercent ?? 0);

    const effectiveFrom = new Date(body.effectiveFrom);
    const effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : null;
    this.assertEffectiveRange(effectiveFrom, effectiveTo);

    return this.prisma.withPlatformBypass(async (client) => {
      const created = await client.clinicalServicePriceVersion.create({
        data: {
          tenantId,
          branchId: body.branchId ?? null,
          clinicalServiceId: body.clinicalServiceId,
          serviceVariantId: commercial.serviceVariantId,
          pricingUnit: commercial.pricingUnit,
          currency: commercial.currency,
          unitPrice: new Decimal(unitPrice),
          taxPercent: new Decimal(taxPercent),
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
          pricingUnit: created.pricingUnit,
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

      const now = new Date();
      const isFuture = fresh.effectiveFrom.getTime() > now.getTime();

      // AR-04 dual invariant:
      // 1) never mutate published commercial fields (including effectiveTo)
      // 2) no two ACTIVE rows may have overlapping effective ranges
      // Future drafts become SCHEDULED (published, non-ACTIVE) until their boundary.
      // Immediate drafts become ACTIVE; prior overlapping ACTIVE are SUPERSEDED
      // (lifecycle metadata only — commercial columns untouched).
      if (isFuture) {
        const scheduleConflict = await this.findScheduleConflicts(client, fresh);
        if (scheduleConflict.length > 0) {
          throw new ClinicalCatalogConflictError(
            'An ACTIVE or SCHEDULED price version conflicts with the requested effectiveFrom.',
            ClinicalCatalogErrorCode.PRICE_OVERLAP,
          );
        }
        const scheduled = await client.clinicalServicePriceVersion.update({
          where: { id: priceVersionId },
          data: {
            status: 'SCHEDULED',
            publishedAt: now,
            publishedBy: actor.actorId,
          },
        });
        await this.auditLog.recordInTransaction(client, {
          tenantId,
          action: 'clinical_catalog.price.schedule',
          resourceId: scheduled.id,
          actorId: actor.actorId,
          actorRoles: actor.actorRoles,
          descriptionEn: 'Scheduled future clinical price version',
          descriptionAr: 'تمت جدولة إصدار سعر سريري مستقبلي',
          details: {
            clinicalServiceId: scheduled.clinicalServiceId,
            reason: reason ?? '',
            effectiveFrom: scheduled.effectiveFrom.toISOString(),
          },
        });
        return scheduled;
      }

      const overlappingActive = await this.findOverlappingActive(client, fresh);
      for (const active of overlappingActive) {
        if (!(fresh.effectiveFrom > active.effectiveFrom)) {
          throw new ClinicalCatalogConflictError(
            'An ACTIVE price version overlaps the requested effective range.',
            ClinicalCatalogErrorCode.PRICE_OVERLAP,
          );
        }
        // Lifecycle only — do not touch commercial fields (unitPrice, effectiveTo, …).
        await client.clinicalServicePriceVersion.update({
          where: { id: active.id },
          data: {
            status: 'SUPERSEDED',
            supersededAt: now,
            supersededByVersionId: fresh.id,
          },
        });
      }

      const stillOverlapping = await this.findOverlappingActive(client, fresh);
      if (stillOverlapping.length > 0) {
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
    if (version.status !== 'ACTIVE' && version.status !== 'DRAFT' && version.status !== 'SCHEDULED') {
      throw new ClinicalCatalogValidationError(
        'Only DRAFT, SCHEDULED, or ACTIVE price versions may be inactivated.',
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
    commercial: {
      pricingUnit: ClinicalPricingUnit;
      currency: string;
      serviceVariantId: string | null;
    },
    at: Date,
  ) {
    // Effective schedule includes ACTIVE plus SCHEDULED (future published) once
    // effectiveFrom <= at. Persisted ACTIVE ranges remain non-overlapping.
    const rows = await this.prisma.withPlatformBypass((client) =>
      client.clinicalServicePriceVersion.findMany({
        where: {
          tenantId,
          clinicalServiceId,
          branchId,
          pricingUnit: commercial.pricingUnit,
          currency: commercial.currency,
          serviceVariantId: commercial.serviceVariantId,
          status: { in: ['ACTIVE', 'SCHEDULED'] },
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

  private async findScheduleConflicts(
    client: Prisma.TransactionClient,
    candidate: PriceRow,
  ) {
    const peers = await client.clinicalServicePriceVersion.findMany({
      where: {
        tenantId: candidate.tenantId,
        branchId: candidate.branchId,
        clinicalServiceId: candidate.clinicalServiceId,
        pricingUnit: candidate.pricingUnit,
        currency: candidate.currency,
        serviceVariantId: candidate.serviceVariantId,
        status: { in: ['ACTIVE', 'SCHEDULED'] },
        id: { not: candidate.id },
        effectiveFrom: candidate.effectiveFrom,
      },
    });
    return peers;
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

  private normalizeCommercialDims(dims: {
    pricingUnit: ClinicalPricingUnit | string;
    currency: string;
    serviceVariantId?: string | null;
  }): {
    pricingUnit: ClinicalPricingUnit;
    currency: string;
    serviceVariantId: string | null;
  } {
    if (!dims.pricingUnit || !PRICING_UNITS.has(String(dims.pricingUnit))) {
      throw new ClinicalCatalogValidationError('pricingUnit is required and must be a valid enum.');
    }
    const currency = String(dims.currency ?? '')
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new ClinicalCatalogValidationError('currency must be a 3-letter ISO code.');
    }
    return {
      pricingUnit: dims.pricingUnit as ClinicalPricingUnit,
      currency,
      serviceVariantId: dims.serviceVariantId ?? null,
    };
  }

  private assertNonNegativeMoney(value: number, field: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new ClinicalCatalogValidationError(`${field} must be a number >= 0.`);
    }
    return value;
  }

  private assertTaxPercent(value: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
      throw new ClinicalCatalogValidationError('taxPercent must be between 0 and 100.');
    }
    return value;
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
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(branchId)) {
      throw new ClinicalCatalogValidationError('branchId must be a UUID.');
    }
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
