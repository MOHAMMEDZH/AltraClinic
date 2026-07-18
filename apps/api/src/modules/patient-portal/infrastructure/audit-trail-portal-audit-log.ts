import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PortalAuditLog, PortalAuditRecord } from '../application/ports/portal-audit-log.port';
import { AuditEntryRepository } from '../../audit/domain/audit-entry.repository.interface';
import { AuditEntryFactory } from '../../audit/domain/audit-entry.factory';
import { AUDIT_ENTRY_REPOSITORY } from '../../../infrastructure/provider.tokens';

/**
 * Infrastructure adapter that fulfils the Patient Portal's {@link PortalAuditLog}
 * port by writing to the platform's central audit trail (the Audit bounded
 * context). The application layer depends only on the port, so this bridge can
 * be swapped without touching domain or use-case code (Dependency Inversion).
 */
@Injectable()
export class AuditTrailPortalAuditLog implements PortalAuditLog {
  private readonly factory = new AuditEntryFactory();

  constructor(
    @Inject(AUDIT_ENTRY_REPOSITORY) private readonly auditRepository: AuditEntryRepository,
  ) {}

  async record(entry: PortalAuditRecord): Promise<void> {
    const auditEntry = this.factory.create(
      randomUUID(),
      entry.tenantId,
      entry.branchId,
      entry.locale,
      entry.action,
      'patient_portal_account',
      entry.resourceId,
      entry.actorId,
      entry.actorRoles,
      entry.details,
      null,
      'patient_portal',
      null,
      null,
      entry.reason,
      null,
      null,
      entry.correlationId,
    );

    await this.auditRepository.save(auditEntry);
  }
}
