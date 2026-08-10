import { Injectable } from '@nestjs/common';
import type {
  LogicalRestoreScratchRecord,
  RestoreResultRecord,
} from '../domain/restore/restore-engine.types';

export const RESTORE_RESULT_STORE = Symbol('RESTORE_RESULT_STORE');
export const RESTORE_SCRATCH_STORE = Symbol('RESTORE_SCRATCH_STORE');

export interface RestoreResultStore {
  save(result: RestoreResultRecord): Promise<RestoreResultRecord>;
  findById(tenantId: string, id: string): Promise<RestoreResultRecord | null>;
  listByTenant(tenantId: string): Promise<readonly RestoreResultRecord[]>;
  listByJob(tenantId: string, jobId: string): Promise<readonly RestoreResultRecord[]>;
}

export interface RestoreScratchStore {
  save(record: LogicalRestoreScratchRecord): Promise<LogicalRestoreScratchRecord>;
  findByRestoreId(
    tenantId: string,
    restoreId: string,
  ): Promise<LogicalRestoreScratchRecord | null>;
}

@Injectable()
export class InMemoryRestoreResultStore implements RestoreResultStore {
  private readonly rows = new Map<string, RestoreResultRecord>();

  reset(): void {
    this.rows.clear();
  }

  async save(result: RestoreResultRecord): Promise<RestoreResultRecord> {
    const copy: RestoreResultRecord = {
      ...result,
      stagesCompleted: [...result.stagesCompleted],
      restoredObjects: result.restoredObjects.map((o) => ({ ...o })),
      warnings: [...result.warnings],
      validation: {
        ...result.validation,
        reasons: [...result.validation.reasons],
      },
      target: { ...result.target },
      createdAt: new Date(result.createdAt),
      completedAt: result.completedAt ? new Date(result.completedAt) : null,
      details: { ...result.details },
    };
    this.rows.set(result.id, copy);
    return copy;
  }

  async findById(tenantId: string, id: string): Promise<RestoreResultRecord | null> {
    const row = this.rows.get(id);
    if (!row || row.tenantId !== tenantId) return null;
    return this.clone(row);
  }

  async listByTenant(tenantId: string): Promise<readonly RestoreResultRecord[]> {
    return [...this.rows.values()]
      .filter((r) => r.tenantId === tenantId)
      .map((r) => this.clone(r));
  }

  async listByJob(tenantId: string, jobId: string): Promise<readonly RestoreResultRecord[]> {
    return [...this.rows.values()]
      .filter((r) => r.tenantId === tenantId && r.jobId === jobId)
      .map((r) => this.clone(r));
  }

  private clone(row: RestoreResultRecord): RestoreResultRecord {
    return {
      ...row,
      stagesCompleted: [...row.stagesCompleted],
      restoredObjects: row.restoredObjects.map((o) => ({ ...o })),
      warnings: [...row.warnings],
      validation: {
        ...row.validation,
        reasons: [...row.validation.reasons],
      },
      target: { ...row.target },
      createdAt: new Date(row.createdAt),
      completedAt: row.completedAt ? new Date(row.completedAt) : null,
      details: { ...row.details },
    };
  }
}

@Injectable()
export class InMemoryRestoreScratchStore implements RestoreScratchStore {
  private readonly rows = new Map<string, LogicalRestoreScratchRecord>();

  reset(): void {
    this.rows.clear();
  }

  async save(record: LogicalRestoreScratchRecord): Promise<LogicalRestoreScratchRecord> {
    const copy: LogicalRestoreScratchRecord = {
      ...record,
      logicalDataKeys: [...record.logicalDataKeys],
      entityCounts: { ...record.entityCounts },
      restoredAt: new Date(record.restoredAt),
    };
    this.rows.set(`${record.tenantId}:${record.restoreId}`, copy);
    return copy;
  }

  async findByRestoreId(
    tenantId: string,
    restoreId: string,
  ): Promise<LogicalRestoreScratchRecord | null> {
    const row = this.rows.get(`${tenantId}:${restoreId}`);
    if (!row) return null;
    return {
      ...row,
      logicalDataKeys: [...row.logicalDataKeys],
      entityCounts: { ...row.entityCounts },
      restoredAt: new Date(row.restoredAt),
    };
  }
}
