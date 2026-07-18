import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

/**
 * Common envelope for all Super Admin Platform domain events (EVENTS.md §Common
 * Event Envelope): the governed tenant's id, the platform-tenant aggregate
 * identity, a stable past-tense name and a contract version. `eventId` and
 * `occurredAt` are supplied by {@link BaseDomainEvent} (unique per instance via
 * randomUUID).
 */
export abstract class PlatformAdminDomainEvent extends BaseDomainEvent {
  abstract readonly eventName: string;
  readonly eventVersion: number = 1;
  readonly aggregateType: string = 'PlatformTenant';

  protected constructor(
    public readonly tenantId: string,
    public readonly platformTenantId: string,
  ) {
    super();
  }
}
