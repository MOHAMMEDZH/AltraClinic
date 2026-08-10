import { randomUUID } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { RetentionService } from './ports/services';
import {
  BACKUP_SNAPSHOT_STORE,
  type BackupSnapshotStore,
} from '../infrastructure/in-memory-backup-snapshot.store';
import {
  CLEANUP_PLAN_STORE,
  RETENTION_EVALUATION_STORE,
  type CleanupPlanStore,
  type RetentionEvaluationStore,
} from '../infrastructure/verification-retention.stores';
import type {
  CleanupPlanPriority,
  CleanupPlanRecord,
  RetentionEvaluationRecord,
  RetentionPolicyEvaluationInput,
} from '../domain/verification/verification-retention.types';
import { BackupRestoreActivityEmitterService } from './backup-restore-activity.emitter';
import { BackupRestoreNotificationIntentRegistrar } from './backup-restore-notification-intent.registrar';
import { BackupRestoreAuditLog } from '../infrastructure/backup-restore-audit.log';
import { VerificationRetentionObservabilityHooks } from './verification-retention-observability.hooks';
import { loadBackupRestoreFoundationConfig } from '../config/backup-restore-config';
import { BACKUP_RESTORE_LOG_KIND } from '../backup-restore.constants';
import type { BackupSnapshotRecord } from '../domain/backup/backup-engine.types';

export interface EvaluateRetentionInput {
  tenantId: string;
  policy?: Partial<RetentionPolicyEvaluationInput>;
  /** Snapshot IDs that still have a known backup job reference; others are orphaned. */
  knownBackupJobIds?: readonly string[];
  correlationId?: string;
  actorId?: string;
  planPriority?: CleanupPlanPriority;
}

/**
 * Phase 43d — Retention Engine.
 * Evaluates retention and builds cleanup plans. No deletion / cleanup execution.
 */
@Injectable()
export class RetentionEngine implements RetentionService {
  readonly contractVersion = '43d' as const;
  private readonly logger = new Logger(RetentionEngine.name);

  constructor(
    @Inject(BACKUP_SNAPSHOT_STORE) private readonly snapshots: BackupSnapshotStore,
    @Inject(RETENTION_EVALUATION_STORE)
    private readonly evaluations: RetentionEvaluationStore,
    @Inject(CLEANUP_PLAN_STORE) private readonly plans: CleanupPlanStore,
    private readonly activity: BackupRestoreActivityEmitterService,
    private readonly audit: BackupRestoreAuditLog,
    private readonly notifications: BackupRestoreNotificationIntentRegistrar,
    private readonly observability: VerificationRetentionObservabilityHooks,
  ) {}

