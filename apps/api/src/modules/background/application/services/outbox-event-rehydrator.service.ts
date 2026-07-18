import { Injectable } from '@nestjs/common';
import { DomainEvent } from '../../../../common/event.base';
import { NotificationCreatedEvent } from '../../../notifications/domain/events/notification-created.event';
import { AppointmentScheduledEvent } from '../../../scheduling/domain/events/appointment-scheduled.event';
import { AppointmentCancelledEvent } from '../../../scheduling/domain/events/appointment-cancelled.event';
import { PatientRegisteredEvent } from '../../../patients/domain/events/patient-registered.event';
import { UserRegisteredEvent } from '../../../identity/domain/events/user-registered.event';
import { InvoiceCreatedEvent } from '../../../billing/domain/events/invoice-created.event';
import { InventoryItemCreatedEvent } from '../../../inventory/domain/events/inventory-item-created.event';
import { InventoryConsumedEvent } from '../../../inventory/domain/events/inventory-consumed.event';
import { AuditEntryCreatedEvent } from '../../../audit/domain/events/audit-entry-created.event';
import { TenantCreatedEvent } from '../../../tenant/domain/events/tenant-created.event';

type EventConstructor = new (...args: unknown[]) => DomainEvent;

/**
 * Reconstructs domain event prototypes from outbox JSON payloads.
 * Handlers rely on `instanceof` checks — plain JSON objects fail without rehydration.
 */
@Injectable()
export class OutboxEventRehydratorService {
  private readonly registry = new Map<string, EventConstructor>([
    ['NotificationCreatedEvent', NotificationCreatedEvent as EventConstructor],
    ['AppointmentScheduledEvent', AppointmentScheduledEvent as EventConstructor],
    ['AppointmentCancelledEvent', AppointmentCancelledEvent as EventConstructor],
    ['PatientRegisteredEvent', PatientRegisteredEvent as EventConstructor],
    ['UserRegisteredEvent', UserRegisteredEvent as EventConstructor],
    ['InvoiceCreatedEvent', InvoiceCreatedEvent as EventConstructor],
    ['InventoryItemCreatedEvent', InventoryItemCreatedEvent as EventConstructor],
    ['InventoryConsumedEvent', InventoryConsumedEvent as EventConstructor],
    ['AuditEntryCreatedEvent', AuditEntryCreatedEvent as EventConstructor],
    ['TenantCreatedEvent', TenantCreatedEvent as EventConstructor],
  ]);

  rehydrate(eventType: string, payload: Record<string, unknown>): DomainEvent | null {
    const Ctor = this.registry.get(eventType);
    if (!Ctor) return null;
    return Object.assign(Object.create(Ctor.prototype), payload) as DomainEvent;
  }

  /** Exposed for tests and future registry extension. */
  register(eventType: string, ctor: EventConstructor): void {
    this.registry.set(eventType, ctor);
  }

  knownEventTypes(): string[] {
    return [...this.registry.keys()];
  }
}
