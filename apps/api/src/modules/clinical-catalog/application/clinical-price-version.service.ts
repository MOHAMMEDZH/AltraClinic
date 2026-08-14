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
  publishedAt: Date | null;
  publishedBy: string | null;
  supersededAt: Date | null;
  supersededByVersionId: string | null;
  inactivatedAt: Date | null;
  inactivatedBy: string | null;
};

export type ClinicalPriceLookupDims = {
  pricingUnit: ClinicalPricingUnit;
  currency: string;
  serviceVariantId?: string | null;
  at?: Date;
};

export type CommercialKeyDims = {
  tenantId: string;
  branchId: string | null;
  clinicalServiceId: string;
  pricingUnit: ClinicalPricingUnit;
  currency: string;
  serviceVariantId: string | null;
};

const PRICING_UNITS = new Set<string>(Object.values(ClinicalPricingUnit));
const FAR_FUTURE = new Date('9999-12-31T23:59:59.999Z');

/**
 * Frozen PA-04 Option B PriceVersion scheduling.
 * SSOT: docs/PHASE_48_ARCHITECTURE_FREEZE_AMENDMENT_PA04_PROPOSAL.md
 */
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

  /**
   * Live/historical commercial price resolution (PA-04 Option B).
   *
   * - omit `at` → current live path (actual server now; may reconcile)
   * - supply `at` <= now → historical read-only derivation (no lifecycle mutation)
   * - supply future `at` → validation error
   */
  async lookupActivePrice(
    actor: ClinicalCatalogActorContext,
    clinicalServiceId: string,
    branchId: string | null | undefined,
    dims: ClinicalPriceLookupDims,
  ) {
    const tenantId = this.requireTenantId(actor);
    const commercial = this.normalizeCommercialDims(dims);
    const now = new Date();

    if (dims.at != null) {
      const at = dims.at;
      if (at.getTime() > now.getTime()) {
        throw new ClinicalCatalogValidationError(
          'Historical as-of `at` must be less than or equal to current server time.',
        );
      }
      return this.lookupHistoricalPrice(actor, tenantId, clinicalServiceId, branchId, commercial, at);
    }

    // CURRENT LIVE — actual server now
    if (branchId) {
      await this.assertBranchBelongsToTenant(tenantId, branchId);
      const branchKey: CommercialKeyDims = {
        tenantId,
        branchId,
        clinicalServiceId,
        ...commercial,
      };
      const branchOutcome = await this.resolveCurrentKeyOutcome(actor, branchKey, now);
      if (branchOutcome.kind === 'CURRENT_ACTIVE') {
        return { scope: 'branch' as const, price: branchOutcome.price };
      }
      // CLEAN_NO_CURRENT → tenant fallback allowed (future SCHEDULED / historical / gap)
    }

    const tenantKey: CommercialKeyDims = {
      tenantId,
      branchId: null,
      clinicalServiceId,
      ...commercial,
    };
    const tenantOutcome = await this.resolveCurrentKeyOutcome(actor, tenantKey, now);
    if (tenantOutcome.kind === 'CURRENT_ACTIVE') {
      return { scope: 'tenant' as const, price: tenantOutcome.price };
    }
    throw new ClinicalPriceLookupFailClosedError();
  }

  private async lookupHistoricalPrice(
    actor: ClinicalCatalogActorContext,
    tenantId: string,
    clinicalServiceId: string,
    branchId: string | null | undefined,
    commercial: ReturnType<ClinicalPriceVersionService['normalizeCommercialDims']>,
    at: Date,
  ) {
    if (branchId) {
      await this.assertBranchBelongsToTenant(tenantId, branchId);
      const branchKey: CommercialKeyDims = {
        tenantId,
        branchId,
        clinicalServiceId,
        ...commercial,
      };
      const branchHit = await this.resolveHistoricalCommercialPrice(actor, branchKey, at);
      if (branchHit) {
        return { scope: 'branch' as const, price: branchHit };
      }
    }
    const tenantKey: CommercialKeyDims = {
      tenantId,
      branchId: null,
      clinicalServiceId,
      ...commercial,
    };
    const tenantHit = await this.resolveHistoricalCommercialPrice(actor, tenantKey, at);
    if (tenantHit) {
      return { scope: 'tenant' as const, price: tenantHit };
    }
    throw new ClinicalPriceLookupFailClosedError();
  }

  /**
   * Locked live resolution outcome for one commercial key.
   * CURRENT_ACTIVE | CLEAN_NO_CURRENT | throws on reconcile/invariant failure.
   */
  async resolveCurrentKeyOutcome(
    actor: ClinicalCatalogActorContext,
    key: CommercialKeyDims,
    evaluationTime: Date,
  ): Promise<
    | { kind: 'CURRENT_ACTIVE'; price: PriceRow }
    | { kind: 'CLEAN_NO_CURRENT' }
  > {
    const outcome = await this.prisma.withPlatformBypass(async (client) => {
      await this.lockCommercialKey(client, key);
      await this.reconcileCommercialTimeline(client, key, evaluationTime, actor);
      const actives = await this.loadActiveRows(client, key);
      if (actives.length > 1) {
        await this.auditLog.recordInTransaction(client, {
          tenantId: key.tenantId,
          action: 'clinical_catalog.price.invariant_violation',
          resourceId: key.clinicalServiceId,
          actorId: actor.actorId,
          actorRoles: actor.actorRoles,
          descriptionEn: 'Multiple ACTIVE rows for commercial key',
          descriptionAr: 'صفوف ACTIVE متعددة لنفس المفتاح التجاري',
          details: { count: actives.length, commercialKey: this.commercialLockKey(key) },
        });
        return { kind: 'conflict' as const };
      }
      const valid = actives.filter((row) => this.isIntervalValidAt(row, evaluationTime));
      if (valid.length === 1) {
        return { kind: 'ok' as const, price: valid[0] };
      }
      if (valid.length > 1) {
        return { kind: 'conflict' as const };
      }
      return { kind: 'none' as const };
    });
    if (outcome.kind === 'ok') return { kind: 'CURRENT_ACTIVE', price: outcome.price };
    if (outcome.kind === 'conflict') {
      throw new ClinicalCatalogConflictError(
        'ACTIVE cardinality invariant violated for commercial key.',
        ClinicalCatalogErrorCode.PRICE_OVERLAP,
      );
    }
    return { kind: 'CLEAN_NO_CURRENT' };
  }

  /**
   * Authoritative live resolver: reconcile then return exactly one interval-valid ACTIVE.
   */
  async resolveCurrentCommercialPrice(
    actor: ClinicalCatalogActorContext,
    key: CommercialKeyDims,
    evaluationTime: Date,
  ) {
    const outcome = await this.resolveCurrentKeyOutcome(actor, key, evaluationTime);
    if (outcome.kind === 'CURRENT_ACTIVE') return outcome.price;
    throw new ClinicalPriceLookupFailClosedError();
  }

  /**
   * Historical as-of resolution (T5): READ-ONLY commercial interval derivation.
   * Must not activate, supersede, inactivate, or reconcile.
   */
  async resolveHistoricalCommercialPrice(
    actor: ClinicalCatalogActorContext,
    key: CommercialKeyDims,
    evaluationTime: Date,
  ): Promise<PriceRow | null> {
    void actor;
    const members = await this.prisma.withPlatformBypass(async (client) =>
      (await this.loadPublishedScheduleMembers(client, key)).filter((m) =>
        this.isEffectiveTimelineMember(m),
      ),
    );
    const covering = members.filter((m) => {
      const start = m.effectiveFrom.getTime();
      const end = this.commercialEnd(m, members);
      if (evaluationTime.getTime() < start) return false;
      if (end == null) return true;
      return evaluationTime.getTime() < end.getTime();
    });
    if (covering.length === 1) return covering[0];
    if (covering.length > 1) {
      throw new ClinicalCatalogConflictError(
        'Multiple historical commercial intervals cover evaluationTime.',
        ClinicalCatalogErrorCode.PRICE_OVERLAP,
      );
    }
    return null;
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
      const key = this.keyFromRow(draft);
      await this.lockCommercialKey(client, key);

      const fresh = await client.clinicalServicePriceVersion.findUniqueOrThrow({
        where: { id: priceVersionId },
      });
      if (fresh.status !== 'DRAFT') {
        throw new ClinicalCatalogConflictError('Price version is no longer DRAFT.');
      }

      const now = new Date();
      await this.assertBidirectionalIntervalPublication(client, fresh);

      const isFuture = fresh.effectiveFrom.getTime() > now.getTime();
      if (isFuture) {
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

      // Immediate publish: reconcile expired first (with pending successor for boundary SUPERSEDED), then activate.
      await this.reconcileCommercialTimeline(client, key, now, actor, fresh);

      const overlappingActive = await this.findOverlappingActive(client, fresh);
      for (const active of overlappingActive) {
        if (!(fresh.effectiveFrom.getTime() > active.effectiveFrom.getTime())) {
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
          },
        });
        await this.auditLog.recordInTransaction(client, {
          tenantId,
          action: 'clinical_catalog.price.supersede',
          resourceId: active.id,
          actorId: actor.actorId,
          actorRoles: actor.actorRoles,
          descriptionEn: 'Superseded by immediate publish',
          descriptionAr: 'تم الاستبدال بالنشر الفوري',
          details: { supersededByVersionId: fresh.id },
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
          effectiveEntry: true,
        },
      });

      return published;
    });
  }

  /**
   * Cancel SCHEDULED (never-effective) or withdraw ACTIVE.
   * Due SCHEDULED is reconciled first — cannot retroactively become canceled-never-effective.
   */
  async inactivate(actor: ClinicalCatalogActorContext, priceVersionId: string) {
    const tenantId = this.requireTenantId(actor);
    const version = await this.loadOwnedVersion(tenantId, priceVersionId);
    if (version.status !== 'ACTIVE' && version.status !== 'DRAFT' && version.status !== 'SCHEDULED') {
      throw new ClinicalCatalogValidationError(
        'Only DRAFT, SCHEDULED, or ACTIVE price versions may be inactivated.',
      );
    }

    if (version.status === 'DRAFT') {
      return this.transitionStatus(actor, priceVersionId, 'INACTIVE', {
        inactivatedAt: new Date(),
        inactivatedBy: actor.actorId,
      });
    }

    return this.prisma.withPlatformBypass(async (client) => {
      const key = this.keyFromRow(version);
      await this.lockCommercialKey(client, key);
      const now = new Date();
      const fresh = await client.clinicalServicePriceVersion.findUniqueOrThrow({
        where: { id: priceVersionId },
      });

      if (fresh.status === 'SCHEDULED') {
        if (fresh.effectiveFrom.getTime() <= now.getTime()) {
          await this.reconcileCommercialTimeline(client, key, now, actor);
          const after = await client.clinicalServicePriceVersion.findUniqueOrThrow({
            where: { id: priceVersionId },
          });
          if (after.status === 'SCHEDULED') {
            throw new ClinicalCatalogConflictError(
              'Due scheduled price could not be reconciled for cancellation.',
            );
          }
          if (after.status === 'ACTIVE') {
            return this.inactivateActiveLocked(client, actor, after, now);
          }
          return after;
        }
        const canceled = await client.clinicalServicePriceVersion.update({
          where: { id: priceVersionId },
          data: {
            status: 'INACTIVE',
            inactivatedAt: now,
            inactivatedBy: actor.actorId,
          },
        });
        await this.auditLog.recordInTransaction(client, {
          tenantId,
          action: 'clinical_catalog.price.cancel_scheduled',
          resourceId: canceled.id,
          actorId: actor.actorId,
          actorRoles: actor.actorRoles,
          descriptionEn: 'Canceled scheduled price before effective entry',
          descriptionAr: 'تم إلغاء السعر المجدول قبل دخوله حيز التنفيذ',
          details: { neverEffective: true },
        });
        return canceled;
      }

      if (fresh.status === 'ACTIVE') {
        return this.inactivateActiveLocked(client, actor, fresh, now);
      }

      throw new ClinicalCatalogValidationError('Price version is not cancelable in current state.');
    });
  }

  /**
   * Controlled same-boundary replacement: cancel published never-effective SCHEDULED then publish replacement draft.
   * Unpublished DRAFT→INACTIVE discard is NOT an eligible prior (requires publishedAt evidence).
   * Forbidden once the boundary has passed (now >= effectiveFrom), including canceled-never-effective priors.
   */
  async replaceScheduled(
    actor: ClinicalCatalogActorContext,
    canceledScheduleId: string,
    replacementDraftId: string,
  ) {
    const tenantId = this.requireTenantId(actor);
    const prior = await this.loadOwnedVersion(tenantId, canceledScheduleId);
    const draft = await this.loadOwnedVersion(tenantId, replacementDraftId);
    if (!this.isEligibleControlledReplacePrior(prior)) {
      throw new ClinicalCatalogValidationError(
        'Controlled replace requires a published canceled-before-effective or still-SCHEDULED prior row.',
      );
    }
    if (draft.status !== 'DRAFT') {
      throw new ClinicalCatalogValidationError('Replacement must be DRAFT.');
    }
    if (draft.effectiveFrom.getTime() !== prior.effectiveFrom.getTime()) {
      throw new ClinicalCatalogValidationError('Replacement must reuse the same effectiveFrom boundary.');
    }
    if (this.commercialLockKey(prior) !== this.commercialLockKey(draft)) {
      throw new ClinicalCatalogValidationError('Replacement must share the same commercial key.');
    }

    const result = await this.prisma.withPlatformBypass(async (client) => {
      const key = this.keyFromRow(draft);
      await this.lockCommercialKey(client, key);
      const now = new Date();

      const freshPrior = await client.clinicalServicePriceVersion.findUniqueOrThrow({
        where: { id: canceledScheduleId },
      });

      if (!this.isEligibleControlledReplacePrior(freshPrior)) {
        throw new ClinicalCatalogConflictError('Prior schedule is not eligible for controlled replace.');
      }

      if (freshPrior.status === 'SCHEDULED') {
        if (freshPrior.effectiveFrom.getTime() <= now.getTime()) {
          // Due: reconcile first (committed), then reject retroactive controlled replacement.
          await this.reconcileCommercialTimeline(client, key, now, actor);
          return { kind: 'late_due_rejected' as const };
        }
        await client.clinicalServicePriceVersion.update({
          where: { id: canceledScheduleId },
          data: {
            status: 'INACTIVE',
            inactivatedAt: now,
            inactivatedBy: actor.actorId,
          },
        });
        await this.auditLog.recordInTransaction(client, {
          tenantId,
          action: 'clinical_catalog.price.cancel_scheduled',
          resourceId: canceledScheduleId,
          actorId: actor.actorId,
          actorRoles: actor.actorRoles,
          descriptionEn: 'Canceled schedule for controlled replace',
          descriptionAr: 'تم إلغاء الجدول للاستبدال المنضبط',
          details: { neverEffective: true, replaceWith: replacementDraftId },
        });
      } else if (
        freshPrior.status === 'INACTIVE' &&
        this.isNeverEffective(freshPrior) &&
        freshPrior.publishedAt != null
      ) {
        if (now.getTime() >= freshPrior.effectiveFrom.getTime()) {
          return { kind: 'late_canceled_rejected' as const };
        }
      } else {
        throw new ClinicalCatalogConflictError('Prior schedule is not eligible for controlled replace.');
      }

      const freshDraft = await client.clinicalServicePriceVersion.findUniqueOrThrow({
        where: { id: replacementDraftId },
      });
      if (freshDraft.status !== 'DRAFT') {
        throw new ClinicalCatalogConflictError('Replacement is no longer DRAFT.');
      }
      if (now.getTime() >= freshDraft.effectiveFrom.getTime()) {
        return { kind: 'late_canceled_rejected' as const };
      }
      await this.assertBidirectionalIntervalPublication(client, freshDraft);
      const scheduled = await client.clinicalServicePriceVersion.update({
        where: { id: replacementDraftId },
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
        descriptionEn: 'Scheduled replacement price version',
        descriptionAr: 'تمت جدولة إصدار السعر البديل',
        details: { controlledReplace: true, replaced: canceledScheduleId },
      });
      return { kind: 'ok' as const, scheduled };
    });

    if (result.kind === 'ok') return result.scheduled;
    throw new ClinicalCatalogConflictError(
      result.kind === 'late_due_rejected'
        ? 'Cannot perform controlled same-boundary replacement after the schedule boundary is due.'
        : 'Cannot resurrect a canceled-before-effective boundary after it has passed.',
    );
  }

  /** Background / proactive activator entry — same reconcile primitive as live reads. */
  async activateDueSchedules(limit = 100): Promise<number> {
    const due = await this.prisma.withPlatformBypass((client) =>
      client.clinicalServicePriceVersion.findMany({
        where: {
          status: 'SCHEDULED',
          effectiveFrom: { lte: new Date() },
        },
        take: limit,
        orderBy: { effectiveFrom: 'asc' },
      }),
    );

    const seen = new Set<string>();
    let processed = 0;
    const systemActor: ClinicalCatalogActorContext = {
      actorId: '00000000-0000-4000-8000-000000000001',
      actorRoles: ['system'],
      tenantId: null,
      isPlatform: true,
    };

    for (const row of due) {
      const key = this.commercialLockKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      const dims = this.keyFromRow(row);
      await this.prisma.withPlatformBypass(async (client) => {
        await this.lockCommercialKey(client, dims);
        await this.reconcileCommercialTimeline(client, dims, new Date(), {
          ...systemActor,
          tenantId: row.tenantId,
        });
      });
      processed += 1;
    }
    return processed;
  }

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

  rangesOverlap(
    aFrom: Date,
    aTo: Date | null,
    bFrom: Date,
    bTo: Date | null,
  ): boolean {
    const aEnd = aTo ?? FAR_FUTURE;
    const bEnd = bTo ?? FAR_FUTURE;
    return aFrom < bEnd && bFrom < aEnd;
  }

  /** Frozen historical formula — exported for tests. */
  commercialEnd(
    v: {
      id: string;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      inactivatedAt: Date | null;
      status: ClinicalPriceVersionStatus;
    },
    timelineMembers: Array<{
      id: string;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      inactivatedAt: Date | null;
      status: ClinicalPriceVersionStatus;
    }>,
  ): Date | null {
    const members = timelineMembers
      .filter((m) => this.isEffectiveTimelineMember(m))
      .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());
    const next = members.find((m) => m.effectiveFrom.getTime() > v.effectiveFrom.getTime());
    const bounds: Date[] = [];
    if (v.effectiveTo) bounds.push(v.effectiveTo);
    if (next) bounds.push(next.effectiveFrom);
    if (v.inactivatedAt && v.status === 'INACTIVE' && !this.isNeverEffective(v)) {
      bounds.push(v.inactivatedAt);
    }
    if (bounds.length === 0) {
      return v.status === 'ACTIVE' ? null : null;
    }
    return bounds.reduce((min, d) => (d < min ? d : min));
  }

  isEffectiveTimelineMember(v: {
    effectiveFrom: Date;
    inactivatedAt: Date | null;
    status: ClinicalPriceVersionStatus;
  }): boolean {
    if (v.status === 'ACTIVE' || v.status === 'SUPERSEDED') return true;
    if (v.status === 'INACTIVE' && !this.isNeverEffective(v)) return true;
    return false;
  }

  /** Canceled-before-effective: INACTIVE with inactivatedAt < effectiveFrom. */
  isNeverEffective(v: { effectiveFrom: Date; inactivatedAt: Date | null; status?: string }): boolean {
    if (!v.inactivatedAt) return false;
    return v.inactivatedAt.getTime() < v.effectiveFrom.getTime();
  }

  /**
   * Controlled-replace prior eligibility (FC published schedule cancel/replace).
   * SCHEDULED = published future commitment; INACTIVE-never-effective requires publishedAt evidence
   * (unpublished DRAFT→INACTIVE discard is not eligible).
   */
  isEligibleControlledReplacePrior(v: {
    status: string;
    publishedAt: Date | null;
    effectiveFrom: Date;
    inactivatedAt: Date | null;
  }): boolean {
    if (v.status === 'SCHEDULED') return true;
    return v.status === 'INACTIVE' && this.isNeverEffective(v) && v.publishedAt != null;
  }

  isIntervalValidAt(
    row: { effectiveFrom: Date; effectiveTo: Date | null; status: ClinicalPriceVersionStatus },
    at: Date,
  ): boolean {
    if (row.status !== 'ACTIVE') return false;
    if (row.effectiveFrom.getTime() > at.getTime()) return false;
    if (row.effectiveTo && !(at.getTime() < row.effectiveTo.getTime())) return false;
    return true;
  }

  /**
   * Authoritative reconcile primitive (lock must already be held in the same transaction).
   * @param pendingSuccessor optional row being published in this transaction (still DRAFT) so
   *   explicit effectiveTo == successor.effectiveFrom classifies as SUPERSEDED (FC-01).
   */
  async reconcileCommercialTimeline(
    client: Prisma.TransactionClient,
    key: CommercialKeyDims,
    evaluationTime: Date,
    actor: ClinicalCatalogActorContext,
    pendingSuccessor?: PriceRow | null,
  ): Promise<void> {
    const tenantId = key.tenantId;
    let members = await this.loadPublishedScheduleMembers(client, key);

    // Expire ACTIVE past explicit effectiveTo without successor coverage.
    for (const active of members.filter((m) => m.status === 'ACTIVE')) {
      if (active.effectiveTo && active.effectiveTo.getTime() <= evaluationTime.getTime()) {
        const publishedNext = members
          .filter((m) => this.isEffectiveTimelineMember(m) || m.status === 'SCHEDULED')
          .filter((m) => m.id !== active.id)
          .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime())
          .find((m) => m.effectiveFrom.getTime() >= active.effectiveTo!.getTime());
        const pendingOk =
          pendingSuccessor &&
          pendingSuccessor.id !== active.id &&
          pendingSuccessor.effectiveFrom.getTime() >= active.effectiveTo.getTime()
            ? pendingSuccessor
            : null;
        const next =
          publishedNext && pendingOk
            ? publishedNext.effectiveFrom.getTime() <= pendingOk.effectiveFrom.getTime()
              ? publishedNext
              : pendingOk
            : publishedNext ?? pendingOk;
        if (next && next.effectiveFrom.getTime() === active.effectiveTo.getTime()) {
          await client.clinicalServicePriceVersion.update({
            where: { id: active.id },
            data: {
              status: 'SUPERSEDED',
              supersededAt: evaluationTime,
              supersededByVersionId: next.id,
            },
          });
          await this.auditLog.recordInTransaction(client, {
            tenantId,
            action: 'clinical_catalog.price.supersede',
            resourceId: active.id,
            actorId: actor.actorId,
            actorRoles: actor.actorRoles,
            descriptionEn: 'ACTIVE expired at successor boundary',
            descriptionAr: 'انتهى السعر النشط عند حد الخلف',
            details: { cause: 'successor', commercialEnd: active.effectiveTo.toISOString() },
          });
        } else {
          await client.clinicalServicePriceVersion.update({
            where: { id: active.id },
            data: {
              status: 'INACTIVE',
              inactivatedAt: active.effectiveTo,
              inactivatedBy: actor.actorId,
            },
          });
          await this.auditLog.recordInTransaction(client, {
            tenantId,
            action: 'clinical_catalog.price.inactivate',
            resourceId: active.id,
            actorId: actor.actorId,
            actorRoles: actor.actorRoles,
            descriptionEn: 'ACTIVE expired without successor',
            descriptionAr: 'انتهى السعر النشط دون خلف',
            details: {
              cause: 'explicit_effectiveTo',
              afterEffective: true,
              commercialEnd: active.effectiveTo.toISOString(),
            },
          });
        }
      }
    }

    members = await this.loadPublishedScheduleMembers(client, key);
    const due = members
      .filter((m) => m.status === 'SCHEDULED' && m.effectiveFrom.getTime() <= evaluationTime.getTime())
      .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());

    for (const Vi of due) {
      members = await this.loadPublishedScheduleMembers(client, key);
      const peers = members.filter((m) => m.id !== Vi.id);
      const next = peers
        .filter(
          (m) =>
            m.status === 'SCHEDULED' ||
            m.status === 'ACTIVE' ||
            this.isEffectiveTimelineMember(m),
        )
        .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime())
        .find((m) => m.effectiveFrom.getTime() > Vi.effectiveFrom.getTime());

      const endCandidates: Date[] = [];
      if (Vi.effectiveTo) endCandidates.push(Vi.effectiveTo);
      if (next) endCandidates.push(next.effectiveFrom);
      const commercialEnd =
        endCandidates.length > 0
          ? endCandidates.reduce((min, d) => (d < min ? d : min))
          : null;

      const expired =
        commercialEnd != null && commercialEnd.getTime() <= evaluationTime.getTime();

      if (expired) {
        const successorDriven =
          next != null && next.effectiveFrom.getTime() === commercialEnd!.getTime();
        if (successorDriven) {
          await client.clinicalServicePriceVersion.update({
            where: { id: Vi.id },
            data: {
              status: 'SUPERSEDED',
              publishedAt: Vi.publishedAt ?? evaluationTime,
              publishedBy: Vi.publishedBy ?? actor.actorId,
              supersededAt: evaluationTime,
              supersededByVersionId: next!.id,
            },
          });
          await this.auditLog.recordInTransaction(client, {
            tenantId,
            action: 'clinical_catalog.price.activate',
            resourceId: Vi.id,
            actorId: actor.actorId,
            actorRoles: actor.actorRoles,
            descriptionEn: 'Materialized expired SCHEDULED then SUPERSEDED by successor',
            descriptionAr: 'تمت مادية الجدول المنتهي ثم الاستبدال بالخلف',
            details: {
              effectiveEntry: true,
              terminal: 'SUPERSEDED',
              commercialEnd: commercialEnd!.toISOString(),
            },
          });
        } else {
          await client.clinicalServicePriceVersion.update({
            where: { id: Vi.id },
            data: {
              status: 'INACTIVE',
              publishedAt: Vi.publishedAt ?? evaluationTime,
              publishedBy: Vi.publishedBy ?? actor.actorId,
              inactivatedAt: commercialEnd!,
              inactivatedBy: actor.actorId,
            },
          });
          await this.auditLog.recordInTransaction(client, {
            tenantId,
            action: 'clinical_catalog.price.activate',
            resourceId: Vi.id,
            actorId: actor.actorId,
            actorRoles: actor.actorRoles,
            descriptionEn: 'Materialized expired SCHEDULED then INACTIVE-after-effective',
            descriptionAr: 'تمت مادية الجدول المنتهي ثم الإيقاف بعد الفعالية',
            details: {
              effectiveEntry: true,
              terminal: 'INACTIVE-after-effective',
              commercialEnd: commercialEnd!.toISOString(),
            },
          });
        }
        continue;
      }

      // Vi covers evaluationTime — activate; supersede prior ACTIVE.
      const actives = await this.loadActiveRows(client, key);
      for (const active of actives) {
        if (active.id === Vi.id) continue;
        await client.clinicalServicePriceVersion.update({
          where: { id: active.id },
          data: {
            status: 'SUPERSEDED',
            supersededAt: evaluationTime,
            supersededByVersionId: Vi.id,
          },
        });
        await this.auditLog.recordInTransaction(client, {
          tenantId,
          action: 'clinical_catalog.price.supersede',
          resourceId: active.id,
          actorId: actor.actorId,
          actorRoles: actor.actorRoles,
          descriptionEn: 'Superseded by due schedule activation',
          descriptionAr: 'تم الاستبدال بتفعيل الجدول المستحق',
          details: { supersededByVersionId: Vi.id },
        });
      }

      await client.clinicalServicePriceVersion.update({
        where: { id: Vi.id },
        data: {
          status: 'ACTIVE',
          publishedAt: Vi.publishedAt ?? evaluationTime,
          publishedBy: Vi.publishedBy ?? actor.actorId,
        },
      });
      await this.auditLog.recordInTransaction(client, {
        tenantId,
        action: 'clinical_catalog.price.activate',
        resourceId: Vi.id,
        actorId: actor.actorId,
        actorRoles: actor.actorRoles,
        descriptionEn: 'Activated due SCHEDULED price version',
        descriptionAr: 'تم تفعيل إصدار السعر المجدول المستحق',
        details: { effectiveEntry: true },
      });
    }
  }

  private async inactivateActiveLocked(
    client: Prisma.TransactionClient,
    actor: ClinicalCatalogActorContext,
    fresh: PriceRow,
    now: Date,
  ) {
    const updated = await client.clinicalServicePriceVersion.update({
      where: { id: fresh.id },
      data: {
        status: 'INACTIVE',
        inactivatedAt: now,
        inactivatedBy: actor.actorId,
      },
    });
    await this.auditLog.recordInTransaction(client, {
      tenantId: fresh.tenantId,
      action: 'clinical_catalog.price.inactivate',
      resourceId: updated.id,
      actorId: actor.actorId,
      actorRoles: actor.actorRoles,
      descriptionEn: 'ACTIVE→INACTIVE commercial withdrawal',
      descriptionAr: 'انسحاب تجاري ACTIVE→INACTIVE',
      details: { afterEffective: true, withdrawal: true },
    });
    return updated;
  }

  private async assertBidirectionalIntervalPublication(
    client: Prisma.TransactionClient,
    candidate: PriceRow,
  ) {
    const key = this.keyFromRow(candidate);
    const published = (await this.loadPublishedScheduleMembers(client, key)).filter(
      (m) => m.id !== candidate.id,
    );

    // Unique effectiveFrom among non-canceled published timeline members.
    const blockers = published.filter((m) => !this.isNeverEffective(m));
    if (blockers.some((m) => m.effectiveFrom.getTime() === candidate.effectiveFrom.getTime())) {
      throw new ClinicalCatalogConflictError(
        'Duplicate effectiveFrom for commercial key.',
        ClinicalCatalogErrorCode.PRICE_OVERLAP,
      );
    }

    const previous = blockers
      .filter((m) => m.effectiveFrom.getTime() < candidate.effectiveFrom.getTime())
      .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];
    const next = blockers
      .filter((m) => m.effectiveFrom.getTime() > candidate.effectiveFrom.getTime())
      .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime())[0];

    if (previous?.effectiveTo) {
      if (candidate.effectiveFrom.getTime() < previous.effectiveTo.getTime()) {
        throw new ClinicalCatalogConflictError(
          'Candidate overlaps previous explicit effectiveTo interval.',
          ClinicalCatalogErrorCode.PRICE_OVERLAP,
        );
      }
    }

    if (candidate.effectiveTo && next) {
      if (candidate.effectiveTo.getTime() > next.effectiveFrom.getTime()) {
        throw new ClinicalCatalogConflictError(
          'Candidate explicit effectiveTo crosses next published effectiveFrom.',
          ClinicalCatalogErrorCode.PRICE_OVERLAP,
        );
      }
    }

    // Also reject explicit finite overlaps against any published explicit interval.
    for (const p of blockers) {
      if (!p.effectiveTo && !candidate.effectiveTo) {
        // open vs open with different From — derived ends via successor; allowed if order ok
        continue;
      }
      if (p.effectiveTo || candidate.effectiveTo) {
        const pEnd = p.effectiveTo;
        const cEnd = candidate.effectiveTo;
        // Only enforce EXPLICIT overlap when both have explicit ends, or candidate crosses
        // an explicit peer range. Open predecessor does not block (derived end).
        if (p.effectiveTo) {
          if (
            this.rangesOverlap(
              candidate.effectiveFrom,
              candidate.effectiveTo,
              p.effectiveFrom,
              p.effectiveTo,
            )
          ) {
            // Contiguous equality is not overlap for [From,To) style.
            if (
              candidate.effectiveFrom.getTime() === p.effectiveTo.getTime() ||
              (candidate.effectiveTo &&
                candidate.effectiveTo.getTime() === p.effectiveFrom.getTime())
            ) {
              continue;
            }
            throw new ClinicalCatalogConflictError(
              'Candidate overlaps an already-published explicit interval.',
              ClinicalCatalogErrorCode.PRICE_OVERLAP,
            );
          }
        }
        if (candidate.effectiveTo && !p.effectiveTo) {
          // candidate finite before open peer — if peer starts inside candidate window
          if (
            p.effectiveFrom.getTime() > candidate.effectiveFrom.getTime() &&
            p.effectiveFrom.getTime() < candidate.effectiveTo.getTime()
          ) {
            throw new ClinicalCatalogConflictError(
              'Candidate explicit interval crosses a published future open-ended schedule.',
              ClinicalCatalogErrorCode.PRICE_OVERLAP,
            );
          }
        }
        void cEnd;
        void pEnd;
      }
    }
  }

  private async loadPublishedScheduleMembers(
    client: Prisma.TransactionClient,
    key: CommercialKeyDims,
  ): Promise<PriceRow[]> {
    const rows = (await client.clinicalServicePriceVersion.findMany({
      where: {
        tenantId: key.tenantId,
        branchId: key.branchId,
        clinicalServiceId: key.clinicalServiceId,
        pricingUnit: key.pricingUnit,
        currency: key.currency,
        serviceVariantId: key.serviceVariantId,
        status: { in: ['SCHEDULED', 'ACTIVE', 'SUPERSEDED', 'INACTIVE'] },
      },
      orderBy: { effectiveFrom: 'asc' },
    })) as PriceRow[];
    // Unpublished DRAFT→INACTIVE discards are audit-only; not commercial timeline members.
    return rows.filter((r) => r.status !== 'INACTIVE' || r.publishedAt != null);
  }

  private async loadActiveRows(
    client: Prisma.TransactionClient,
    key: CommercialKeyDims,
  ): Promise<PriceRow[]> {
    return client.clinicalServicePriceVersion.findMany({
      where: {
        tenantId: key.tenantId,
        branchId: key.branchId,
        clinicalServiceId: key.clinicalServiceId,
        pricingUnit: key.pricingUnit,
        currency: key.currency,
        serviceVariantId: key.serviceVariantId,
        status: 'ACTIVE',
      },
    }) as Promise<PriceRow[]>;
  }

  private async lockCommercialKey(client: Prisma.TransactionClient, key: CommercialKeyDims) {
    await client.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      this.commercialLockKey(key),
    );
  }

  private async findOverlappingActive(client: Prisma.TransactionClient, candidate: PriceRow) {
    const actives = await this.loadActiveRows(client, this.keyFromRow(candidate));
    return actives.filter(
      (active) =>
        active.id !== candidate.id &&
        this.rangesOverlap(
          candidate.effectiveFrom,
          candidate.effectiveTo,
          active.effectiveFrom,
          active.effectiveTo,
        ),
    );
  }

  private keyFromRow(row: {
    tenantId: string;
    branchId: string | null;
    clinicalServiceId: string;
    pricingUnit: ClinicalPricingUnit;
    currency: string;
    serviceVariantId: string | null;
  }): CommercialKeyDims {
    return {
      tenantId: row.tenantId,
      branchId: row.branchId,
      clinicalServiceId: row.clinicalServiceId,
      pricingUnit: row.pricingUnit,
      currency: row.currency.toUpperCase(),
      serviceVariantId: row.serviceVariantId,
    };
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
    if (to && (Number.isNaN(to.getTime()) || !(to.getTime() > from.getTime()))) {
      throw new ClinicalCatalogValidationError('effectiveTo must be after effectiveFrom.');
    }
  }

  private async assertBranchBelongsToTenant(tenantId: string, branchId: string) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        branchId,
      )
    ) {
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
