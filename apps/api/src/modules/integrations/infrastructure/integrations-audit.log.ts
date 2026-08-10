import { randomUUID } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditEntryFactory } from '../../audit/domain/audit-entry.factory';
import { AuditEntryRepository } from '../../audit/domain/audit-entry.repository.interface';
import { AUDIT_ENTRY_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { INTEGRATIONS_LOG_KIND } from '../integrations.constants';
import { redactCredentialSecrets } from '../domain/credential-hashing';

export interface IntegrationsAuditRecord {
  tenantId: string;
  branchId?: string | null;
  action: string;
  resourceId: string;
  actorId: string;
  actorRoles: string[];
  correlationId?: string | null;
  causationId?: string | null;
  details?: Record<string, string> | null;
  reason?: string | null;
}

/**
 * Phase 44b — Audit via existing Audit platform. Never records raw credentials.
 */
@Injectable()
export class IntegrationsAuditLog {
  private readonly logger = new Logger(IntegrationsAuditLog.name);
  private readonly factory = new AuditEntryFactory();
  private readonly recorded: IntegrationsAuditRecord[] = [];

  constructor(
    @Inject(AUDIT_ENTRY_REPOSITORY)
    private readonly auditRepository: AuditEntryRepository,
  ) {}

  drainRecorded() {
    const copy = [...this.recorded];
    this.recorded.length = 0;
    return copy;
  }

  async record(entry: IntegrationsAuditRecord): Promise<void> {
    const details = entry.details
      ? Object.fromEntries(
          Object.entries(entry.details).map(([k, v]) => [
            k,
            redactCredentialSecrets(String(v)),
          ]),
        )
      : null;

    const safe: IntegrationsAuditRecord = {
      ...entry,
      details,
      reason: entry.reason
        ? redactCredentialSecrets(entry.reason)
        : null,
    };
    this.recorded.push(safe);

    this.logger.log(
      JSON.stringify({
        kind: INTEGRATIONS_LOG_KIND,
        component: 'audit',
        event: 'recorded',
        action: safe.action,
        resourceId: safe.resourceId,
        tenantId: safe.tenantId,
        correlationId: safe.correlationId ?? null,
      }),
    );

    try {
      const auditEntry = this.factory.create(
        randomUUID(),
        safe.tenantId,
        safe.branchId ?? null,
        null,
        safe.action,
        'integrations.credential',
        safe.resourceId,
        safe.actorId,
        safe.actorRoles.length ? safe.actorRoles : ['system'],
        safe.details ?? null,
        null,
        'integrations',
        null,
        null,
        safe.reason ?? null,
        null,
        null,
        safe.correlationId ?? null,
      );
      await this.auditRepository.save(auditEntry);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          kind: INTEGRATIONS_LOG_KIND,
          component: 'audit',
          event: 'persist_failed',
          resourceId: safe.resourceId,
          message: redactCredentialSecrets(
            error instanceof Error ? error.message : 'unknown',
          ),
        }),
      );
    }
  }
}
