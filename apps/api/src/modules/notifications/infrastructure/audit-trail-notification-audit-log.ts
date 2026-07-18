import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AuditEntryFactory } from '../../audit/domain/audit-entry.factory';
import { AuditEntryRepository } from '../../audit/domain/audit-entry.repository.interface';
import { AUDIT_ENTRY_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { NotificationAuditLog, NotificationAuditRecord } from '../application/ports/notification-audit-log.port';

@Injectable()
export class AuditTrailNotificationAuditLog implements NotificationAuditLog {
  private readonly factory = new AuditEntryFactory();

  constructor(@Inject(AUDIT_ENTRY_REPOSITORY) private readonly auditRepository: AuditEntryRepository) {}

  async record(entry: NotificationAuditRecord): Promise<void> {
    const auditEntry = this.factory.create(
      randomUUID(),
      entry.tenantId,
      entry.branchId,
      entry.locale ?? null,
      entry.action,
      'notifications.notification',
      entry.resourceId,
      entry.actorId,
      entry.actorRoles,
      entry.details ?? null,
      null,
      'notifications',
      entry.descriptionEn ?? null,
      entry.descriptionAr ?? null,
      entry.reason ?? null,
      null,
      null,
      null,
    );
    await this.auditRepository.save(auditEntry);
  }
}
