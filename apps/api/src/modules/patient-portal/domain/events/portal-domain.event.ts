import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

/**
 * Common envelope for all Patient Portal domain events (EVENTS.md §Common Event
 * Envelope): tenant metadata, aggregate identity, a stable past-tense name and a
 * contract version. `eventId` and `occurredAt` are supplied by
 * {@link BaseDomainEvent} (unique per instance via randomUUID).
 */
export abstract class PortalDomainEvent extends BaseDomainEvent {
  abstract readonly eventName: string;
  readonly eventVersion: number = 1;
  readonly aggregateType: string = 'PortalAccount';

  protected constructor(
    public readonly tenantId: string,
    public readonly branchId: string | null,
    public readonly portalAccountId: string,
    public readonly patientId: string,
  ) {
    super();
  }
}
