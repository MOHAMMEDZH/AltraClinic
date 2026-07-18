import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class EncounterCreatedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly branchId: string | null,
    public readonly encounterId: string,
    public readonly patientId: string,
    public readonly clinicianId: string,
  ) {
    super();
  }
}
