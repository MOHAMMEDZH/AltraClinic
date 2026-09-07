import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  COMMISSION_FORMULA_VERSION,
  DEFAULT_PERIOD_TIMEZONE,
  SALES_COMMISSION_AUDIT_ACTIONS,
  SALES_COMMISSION_AUDIT_RESOURCE_TYPE,
  SALES_COMMISSION_OPERATIONS,
  SALES_PRODUCTIVITY_PERMISSIONS,
  isSalesProductivityFailureInjectionActive,
} from '../platform-sales-productivity.constants';
import { utcMonthPeriod } from '../domain/period.util';
import {
  SalesProductivityConflictError,
  SalesProductivityError,
  SalesProductivityForbiddenError,
  SalesProductivityNotFoundError,
  SalesProductivityValidationError,
} from '../domain/sales-productivity.errors';
import type {
  CommissionPaidStatus,
  CommissionReviewStatus,
  CommissionSnapshotDto,
  CommissionSnapshotStatus,
} from '../domain/sales-productivity.types';
import { CommissionAuditLog } from './commission-audit.log';
import {
  CommissionDurableIdempotencyService,
  CommissionIdempotencyEquivalentRaceLostError,
  type CommissionActionResult,
} from './commission-durable-idempotency.service';
import {
  ProductivityMetricsService,
  metricsToJson,
} from './productivity-metrics.service';
import {
  assertRepresentativeInScope,
  resolveProductivityVisibility,
  scopedRepresentativeIds,
} from './productivity-visibility';

function toDto(row: {
  id: string;
  representativeId: string;
  periodKey: string;
  periodTimezone: string;
  periodStart: Date;
  periodEnd: Date;
  sourceCutoffAt: Date;
  formulaVersion: string;
  calculationStatus: string;
  ruleReference: string | null;
  computedAmount: Prisma.Decimal | null;
  metricsJson: Prisma.JsonValue;
  planVersionAttributionJson: Prisma.JsonValue;
  addOnAttributionJson: Prisma.JsonValue;
  completenessJson: Prisma.JsonValue;
  reconciliationJson: Prisma.JsonValue | null;
  reviewStatus: string;
  paidStatus: string;
  paidReason: string | null;
  paidReference: string | null;
  paidAt: Date | null;
  paidByPlatformUserId: string | null;
  status: string;
  supersedesSnapshotId: string | null;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
  finalizedAt: Date | null;
}): CommissionSnapshotDto {
  return {
    id: row.id,
    representativeId: row.representativeId,
    periodKey: row.periodKey,
    periodTimezone: row.periodTimezone,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    sourceCutoffAt: row.sourceCutoffAt.toISOString(),
    formulaVersion: row.formulaVersion,
    calculationStatus: 'UNCONFIGURED',
    ruleReference: row.ruleReference,
    computedAmount: null,
    metrics: (row.metricsJson ?? {}) as Record<string, unknown>,
    planVersionAttribution: (row.planVersionAttributionJson ?? []) as unknown as CommissionSnapshotDto['planVersionAttribution'],
    addOnAttribution: (row.addOnAttributionJson ?? []) as unknown as CommissionSnapshotDto['addOnAttribution'],
    completeness: (row.completenessJson ?? {
      metrics: {},
      period_source_completeness: 'UNAVAILABLE',
      reporting_completeness: 'UNAVAILABLE',
    }) as unknown as CommissionSnapshotDto['completeness'],
    reconciliation: (row.reconciliationJson as Record<string, unknown> | null) ?? null,
    reviewStatus: row.reviewStatus as CommissionReviewStatus,
    paidStatus: row.paidStatus as CommissionPaidStatus,
    paidReason: row.paidReason,
    paidReference: row.paidReference,
    paidAt: row.paidAt?.toISOString() ?? null,
    paidByPlatformUserId: row.paidByPlatformUserId,
    status: row.status as CommissionSnapshotStatus,
    supersedesSnapshotId: row.supersedesSnapshotId,
    rowVersion: row.rowVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    finalizedAt: row.finalizedAt?.toISOString() ?? null,
  };
}

