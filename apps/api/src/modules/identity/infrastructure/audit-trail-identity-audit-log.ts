import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AuditEntryFactory } from '../../audit/domain/audit-entry.factory';
import { AuditEntryRepository } from '../../audit/domain/audit-entry.repository.interface';
import { AUDIT_ENTRY_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { IdentityAuditLog, IdentityAuditRecord } from '../application/ports/identity-audit-log.port';

@Injectable()
export class AuditTrailIdentityAuditLog implements IdentityAuditLog {
  private readonly factory = new AuditEntryFactory();

  constructor(@Inject(AUDIT_ENTRY_REPOSITORY) private readonly auditRepository: AuditEntryRepository) {}

  async record(entry: IdentityAuditRecord): Promise<void> {
    const auditEntry = this.factory.create(
      randomUUID(),
      entry.tenantId,
      entry.branchId,
      entry.locale,
      entry.action,
      'identity.user',
      entry.resourceId,
      entry.actorId,
      entry.actorRoles,
      entry.details ?? null,
      entry.changes ?? null,
      'identity',
      entry.descriptionEn ?? null,
      entry.descriptionAr ?? null,
      entry.reason ?? null,
      entry.ipAddress ?? null,
      entry.userAgent ?? null,
      entry.correlationId ?? null,
    );

    await this.auditRepository.save(auditEntry);
  }
}
