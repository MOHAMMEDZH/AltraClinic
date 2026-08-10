import { randomUUID } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditEntryFactory } from '../../audit/domain/audit-entry.factory';
import { AuditEntryRepository } from '../../audit/domain/audit-entry.repository.interface';
import { AUDIT_ENTRY_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { BACKUP_RESTORE_LOG_KIND } from '../backup-restore.constants';

export interface BackupRestoreAuditRecord {
  tenantId: string;
  branchId?: string | null;
  action: string;
  jobId: string;
  actorId: string;
  actorRoles: string[];
  correlationId?: string | null;
  details?: Record<string, string> | null;
  reason?: string | null;
}

/**
 * Phase 43b — Audit via existing Audit platform (no redesign).
 */
@Injectable()
export class BackupRestoreAuditLog {
  private readonly logger = new Logger(BackupRestoreAuditLog.name);
  private readonly factory = new AuditEntryFactory();
  private readonly recorded: BackupRestoreAuditRecord[] = [];

  constructor(
    @Inject(AUDIT_ENTRY_REPOSITORY) private readonly auditRepository: AuditEntryRepository,
  ) {}

  drainRecorded() {
    const copy = [...this.recorded];
    this.recorded.length = 0;
    return copy;
  }

  async record(entry: BackupRestoreAuditRecord): Promise<void> {
    this.recorded.push(entry);
    this.logger.log(
      JSON.stringify({
        kind: BACKUP_RESTORE_LOG_KIND,
        component: 'audit',
        event: 'recorded',
        action: entry.action,
        jobId: entry.jobId,
        tenantId: entry.tenantId,
        correlationId: entry.correlationId ?? null,
      }),
    );

    try {
      const auditEntry = this.factory.create(
        randomUUID(),
        entry.tenantId,
        entry.branchId ?? null,
        null,
        entry.action,
        'backupRestore.job',
        entry.jobId,
        entry.actorId,
        entry.actorRoles.length ? entry.actorRoles : ['system'],
        entry.details ?? null,
        null,
        'backup_restore',
        null,
        null,
        entry.reason ?? null,
        null,
        null,
        entry.correlationId ?? null,
      );
      await this.auditRepository.save(auditEntry);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          kind: BACKUP_RESTORE_LOG_KIND,
          component: 'audit',
          event: 'persist_failed',
          jobId: entry.jobId,
          message: error instanceof Error ? error.message : 'unknown',
        }),
      );
    }
  }
}
