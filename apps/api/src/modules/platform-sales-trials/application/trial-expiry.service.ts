import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { resolveOperationCorrelationId } from '../../platform-audit-center/application/operation-correlation';
import { TrialAuditLog } from './trial-audit.log';
import { TrialProvisioningAdapter } from './trial-provisioning.adapter';
import {
  SALES_TRIAL_AUDIT_ACTIONS,
  SALES_TRIAL_AUDIT_RESOURCE_TYPE,
  TRIAL_EXPIRY_BATCH_LIMIT,
  TRIAL_EXPIRY_MAX_BATCH_LIMIT,
  isSalesTrialsFailureInjectionActive,
} from '../platform-sales-trials.constants';
import { SalesTrialError } from '../domain/sales-trial.errors';
import type { TrialExpiryRunResult, TrialOnlyGrant } from '../domain/sales-trial.types';

/**
 * Flexible Step 25 — deterministic Trial expiry processor.
 *
 * Enforcement is never UI-only: the processor transitions the governance aggregate to
 * EXPIRED, applies the `EXPIRE_ON_TRIAL_EXPIRY` disposition to trial-only grants, hands
 * the tenant to the Step 19 deny path (PlatformTenant → SUSPENDED), and invalidates the
 * Step 18 EER cache so runtime resolves deny immediately.
 */
