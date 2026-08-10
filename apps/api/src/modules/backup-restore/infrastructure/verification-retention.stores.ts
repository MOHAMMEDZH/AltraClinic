import { Injectable } from '@nestjs/common';
import type {
  CleanupPlanRecord,
  RetentionEvaluationRecord,
  VerificationResultRecord,
} from '../domain/verification/verification-retention.types';
import type { BackupSnapshotRecord } from '../domain/backup/backup-engine.types';

export const VERIFICATION_RESULT_STORE = Symbol('VERIFICATION_RESULT_STORE');
export const RETENTION_EVALUATION_STORE = Symbol('RETENTION_EVALUATION_STORE');
export const CLEANUP_PLAN_STORE = Symbol('CLEANUP_PLAN_STORE');

export interface VerificationResultStore {
  save(result: VerificationResultRecord): Promise<VerificationResultRecord>;
  findById(tenantId: string, id: string): Promise<VerificationResultRecord | null>;
  listBySnapshot(tenantId: string, snapshotId: string): Promise<readonly VerificationResultRecord[]>;
  listByTenant(tenantId: string): Promise<readonly VerificationResultRecord[]>;
}

export interface RetentionEvaluationStore {
  save(record: RetentionEvaluationRecord): Promise<RetentionEvaluationRecord>;
  listByTenant(tenantId: string): Promise<readonly RetentionEvaluationRecord[]>;
}

export interface CleanupPlanStore {
  save(plan: CleanupPlanRecord): Promise<CleanupPlanRecord>;
  listByTenant(tenantId: string): Promise<readonly CleanupPlanRecord[]>;
}

/** Additive snapshot store methods used by 43d (no deletion). */
export interface BackupSnapshotStoreExtensions {
  updateVerificationStatus(
    tenantId: string,
    snapshotId: string,
    verificationStatus: BackupSnapshotRecord['verificationStatus'],
  ): Promise<BackupSnapshotRecord | null>;
  markExpirationMetadata(
    tenantId: string,
    snapshotId: string,
    expiresAt: Date | null,
  ): Promise<BackupSnapshotRecord | null>;
}

@Injectable()
export class InMemoryVerificationResultStore implements VerificationResultStore {
  private readonly rows = new Map<string, VerificationResultRecord>();

  reset(): void {
    this.rows.clear();
  }

  async save(result: VerificationResultRecord): Promise<VerificationResultRecord> {
    const copy: VerificationResultRecord = {
      ...result,
      stagesCompleted: [...result.stagesCompleted],
      transitions: result.transitions.map((t) => ({ ...t, at: new Date(t.at) })),
      startedAt: result.startedAt ? new Date(result.startedAt) : null,
      completedAt: result.completedAt ? new Date(result.completedAt) : null,
      createdAt: new Date(result.createdAt),
      updatedAt: new Date(result.updatedAt),
      details: { ...result.details },
    };
    this.rows.set(result.id, copy);
    return copy;
  }

  async findById(tenantId: string, id: string): Promise<VerificationResultRecord | null> {
    const row = this.rows.get(id);
    if (!row || row.tenantId !== tenantId) return null;
    return this.clone(row);
  }

  async listBySnapshot(
    tenantId: string,
    snapshotId: string,
  ): Promise<readonly VerificationResultRecord[]> {
    return [...this.rows.values()]
      .filter((r) => r.tenantId === tenantId && r.snapshotId === snapshotId)
      .map((r) => this.clone(r));
  }

  async listByTenant(tenantId: string): Promise<readonly VerificationResultRecord[]> {
    return [...this.rows.values()]
      .filter((r) => r.tenantId === tenantId)
      .map((r) => this.clone(r));
  }

  private clone(row: VerificationResultRecord): VerificationResultRecord {
    return {
      ...row,
      stagesCompleted: [...row.stagesCompleted],
      transitions: row.transitions.map((t) => ({ ...t, at: new Date(t.at) })),
      details: { ...row.details },
    };
  }
}

@Injectable()
export class InMemoryRetentionEvaluationStore implements RetentionEvaluationStore {
  private readonly rows: RetentionEvaluationRecord[] = [];

  reset(): void {
    this.rows.length = 0;
  }

  async save(record: RetentionEvaluationRecord): Promise<RetentionEvaluationRecord> {
    const copy: RetentionEvaluationRecord = {
      ...record,
      evaluatedAt: new Date(record.evaluatedAt),
      expiredSnapshotIds: [...record.expiredSnapshotIds],
      orphanedSnapshotIds: [...record.orphanedSnapshotIds],
      retainedSnapshotIds: [...record.retainedSnapshotIds],
      legalHoldSnapshotIds: [...record.legalHoldSnapshotIds],
      details: { ...record.details },
    };
    this.rows.push(copy);
    return copy;
  }

  async listByTenant(tenantId: string): Promise<readonly RetentionEvaluationRecord[]> {
    return this.rows.filter((r) => r.tenantId === tenantId).map((r) => ({ ...r, details: { ...r.details } }));
  }
}

@Injectable()
export class InMemoryCleanupPlanStore implements CleanupPlanStore {
  private readonly rows: CleanupPlanRecord[] = [];

  reset(): void {
    this.rows.length = 0;
  }

  async save(plan: CleanupPlanRecord): Promise<CleanupPlanRecord> {
    const copy: CleanupPlanRecord = {
      ...plan,
      createdAt: new Date(plan.createdAt),
      items: plan.items.map((i) => ({
        ...i,
        expiresAt: i.expiresAt ? new Date(i.expiresAt) : null,
      })),
      executed: false,
      details: { ...plan.details },
    };
    this.rows.push(copy);
    return copy;
  }

  async listByTenant(tenantId: string): Promise<readonly CleanupPlanRecord[]> {
    return this.rows
      .filter((r) => r.tenantId === tenantId)
      .map((r) => ({
        ...r,
        items: r.items.map((i) => ({ ...i })),
        details: { ...r.details },
        executed: false as const,
      }));
  }
}
