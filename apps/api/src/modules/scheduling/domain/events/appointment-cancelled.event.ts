import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class AppointmentCancelledEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly branchId: string | null,
    public readonly appointmentId: string,
    public readonly patientId: string,
    public readonly providerId: string,
    public readonly start: string,
    public readonly end: string,
  ) {
    super();
  }
}