@Injectable()
export class TrialExpiryService {
  private readonly logger = new Logger(TrialExpiryService.name);
  private clock: () => Date = () => new Date();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: TrialAuditLog,
    private readonly provisioning: TrialProvisioningAdapter,
  ) {}

  /** Test seam — injectable UTC clock for expiry-boundary cases. */
  setClock(clock: () => Date): void {
    this.clock = clock;
  }

  /**
   * Claims and expires at most `limit` due Trials.
   * Query is the indexed `(status, expiresAt, id)` scan ordered by `expiresAt, id`;
   * the claim itself is a conditional status transition so parallel instances cannot
   * both expire the same Trial.
   */
  async processDueTrials(limit = TRIAL_EXPIRY_BATCH_LIMIT): Promise<TrialExpiryRunResult> {
    const batch = Math.max(1, Math.min(Math.trunc(limit) || 1, TRIAL_EXPIRY_MAX_BATCH_LIMIT));
    const now = this.clock();
    const due = await this.prisma.platformSalesTrial.findMany({
      where: { status: 'ACTIVE', expiresAt: { lte: now } },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take: batch,
      select: {
        id: true,
        rowVersion: true,
        expiresAt: true,
        platformTenantId: true,
        trialOnlyGrantsJson: true,
      },
    });

    const result: TrialExpiryRunResult = {
      scanned: due.length,
      expired: 0,
      skipped: 0,
      claimConflicts: 0,
      trialIds: [],
    };

    for (const trial of due) {
      if (isSalesTrialsFailureInjectionActive('expiry_claim')) {
        throw new SalesTrialError('injected_failure', 'Injected expiry claim failure', 500);
      }
      const claimed = await this.expireOne({
        id: trial.id,
        rowVersion: trial.rowVersion,
        expiresAt: trial.expiresAt,
        platformTenantId: trial.platformTenantId,
        grants: trial.trialOnlyGrantsJson,
        now,
      });
      if (claimed === 'expired') {
        result.expired += 1;
        result.trialIds.push(trial.id);
      } else if (claimed === 'conflict') {
        result.claimConflicts += 1;
      } else {
        result.skipped += 1;
      }
    }
    return result;
  }

  /** Exposed for the detail page / operator retry: expires a single due Trial. */
  async expireTrialIfDue(trialId: string): Promise<'expired' | 'conflict' | 'skipped'> {
    const now = this.clock();
    const trial = await this.prisma.platformSalesTrial.findUnique({
      where: { id: trialId },
      select: {
        id: true,
        status: true,
        rowVersion: true,
        expiresAt: true,
        platformTenantId: true,
        trialOnlyGrantsJson: true,
      },
    });
    if (!trial || trial.status !== 'ACTIVE') return 'skipped';
    if (!trial.expiresAt || trial.expiresAt.getTime() > now.getTime()) return 'skipped';
    return this.expireOne({
      id: trial.id,
      rowVersion: trial.rowVersion,
      expiresAt: trial.expiresAt,
      platformTenantId: trial.platformTenantId,
      grants: trial.trialOnlyGrantsJson,
      now,
    });
  }

  private async expireOne(input: {
    id: string;
    rowVersion: number;
    expiresAt: Date | null;
    platformTenantId: string | null;
    grants: unknown;
    now: Date;
  }): Promise<'expired' | 'conflict' | 'skipped'> {
    const grants: TrialOnlyGrant[] = Array.isArray(input.grants)
      ? (input.grants as TrialOnlyGrant[])
      : [];
    // Trial-only grants expire with the Trial; nothing silently carries forward.
    const expiredGrants = grants.map((g) => ({
      grantKey: g.grantKey,
      kind: g.kind,
      disposition: g.trialOnly === false ? 'RETAIN_NOT_TRIAL_ONLY' : 'EXPIRE_ON_TRIAL_EXPIRY',
    }));
    if (isSalesTrialsFailureInjectionActive('expiry_grant_disposition')) {
      throw new SalesTrialError('injected_failure', 'Injected expiry grant disposition', 500);
    }

    let outcome: 'expired' | 'conflict' = 'expired' as 'expired' | 'conflict';
    await this.prisma.withPlatformBypass(async (client) => {
      // Multi-instance safe claim: OCC on rowVersion AND status still ACTIVE.
      const claimed = await client.platformSalesTrial.updateMany({
        where: { id: input.id, status: 'ACTIVE', rowVersion: input.rowVersion },
        data: {
          status: 'EXPIRED',
          expiredAt: input.now,
          trialOnlyGrantsJson: grants.map((g) => ({
            ...g,
            expiredAt: g.trialOnly === false ? null : input.now.toISOString(),
          })) as unknown as Prisma.InputJsonValue,
          rowVersion: { increment: 1 },
        },
      });
      if (claimed.count !== 1) {
        outcome = 'conflict';
        return;
      }
      const correlationId = resolveOperationCorrelationId({});
      // Audited exactly once per Trial: the claim above cannot succeed twice.
      await this.audit.recordInTransaction(client, {
        action: SALES_TRIAL_AUDIT_ACTIONS.EXPIRED,
        resourceType: SALES_TRIAL_AUDIT_RESOURCE_TYPE,
        resourceId: input.id,
        actorId: SYSTEM_ACTOR_ID,
        actorRoles: ['system_expiry_job'],
        reason: 'trial_window_elapsed',
        correlationId,
        details: {
          expiresAt: input.expiresAt?.toISOString() ?? null,
          expiredAt: input.now.toISOString(),
          grantDispositions: expiredGrants,
          lifecycleHandoff: 'platform_tenant_suspend',
          entitlementAuthority: 'step16_snapshot_step18_eer',
        },
        result: 'success',
        descriptionEn: 'Sales trial expired by scheduled processor',
        descriptionAr: 'انتهت النسخة التجريبية بواسطة المعالج المجدول',
      });
    });
    if (outcome === 'conflict') return 'conflict';

    if (isSalesTrialsFailureInjectionActive('expiry_lifecycle_handoff')) {
      throw new SalesTrialError('injected_failure', 'Injected expiry lifecycle handoff', 500);
    }
    if (input.platformTenantId) {
      try {
        await this.provisioning.suspendTenantForExpiry({
          platformTenantId: input.platformTenantId,
          reason: 'sales_trial_expired',
        });
      } catch (err) {
        // The governance transition is already durable; lifecycle handoff is retried by
        // the next scheduled run via reconcileExpiredLifecycle.
        this.logger.warn(
          `Trial ${input.id} expired but lifecycle handoff failed: ${(err as Error)?.message}`,
        );
      }
    }
    return 'expired';
  }

  /**
   * Repairs EXPIRED Trials whose tenant lifecycle handoff did not complete (crash between
   * the durable transition and the Step 19 suspend). Idempotent.
   */
  async reconcileExpiredLifecycle(limit = TRIAL_EXPIRY_BATCH_LIMIT): Promise<number> {
    const rows = await this.prisma.platformSalesTrial.findMany({
      where: {
        status: 'EXPIRED',
        platformTenantId: { not: null },
        platformTenant: { status: { in: ['ACTIVE', 'PROVISIONING'] } },
      },
      orderBy: [{ expiredAt: 'asc' }, { id: 'asc' }],
      take: Math.max(1, Math.min(Math.trunc(limit) || 1, TRIAL_EXPIRY_MAX_BATCH_LIMIT)),
      select: { id: true, platformTenantId: true },
    });
    let repaired = 0;
    for (const row of rows) {
      if (!row.platformTenantId) continue;
      const res = await this.provisioning.suspendTenantForExpiry({
        platformTenantId: row.platformTenantId,
        reason: 'sales_trial_expired_reconcile',
      });
      if (res.suspended) repaired += 1;
    }
    return repaired;
  }
}

/** Deterministic system actor for unattended expiry audit rows (not a real platform user). */
export const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000025';
