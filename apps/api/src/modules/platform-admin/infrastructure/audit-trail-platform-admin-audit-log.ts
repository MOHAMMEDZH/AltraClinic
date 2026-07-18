import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  PlatformAdminAuditLog,
  PlatformAdminAuditRecord,
} from '../application/ports/platform-admin-audit-log.port';
import { AuditEntryRepository } from '../../audit/domain/audit-entry.repository.interface';
import { AuditEntryFactory } from '../../audit/domain/audit-entry.factory';
import { AUDIT_ENTRY_REPOSITORY } from '../../../infrastructure/provider.tokens';

/**
 * Infrastructure adapter that fulfils the Super Admin Platform's
 * {@link PlatformAdminAuditLog} port by writing to the platform's central audit
 * trail (the Audit bounded context). The application layer depends only on the
 * port, so this bridge can be swapped without touching domain or use-case code
 * (Dependency Inversion).
 *
 * The governed tenant's id is recorded as the audit entry's tenant so privileged
 * platform-operator activity is attributable per tenant (TENANCY.md — audit of
 * privileged support activity). Bilingual descriptions are forwarded for a
 * localizable (ar/en) trail.
 */
@Injectable()
export class AuditTrailPlatformAdminAuditLog implements PlatformAdminAuditLog {
  private readonly factory = new AuditEntryFactory();

  constructor(
    @Inject(AUDIT_ENTRY_REPOSITORY) private readonly auditRepository: AuditEntryRepository,
  ) {}

  async record(entry: PlatformAdminAuditRecord): Promise<void> {
    const auditEntry = this.factory.create(
      randomUUID(),
      entry.tenantId,
      null,
      entry.locale,
      entry.action,
      'platform_tenant',
      entry.resourceId,
      entry.actorId,
      entry.actorRoles,
      entry.details,
      null,
      'platform_admin',
      entry.descriptionEn,
      entry.descriptionAr,
      entry.reason,
      null,
      null,
      entry.correlationId,
    );

    await this.auditRepository.save(auditEntry);
  }
}
