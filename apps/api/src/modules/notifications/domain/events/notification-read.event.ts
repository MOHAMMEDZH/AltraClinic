import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class NotificationReadEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly branchId: string | null,
    public readonly notificationId: string,
    public readonly recipientId: string,
  ) {
    super();
  }
}