/**
 * Flexible Step 26 — commission snapshot generate / get / list / review / markPaid.
 * markPaid mutates only snapshot paid* fields — never Subscription/Tenant/Entitlement.
 */
@Injectable()
export class CommissionSnapshotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: ProductivityMetricsService,
    private readonly idempotency: CommissionDurableIdempotencyService,
    private readonly audit: CommissionAuditLog,
  ) {}

  private actorRoles(claims: JwtClaimsVO): string[] {
    const roles = (claims.roles as unknown as string[]) ?? [];
    return roles.length > 0 ? roles : ['platform'];
  }

  private assertPlatformPrincipal(user: JwtClaimsVO): void {
    if (user.principalType !== 'platform' || user.sessionClass !== 'platform') {
      throw new SalesProductivityForbiddenError('Clinic principals are denied.');
    }
  }

  async getById(
    user: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
  ): Promise<CommissionSnapshotDto> {
    this.assertPlatformPrincipal(user);
    return this.prisma.withPlatformBypass(async (client) => {
      const scope = await resolveProductivityVisibility(client, user.sub, perms, 'snapshot');
      const row = await client.platformSalesCommissionSnapshot.findUnique({ where: { id } });
      if (!row) throw new SalesProductivityNotFoundError();
      assertRepresentativeInScope(scope, row.representativeId);
      return toDto(row);
    });
  }

  async list(
    user: JwtClaimsVO,
    perms: ReadonlySet<string>,
    query: {
      page: number;
      pageSize: number;
      periodKey?: string;
      representativeId?: string;
      status?: string;
    },
  ): Promise<{ items: CommissionSnapshotDto[]; total: number; page: number; pageSize: number }> {
    this.assertPlatformPrincipal(user);
    return this.prisma.withPlatformBypass(async (client) => {
      const scope = await resolveProductivityVisibility(client, user.sub, perms, 'snapshot');
      const scoped = scopedRepresentativeIds(scope);
      if (scoped && scoped.length === 0) {
        return { items: [], total: 0, page: query.page, pageSize: query.pageSize };
      }
      if (query.representativeId) {
        assertRepresentativeInScope(scope, query.representativeId);
      }
      const where: Prisma.PlatformSalesCommissionSnapshotWhereInput = {
        ...(scoped ? { representativeId: { in: scoped } } : {}),
        ...(query.representativeId ? { representativeId: query.representativeId } : {}),
        ...(query.periodKey ? { periodKey: query.periodKey.trim() } : {}),
        ...(query.status ? { status: query.status.trim() } : {}),
      };
      const [total, rows] = await Promise.all([
        client.platformSalesCommissionSnapshot.count({ where }),
        client.platformSalesCommissionSnapshot.findMany({
          where,
          orderBy: [{ periodKey: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);
      return {
        items: rows.map(toDto),
        total,
        page: query.page,
        pageSize: query.pageSize,
      };
    });
  }

  async generate(
    user: JwtClaimsVO,
    perms: ReadonlySet<string>,
    input: {
      representativeId: string;
      periodKey: string;
      periodTimezone?: string;
      finalize?: boolean;
      reason?: string;
    },
    idempotencyKey: string,
  ): Promise<CommissionSnapshotDto & { replayed: boolean; correlationId: string }> {
    this.assertPlatformPrincipal(user);
    if (!perms.has(SALES_PRODUCTIVITY_PERMISSIONS.snapshotGenerate)) {
      throw new SalesProductivityForbiddenError(
        `Missing ${SALES_PRODUCTIVITY_PERMISSIONS.snapshotGenerate}`,
      );
    }
    const periodTimezone = (input.periodTimezone ?? DEFAULT_PERIOD_TIMEZONE).trim() || 'UTC';
    if (periodTimezone !== 'UTC') {
      throw new SalesProductivityValidationError(
        'Only UTC periodTimezone is supported in Step 26.',
        'timezone_unsupported',
      );
    }
    let period;
    try {
      period = utcMonthPeriod(input.periodKey);
    } catch {
      throw new SalesProductivityValidationError('Invalid periodKey; expected YYYY-MM.');
    }

    const requestHash = this.idempotency.fingerprint({
      representativeId: input.representativeId,
      periodKey: period.periodKey,
      periodTimezone,
      formulaVersion: COMMISSION_FORMULA_VERSION,
      finalize: Boolean(input.finalize),
    });
    const provisionalId = randomUUID();
    const claim = await this.idempotency.claimOrReplay({
      actorId: user.sub,
      operation: SALES_COMMISSION_OPERATIONS.generate,
      idempotencyKey,
      requestHash,
      resultResourceType: SALES_COMMISSION_AUDIT_RESOURCE_TYPE,
      resultResourceId: provisionalId,
    });
    if (claim.kind === 'replay') {
      const dto = await this.getById(user, perms, claim.result.targetId);
      return { ...dto, replayed: true, correlationId: claim.result.correlationId };
    }

    if (isSalesProductivityFailureInjectionActive('after_idempotency_claim')) {
      await this.idempotency.releasePendingClaim({
        actorId: user.sub,
        operation: SALES_COMMISSION_OPERATIONS.generate,
        idempotencyKey: claim.idempotencyKey,
      });
      throw new SalesProductivityError('injected_failure', 'Injected after idempotency claim', 500);
    }

    try {
      await this.prisma.withPlatformBypass(async (client) => {
        const scope = await resolveProductivityVisibility(client, user.sub, perms, 'snapshot');
        assertRepresentativeInScope(scope, input.representativeId);
        const rep = await client.platformSalesRepresentative.findUnique({
          where: { id: input.representativeId },
          select: { id: true, status: true },
        });
        if (!rep) throw new SalesProductivityNotFoundError('Representative not found.');
        if (rep.status === 'SUSPENDED' || rep.status === 'DISABLED') {
          throw new SalesProductivityForbiddenError('Representative profile is not active.');
        }
      });

      const sourceCutoffAt = new Date();
      const bundle = await this.metrics.computeForRepresentative({
        representativeId: input.representativeId,
        periodKey: period.periodKey,
        sourceCutoffAt,
      });

      // F19 — reconciliation evaluation. Contained injector forces explicit UNAVAILABLE
      // and never claims reconciled=true. When injector is inactive, keep null (Attempt 1 shape).
      let reconciliationJson: Prisma.InputJsonValue | typeof Prisma.JsonNull = Prisma.JsonNull;
      if (isSalesProductivityFailureInjectionActive('during_reconciliation')) {
        reconciliationJson = {
          reconciled: false,
          status: 'UNAVAILABLE',
          reason: 'injected_reconciliation_failure',
          sourceCutoffAt: sourceCutoffAt.toISOString(),
          formulaVersion: COMMISSION_FORMULA_VERSION,
        };
        if (input.finalize) {
          await this.idempotency.releasePendingClaim({
            actorId: user.sub,
            operation: SALES_COMMISSION_OPERATIONS.generate,
            idempotencyKey: claim.idempotencyKey,
          });
          throw new SalesProductivityValidationError(
            'Reconciliation unavailable; cannot finalize snapshot.',
            'reconciliation_unavailable',
          );
        }
      } else if (bundle.completeness.reporting_completeness === 'UNAVAILABLE') {
        reconciliationJson = {
          reconciled: false,
          status: 'UNAVAILABLE',
          reason: 'reporting_completeness_unavailable',
          sourceCutoffAt: sourceCutoffAt.toISOString(),
          formulaVersion: COMMISSION_FORMULA_VERSION,
        };
      }

      const finalize = Boolean(input.finalize);
      const status: CommissionSnapshotStatus = finalize ? 'FINALIZED' : 'DRAFT';
      const snapshotId = provisionalId;

      const result = await this.prisma.withPlatformBypass(async (client) => {
        if (isSalesProductivityFailureInjectionActive('before_commit')) {
          throw new SalesProductivityError('injected_failure', 'Injected before commit', 500);
        }

        const existing = await client.platformSalesCommissionSnapshot.findFirst({
          where: {
            representativeId: input.representativeId,
            periodKey: period.periodKey,
            periodTimezone,
            formulaVersion: COMMISSION_FORMULA_VERSION,
            status: { not: 'SUPERSEDED' },
          },
        });

        let supersedesSnapshotId: string | null = null;
        if (existing) {
          if (existing.status === 'FINALIZED' || existing.status === 'DRAFT') {
            await client.platformSalesCommissionSnapshot.update({
              where: { id: existing.id },
              data: { status: 'SUPERSEDED', rowVersion: { increment: 1 } },
            });
            supersedesSnapshotId = existing.id;
            await this.audit.recordInTransaction(client, {
              action: SALES_COMMISSION_AUDIT_ACTIONS.SUPERSEDED,
              resourceType: SALES_COMMISSION_AUDIT_RESOURCE_TYPE,
              resourceId: existing.id,
              actorId: user.sub,
              actorRoles: this.actorRoles(user),
              reason: input.reason ?? 'revised_by_generate',
              result: 'success',
              descriptionEn: 'Commission snapshot superseded by revision',
              descriptionAr: 'تم استبدال لقطة العمولة بمراجعة',
              details: { successorId: snapshotId, periodKey: period.periodKey },
            });
          }
        }

        let created;
        try {
          created = await client.platformSalesCommissionSnapshot.create({
            data: {
              id: snapshotId,
              representativeId: input.representativeId,
              periodKey: period.periodKey,
              periodTimezone,
              periodStart: period.periodStart,
              periodEnd: period.periodEnd,
              sourceCutoffAt,
              formulaVersion: COMMISSION_FORMULA_VERSION,
              calculationStatus: 'UNCONFIGURED',
              ruleReference: null,
              computedAmount: null,
              metricsJson: metricsToJson(bundle),
              planVersionAttributionJson:
                bundle.planVersionAttribution as unknown as Prisma.InputJsonValue,
              addOnAttributionJson: bundle.addOnAttribution as unknown as Prisma.InputJsonValue,
              completenessJson: bundle.completeness as unknown as Prisma.InputJsonValue,
              reconciliationJson,
              reviewStatus: 'NONE',
              paidStatus: 'UNPAID',
              status,
              supersedesSnapshotId,
              finalizedAt: finalize ? sourceCutoffAt : null,
            },
          });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            throw new SalesProductivityConflictError(
              'Active commission snapshot already exists for period/formula.',
              'snapshot_unique_conflict',
            );
          }
          throw err;
        }

        if (isSalesProductivityFailureInjectionActive('after_snapshot_insert')) {
          throw new SalesProductivityError('injected_failure', 'Injected after snapshot insert', 500);
        }

        const correlationId = await this.audit.recordInTransaction(client, {
          action: finalize
            ? SALES_COMMISSION_AUDIT_ACTIONS.FINALIZED
            : SALES_COMMISSION_AUDIT_ACTIONS.GENERATED,
          resourceType: SALES_COMMISSION_AUDIT_RESOURCE_TYPE,
          resourceId: created.id,
          actorId: user.sub,
          actorRoles: this.actorRoles(user),
          reason: input.reason ?? null,
          result: 'success',
          descriptionEn: finalize
            ? 'Commission snapshot finalized'
            : 'Commission snapshot generated',
          descriptionAr: finalize ? 'تم إنهاء لقطة العمولة' : 'تم إنشاء لقطة العمولة',
          details: {
            periodKey: period.periodKey,
            formulaVersion: COMMISSION_FORMULA_VERSION,
            calculationStatus: 'UNCONFIGURED',
            supersedesSnapshotId,
          },
        });

        const actionResult: CommissionActionResult = {
          accepted: true,
          replayed: false,
          action: finalize ? 'finalize' : 'generate',
          targetId: created.id,
          correlationId,
          result: 'accepted',
        };
        try {
          await this.idempotency.completeInTransaction(client, {
            actorId: user.sub,
            operation: SALES_COMMISSION_OPERATIONS.generate,
            idempotencyKey: claim.idempotencyKey,
            requestHash,
            resultResourceType: SALES_COMMISSION_AUDIT_RESOURCE_TYPE,
            resultResourceId: created.id,
            result: actionResult,
          });
        } catch (err) {
          if (err instanceof CommissionIdempotencyEquivalentRaceLostError) {
            throw err;
          }
          throw err;
        }

        return { created, correlationId };
      });

      if (isSalesProductivityFailureInjectionActive('after_commit_before_response')) {
        throw new SalesProductivityError(
          'injected_failure',
          'Injected after commit before response',
          500,
        );
      }

      return { ...toDto(result.created), replayed: false, correlationId: result.correlationId };
    } catch (err) {
      if (err instanceof CommissionIdempotencyEquivalentRaceLostError) {
        const dto = await this.getById(user, perms, err.resultResourceId);
        const replay = this.idempotency.payloadToResult(err.resultPayload);
        return { ...dto, replayed: true, correlationId: replay.correlationId };
      }
      await this.idempotency.releasePendingClaim({
        actorId: user.sub,
        operation: SALES_COMMISSION_OPERATIONS.generate,
        idempotencyKey: claim.idempotencyKey,
      });
      throw err;
    }
  }

  async review(
    user: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
    input: { reviewStatus: CommissionReviewStatus; expectedRowVersion: number; reason?: string },
    idempotencyKey: string,
  ): Promise<CommissionSnapshotDto & { replayed: boolean; correlationId: string }> {
    this.assertPlatformPrincipal(user);
    if (!perms.has(SALES_PRODUCTIVITY_PERMISSIONS.snapshotReview)) {
      throw new SalesProductivityForbiddenError(
        `Missing ${SALES_PRODUCTIVITY_PERMISSIONS.snapshotReview}`,
      );
    }
    const allowed: CommissionReviewStatus[] = ['NONE', 'IN_REVIEW', 'REVIEWED', 'REJECTED'];
    if (!allowed.includes(input.reviewStatus)) {
      throw new SalesProductivityValidationError('Invalid reviewStatus.');
    }

    const requestHash = this.idempotency.fingerprint({
      id,
      reviewStatus: input.reviewStatus,
      expectedRowVersion: input.expectedRowVersion,
    });
    const claim = await this.idempotency.claimOrReplay({
      actorId: user.sub,
      operation: SALES_COMMISSION_OPERATIONS.review,
      idempotencyKey,
      requestHash,
      resultResourceType: SALES_COMMISSION_AUDIT_RESOURCE_TYPE,
      resultResourceId: id,
    });
    if (claim.kind === 'replay') {
      const dto = await this.getById(user, perms, claim.result.targetId);
      return { ...dto, replayed: true, correlationId: claim.result.correlationId };
    }

    try {
      const result = await this.prisma.withPlatformBypass(async (client) => {
        const scope = await resolveProductivityVisibility(client, user.sub, perms, 'snapshot');
        const existing = await client.platformSalesCommissionSnapshot.findUnique({ where: { id } });
        if (!existing) throw new SalesProductivityNotFoundError();
        assertRepresentativeInScope(scope, existing.representativeId);
        if (existing.status === 'SUPERSEDED') {
          throw new SalesProductivityConflictError('Cannot review a SUPERSEDED snapshot.');
        }
        if (existing.rowVersion !== input.expectedRowVersion) {
          throw new SalesProductivityConflictError('Row version conflict.', 'occ_conflict');
        }
        if (isSalesProductivityFailureInjectionActive('occ_conflict')) {
          throw new SalesProductivityConflictError('Injected OCC conflict.', 'occ_conflict');
        }

        const updated = await client.platformSalesCommissionSnapshot.updateMany({
          where: { id, rowVersion: input.expectedRowVersion },
          data: {
            reviewStatus: input.reviewStatus,
            rowVersion: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new SalesProductivityConflictError('Row version conflict.', 'occ_conflict');
        }
        const row = await client.platformSalesCommissionSnapshot.findUniqueOrThrow({ where: { id } });
        const correlationId = await this.audit.recordInTransaction(client, {
          action: SALES_COMMISSION_AUDIT_ACTIONS.REVIEWED,
          resourceType: SALES_COMMISSION_AUDIT_RESOURCE_TYPE,
          resourceId: id,
          actorId: user.sub,
          actorRoles: this.actorRoles(user),
          reason: input.reason ?? null,
          result: 'success',
          descriptionEn: 'Commission snapshot review status updated',
          descriptionAr: 'تم تحديث حالة مراجعة لقطة العمولة',
          details: { reviewStatus: input.reviewStatus },
        });
        await this.idempotency.completeInTransaction(client, {
          actorId: user.sub,
          operation: SALES_COMMISSION_OPERATIONS.review,
          idempotencyKey: claim.idempotencyKey,
          requestHash,
          resultResourceType: SALES_COMMISSION_AUDIT_RESOURCE_TYPE,
          resultResourceId: id,
          result: {
            accepted: true,
            replayed: false,
            action: 'review',
            targetId: id,
            correlationId,
            result: 'accepted',
          },
        });
        return { row, correlationId };
      });
      return { ...toDto(result.row), replayed: false, correlationId: result.correlationId };
    } catch (err) {
      if (err instanceof CommissionIdempotencyEquivalentRaceLostError) {
        const dto = await this.getById(user, perms, err.resultResourceId);
        const replay = this.idempotency.payloadToResult(err.resultPayload);
        return { ...dto, replayed: true, correlationId: replay.correlationId };
      }
      await this.idempotency.releasePendingClaim({
        actorId: user.sub,
        operation: SALES_COMMISSION_OPERATIONS.review,
        idempotencyKey: claim.idempotencyKey,
      });
      throw err;
    }
  }

  /**
   * Administrative paid-status only. MUST NOT mutate Subscription / Tenant / Entitlement.
   */
  async markPaid(
    user: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
    input: {
      paidStatus: CommissionPaidStatus;
      expectedRowVersion: number;
      paidReason?: string;
      paidReference?: string;
    },
    idempotencyKey: string,
  ): Promise<CommissionSnapshotDto & { replayed: boolean; correlationId: string }> {
    this.assertPlatformPrincipal(user);
    if (!perms.has(SALES_PRODUCTIVITY_PERMISSIONS.snapshotMarkPaid)) {
      throw new SalesProductivityForbiddenError(
        `Missing ${SALES_PRODUCTIVITY_PERMISSIONS.snapshotMarkPaid}`,
      );
    }
    if (input.paidStatus !== 'PAID' && input.paidStatus !== 'UNPAID') {
      throw new SalesProductivityValidationError('Invalid paidStatus.');
    }

    const requestHash = this.idempotency.fingerprint({
      id,
      paidStatus: input.paidStatus,
      expectedRowVersion: input.expectedRowVersion,
      paidReason: input.paidReason ?? null,
      paidReference: input.paidReference ?? null,
    });
    const claim = await this.idempotency.claimOrReplay({
      actorId: user.sub,
      operation: SALES_COMMISSION_OPERATIONS.markPaid,
      idempotencyKey,
      requestHash,
      resultResourceType: SALES_COMMISSION_AUDIT_RESOURCE_TYPE,
      resultResourceId: id,
    });
    if (claim.kind === 'replay') {
      const dto = await this.getById(user, perms, claim.result.targetId);
      return { ...dto, replayed: true, correlationId: claim.result.correlationId };
    }

    try {
      if (isSalesProductivityFailureInjectionActive('mark_paid_side_effect_guard')) {
        throw new SalesProductivityValidationError(
          'Injected mark-paid side-effect guard',
          'injected_failure',
        );
      }

      const result = await this.prisma.withPlatformBypass(async (client) => {
        const scope = await resolveProductivityVisibility(client, user.sub, perms, 'snapshot');
        const existing = await client.platformSalesCommissionSnapshot.findUnique({ where: { id } });
        if (!existing) throw new SalesProductivityNotFoundError();
        assertRepresentativeInScope(scope, existing.representativeId);
        if (existing.status === 'SUPERSEDED') {
          throw new SalesProductivityConflictError('Cannot mark a SUPERSEDED snapshot paid.');
        }
        if (existing.rowVersion !== input.expectedRowVersion) {
          throw new SalesProductivityConflictError('Row version conflict.', 'occ_conflict');
        }

        // Only paid* fields + rowVersion — never Subscription/Tenant/Entitlement.
        const updated = await client.platformSalesCommissionSnapshot.updateMany({
          where: { id, rowVersion: input.expectedRowVersion },
          data: {
            paidStatus: input.paidStatus,
            paidReason: input.paidReason?.trim() || null,
            paidReference: input.paidReference?.trim() || null,
            paidAt: input.paidStatus === 'PAID' ? new Date() : null,
            paidByPlatformUserId: input.paidStatus === 'PAID' ? user.sub : null,
            rowVersion: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new SalesProductivityConflictError('Row version conflict.', 'occ_conflict');
        }
        const row = await client.platformSalesCommissionSnapshot.findUniqueOrThrow({ where: { id } });
        const correlationId = await this.audit.recordInTransaction(client, {
          action: SALES_COMMISSION_AUDIT_ACTIONS.MARKED_PAID,
          resourceType: SALES_COMMISSION_AUDIT_RESOURCE_TYPE,
          resourceId: id,
          actorId: user.sub,
          actorRoles: this.actorRoles(user),
          reason: input.paidReason ?? null,
          result: 'success',
          descriptionEn: 'Commission snapshot paid status updated (administrative only)',
          descriptionAr: 'تم تحديث حالة الدفع الإدارية للقطة العمولة',
          details: {
            paidStatus: input.paidStatus,
            paidReference: input.paidReference ?? null,
            moneyMovement: 0,
            subscriptionMutations: 0,
            tenantMutations: 0,
            entitlementMutations: 0,
          },
        });
        await this.idempotency.completeInTransaction(client, {
          actorId: user.sub,
          operation: SALES_COMMISSION_OPERATIONS.markPaid,
          idempotencyKey: claim.idempotencyKey,
          requestHash,
          resultResourceType: SALES_COMMISSION_AUDIT_RESOURCE_TYPE,
          resultResourceId: id,
          result: {
            accepted: true,
            replayed: false,
            action: 'mark_paid',
            targetId: id,
            correlationId,
            result: 'accepted',
          },
        });
        return { row, correlationId };
      });
      return { ...toDto(result.row), replayed: false, correlationId: result.correlationId };
    } catch (err) {
      if (err instanceof CommissionIdempotencyEquivalentRaceLostError) {
        const dto = await this.getById(user, perms, err.resultResourceId);
        const replay = this.idempotency.payloadToResult(err.resultPayload);
        return { ...dto, replayed: true, correlationId: replay.correlationId };
      }
      await this.idempotency.releasePendingClaim({
        actorId: user.sub,
        operation: SALES_COMMISSION_OPERATIONS.markPaid,
        idempotencyKey: claim.idempotencyKey,
      });
      throw err;
    }
  }
}
