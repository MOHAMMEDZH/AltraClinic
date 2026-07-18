import { Inject, Injectable } from '@nestjs/common';
import { CreateAuditEntryCommand } from '../commands/create-audit-entry.command';
import { AuditEntryRepository } from '../../domain/audit-entry.repository.interface';
import { AUDIT_ENTRY_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { AuditEntryFactory } from '../../domain/audit-entry.factory';
import { AuditEntryCreatedEvent } from '../../domain/events/audit-entry-created.event';

function genId(): string {
  return typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function'
    ? (crypto as any).randomUUID()
    : `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

@Injectable()
export class CreateAuditEntryHandler {
  private readonly factory = new AuditEntryFactory();

  constructor(
    @Inject(AUDIT_ENTRY_REPOSITORY) private readonly repository: AuditEntryRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: CreateAuditEntryCommand): Promise<{ auditEntryId: string }> {
    const tenant = await this.tenantContext.resolve();
    const id = genId();

    const auditEntry = this.factory.create(
      id,
      tenant.tenantId,
      tenant.branchId ?? null,
      tenant.locale ?? null,
      command.action,
      command.resourceType,
      command.resourceId,
      command.actorId,
      command.actorRoles,
      command.details,
      command.changes,
      command.category,
      command.descriptionEn,
      command.descriptionAr,
      command.reason,
      command.ipAddress,
      command.userAgent,
      command.correlationId,
    );

    await this.repository.save(auditEntry);
    await this.eventPublisher.publish(
      new AuditEntryCreatedEvent(
        tenant.tenantId,
        tenant.branchId ?? null,
        id,
        command.action,
        command.resourceType,
        command.resourceId,
        command.actorId,
        command.correlationId,
      ),
    );

    return { auditEntryId: id };
  }
}
