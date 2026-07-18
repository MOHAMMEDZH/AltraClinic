import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class NotificationCreatedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly branchId: string | null,
    public readonly notificationId: string,
    public readonly recipientId: string,
    public readonly channel: string,
    public readonly priority: string,
  ) {
    super();
  }
}
