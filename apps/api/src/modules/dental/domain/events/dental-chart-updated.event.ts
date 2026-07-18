import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class DentalChartUpdatedEvent extends BaseDomainEvent {
  constructor(public readonly tenantId: string, public readonly patientId: string, public readonly chartId: string, public readonly changes: unknown) {
    super();
  }
}
