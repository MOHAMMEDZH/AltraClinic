import { randomUUID } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditEntryFactory } from '../../audit/domain/audit-entry.factory';
import { AuditEntryRepository } from '../../audit/domain/audit-entry.repository.interface';
import { AUDIT_ENTRY_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { IMPORT_EXPORT_LOG_KIND } from '../import-export.constants';

export interface ImportExportAuditRecord {
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
 * Phase 42c — Audit emit via existing Audit platform (no redesign).
 */
@Injectable()
export class ImportExportAuditLog {
  private readonly logger = new Logger(ImportExportAuditLog.name);
  private readonly factory = new AuditEntryFactory();
  private readonly recorded: ImportExportAuditRecord[] = [];

  constructor(
    @Inject(AUDIT_ENTRY_REPOSITORY) private readonly auditRepository: AuditEntryRepository,
  ) {}

  drainRecorded() {
    const copy = [...this.recorded];
    this.recorded.length = 0;
    return copy;
  }

  async record(entry: ImportExportAuditRecord): Promise<void> {
    this.recorded.push(entry);
    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
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
        'importExport.job',
        entry.jobId,
        entry.actorId,
        entry.actorRoles.length ? entry.actorRoles : ['system'],
        entry.details ?? null,
        null,
        'import_export',
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
          kind: IMPORT_EXPORT_LOG_KIND,
          component: 'audit',
          event: 'persist_failed',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}