  async evaluate(input: EvaluateRetentionInput): Promise<{
    evaluation: RetentionEvaluationRecord;
    cleanupPlan: CleanupPlanRecord;
  }> {
    const defaults = loadBackupRestoreFoundationConfig().defaults;
    const policy: RetentionPolicyEvaluationInput = {
      mode: input.policy?.mode ?? 'by_days',
      retainDays: input.policy?.retainDays ?? defaults.retentionDays,
      retainCount: input.policy?.retainCount ?? undefined,
      legalHold: input.policy?.legalHold ?? false,
      tenantOverrideDays: input.policy?.tenantOverrideDays ?? null,
      inheritFromPolicyId: input.policy?.inheritFromPolicyId ?? null,
    };

    const correlationId = input.correlationId?.trim() || randomUUID();
    const actorId = input.actorId ?? 'system';
    const now = new Date();
    const all = [...(await this.snapshots.listByTenant(input.tenantId))];

    const legalHoldSnapshotIds: string[] = [];
    const expiredSnapshotIds: string[] = [];
    const retainedSnapshotIds: string[] = [];
    const orphanedSnapshotIds: string[] = [];

    const effectiveDays =
      policy.tenantOverrideDays != null && policy.tenantOverrideDays > 0
        ? policy.tenantOverrideDays
        : policy.retainDays ?? defaults.retentionDays;

    if (policy.legalHold || policy.mode === 'legal_hold' || policy.mode === 'forever') {
      for (const snap of all) {
        legalHoldSnapshotIds.push(snap.id);
        retainedSnapshotIds.push(snap.id);
      }
    } else if (policy.mode === 'by_count') {
      const sorted = [...all].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
      const keep = Math.max(1, policy.retainCount ?? 1);
      sorted.forEach((snap, index) => {
        if (index < keep) retainedSnapshotIds.push(snap.id);
        else expiredSnapshotIds.push(snap.id);
      });
    } else {
      // by_days / by_policy
      const cutoff = new Date(now.getTime() - effectiveDays * 24 * 60 * 60 * 1000);
      for (const snap of all) {
        const expiresAt = snap.expiresAt ?? this.computeExpiresAt(snap, effectiveDays);
        if (this.snapshots.markExpirationMetadata) {
          await this.snapshots.markExpirationMetadata(input.tenantId, snap.id, expiresAt);
        }
        if (expiresAt.getTime() <= now.getTime() || snap.createdAt.getTime() < cutoff.getTime()) {
          expiredSnapshotIds.push(snap.id);
        } else {
          retainedSnapshotIds.push(snap.id);
        }
      }
    }

    const knownJobs = new Set(input.knownBackupJobIds ?? all.map((s) => s.backupJobId));
    for (const snap of all) {
      if (!knownJobs.has(snap.backupJobId)) {
        orphanedSnapshotIds.push(snap.id);
      }
    }

    const evaluation: RetentionEvaluationRecord = {
      id: randomUUID(),
      tenantId: input.tenantId,
      evaluatedAt: now,
      policy,
      expiredSnapshotIds,
      orphanedSnapshotIds: [...new Set(orphanedSnapshotIds)],
      retainedSnapshotIds,
      legalHoldSnapshotIds,
      correlationId,
      details: {
        effectiveDays,
        snapshotCount: all.length,
        inheritFromPolicyId: policy.inheritFromPolicyId,
      },
    };
    await this.evaluations.save(evaluation);

    const cleanupPlan = await this.buildCleanupPlan({
      tenantId: input.tenantId,
      all,
      expiredSnapshotIds,
      orphanedSnapshotIds: evaluation.orphanedSnapshotIds,
      legalHoldSnapshotIds,
      correlationId,
      priority: input.planPriority ?? 'normal',
    });

    this.observability.onRetentionEvaluated(
      correlationId,
      expiredSnapshotIds.length,
      evaluation.orphanedSnapshotIds.length,
    );

    await this.activity.emit('retention_evaluated', {
      tenantId: input.tenantId,
      jobId: evaluation.id,
      correlationId,
      reason: `expired=${expiredSnapshotIds.length}`,
    });
    await this.notifications.registerIntentForEntity('retention_evaluated', {
      id: evaluation.id,
      tenantId: input.tenantId,
      correlationId,
    });
    await this.audit.record({
      tenantId: input.tenantId,
      action: 'backupRestore.retention.evaluated',
      jobId: evaluation.id,
      actorId,
      actorRoles: ['system'],
      correlationId,
      details: {
        expired: String(expiredSnapshotIds.length),
        orphaned: String(evaluation.orphanedSnapshotIds.length),
        mode: policy.mode,
      },
    });

    if (expiredSnapshotIds.length) {
      await this.activity.emit('snapshot_expired', {
        tenantId: input.tenantId,
        jobId: evaluation.id,
        correlationId,
        reason: expiredSnapshotIds.join(','),
      });
      await this.notifications.registerIntentForEntity('snapshot_expired', {
        id: evaluation.id,
        tenantId: input.tenantId,
        correlationId,
      });
      await this.audit.record({
        tenantId: input.tenantId,
        action: 'backupRestore.snapshot.expired_marked',
        jobId: evaluation.id,
        actorId,
        actorRoles: ['system'],
        correlationId,
        details: { count: String(expiredSnapshotIds.length) },
      });
    }

    await this.activity.emit('cleanup_planned', {
      tenantId: input.tenantId,
      jobId: cleanupPlan.id,
      correlationId,
      reason: `items=${cleanupPlan.items.length}`,
    });
    await this.notifications.registerIntentForEntity('cleanup_planned', {
      id: cleanupPlan.id,
      tenantId: input.tenantId,
      correlationId,
    });
    await this.audit.record({
      tenantId: input.tenantId,
      action: 'backupRestore.cleanup.planned',
      jobId: cleanupPlan.id,
      actorId,
      actorRoles: ['system'],
      correlationId,
      details: {
        items: String(cleanupPlan.items.length),
        estimatedBytes: String(cleanupPlan.estimatedReclaimedBytes),
        executed: 'false',
      },
    });

    if (cleanupPlan.items.some((i) => i.reason === 'policy_violation')) {
      await this.notifications.registerIntentForEntity('retention_policy_violation', {
        id: cleanupPlan.id,
        tenantId: input.tenantId,
        correlationId,
      });
    }

    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'retention_engine',
      event: 'evaluated',
      tenantId: input.tenantId,
      expired: expiredSnapshotIds.length,
      orphaned: evaluation.orphanedSnapshotIds.length,
      planItems: cleanupPlan.items.length,
      correlationId,
    });

    return { evaluation, cleanupPlan };
  }

  private computeExpiresAt(snapshot: BackupSnapshotRecord, retainDays: number): Date {
    return new Date(snapshot.createdAt.getTime() + retainDays * 24 * 60 * 60 * 1000);
  }

  private async buildCleanupPlan(input: {
    tenantId: string;
    all: BackupSnapshotRecord[];
    expiredSnapshotIds: readonly string[];
    orphanedSnapshotIds: readonly string[];
    legalHoldSnapshotIds: readonly string[];
    correlationId: string;
    priority: CleanupPlanPriority;
  }): Promise<CleanupPlanRecord> {
    const byId = new Map(input.all.map((s) => [s.id, s]));
    const legal = new Set(input.legalHoldSnapshotIds);
    const items: CleanupPlanRecord['items'][number][] = [];

    for (const id of input.expiredSnapshotIds) {
      if (legal.has(id)) continue;
      const snap = byId.get(id);
      if (!snap) continue;
      items.push({
        snapshotId: id,
        reason: 'expired',
        sizeBytes: snap.sizeBytes,
        expiresAt: snap.expiresAt,
      });
    }
    for (const id of input.orphanedSnapshotIds) {
      if (legal.has(id)) continue;
      if (items.some((i) => i.snapshotId === id)) continue;
      const snap = byId.get(id);
      if (!snap) continue;
      items.push({
        snapshotId: id,
        reason: 'orphaned',
        sizeBytes: snap.sizeBytes,
        expiresAt: snap.expiresAt,
      });
    }

    // Policy violation example: expired while still marked verification pending forever
    for (const snap of input.all) {
      if (
        snap.verificationStatus === 'pending' &&
        snap.expiresAt &&
        snap.expiresAt.getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000
      ) {
        if (legal.has(snap.id)) continue;
        if (items.some((i) => i.snapshotId === snap.id)) continue;
        items.push({
          snapshotId: snap.id,
          reason: 'policy_violation',
          sizeBytes: snap.sizeBytes,
          expiresAt: snap.expiresAt,
        });
      }
    }

    const plan: CleanupPlanRecord = {
      id: randomUUID(),
      tenantId: input.tenantId,
      createdAt: new Date(),
      correlationId: input.correlationId,
      priority: input.priority,
      items,
      estimatedReclaimedBytes: items.reduce((sum, i) => sum + i.sizeBytes, 0),
      executed: false,
      details: { deletionExecuted: false },
    };
    await this.plans.save(plan);
    this.observability.onCleanupPlanned(input.correlationId, items.length, plan.estimatedReclaimedBytes);
    return plan;
  }
}
