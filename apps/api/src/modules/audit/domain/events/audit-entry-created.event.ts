import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class AuditEntryCreatedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly branchId: string | null,
    public readonly auditEntryId: string,
    public readonly action: string,
    public readonly resourceType: string,
    public readonly resourceId: string,
    public readonly actorId: string,
    public readonly correlationId: string | null,
  ) {
    super();
  }
}
