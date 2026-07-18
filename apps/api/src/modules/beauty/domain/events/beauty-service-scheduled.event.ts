import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class BeautyServiceScheduledEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly serviceId: string,
    public readonly patientId: string,
    public readonly clinicianId: string,
    public readonly serviceType: string,
    public readonly scheduledAtIso: string,
  ) {
    super();
  }
}
