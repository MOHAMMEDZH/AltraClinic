import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class PatientRegisteredEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly branchId: string | null,
    public readonly patientId: string,
    public readonly patientName: string,
    public readonly gender: 'male' | 'female' | 'other' | null,
    public readonly dateOfBirth: string | null,
  ) {
    super();
  }
}
