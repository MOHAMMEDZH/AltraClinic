import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { DomainEvent } from '../../../../common/event.base';
import { DomainEventBus } from '../../../../infrastructure/domain-event-bus.service';
import { DomainEventHandler } from '../../../../infrastructure/domain-event-handler.interface';
import { NotificationIntentProducerService } from '../../delivery/notification-intent-producer.service';
import { PatientRegisteredEvent } from '../../../patients/domain/events/patient-registered.event';
import { EncounterCreatedEvent } from '../../../emr/domain/events/encounter-created.event';
import { InvoiceCreatedEvent } from '../../../billing/domain/events/invoice-created.event';
import { AppointmentScheduledEvent } from '../../../scheduling/domain/events/appointment-scheduled.event';
import { SubscriptionCanceledEvent } from '../../../subscription/domain/events/subscription-canceled.event';

const PRODUCER_MODULE_ID = 'notifications.domain-event-listener';

@Injectable()
export class DomainEventNotificationListener implements DomainEventHandler, OnModuleInit {
  constructor(
    @Optional() private readonly bus: DomainEventBus,
    private readonly producer: NotificationIntentProducerService,
  ) {}

  onModuleInit(): void {
    this.bus?.register(this);
  }

  async handle(event: DomainEvent): Promise<void> {
    if (event instanceof AppointmentScheduledEvent) {
      await this.producer.produceInApp({
        tenantId: event.tenantId,
        branchId: event.branchId,
        recipientId: event.patientId,
        title: 'Appointment scheduled',
        body: `Your appointment was scheduled for ${event.start}`,
        priority: 'medium',
        idempotencyKey: `domain-event:${event.eventId}`,
        producerModuleId: PRODUCER_MODULE_ID,
      });
      return;
    }

    if (event instanceof InvoiceCreatedEvent) {
      await this.producer.produceInApp({
        tenantId: event.tenantId,
        branchId: event.branchId,
        recipientId: event.patientId,
        title: 'Invoice created',
        body: `Invoice ${event.invoiceId} has been issued with total ${event.amountTotal}.`,
        priority: 'high',
        idempotencyKey: `domain-event:${event.eventId}`,
        producerModuleId: PRODUCER_MODULE_ID,
      });
      return;
    }

    if (event instanceof EncounterCreatedEvent) {
      await this.producer.produceInApp({
        tenantId: event.tenantId,
        branchId: event.branchId,
        recipientId: event.patientId,
        title: 'Encounter recorded',
        body: 'A new clinical encounter has been recorded in your medical timeline.',
        priority: 'medium',
        idempotencyKey: `domain-event:${event.eventId}`,
        producerModuleId: PRODUCER_MODULE_ID,
      });
      return;
    }

    if (event instanceof PatientRegisteredEvent) {
      await this.producer.produceInApp({
        tenantId: event.tenantId,
        branchId: event.branchId,
        recipientId: event.patientId,
        title: 'Welcome to the clinic platform',
        body: `Welcome ${event.patientName}. Your patient profile has been created.`,
        priority: 'low',
        idempotencyKey: `domain-event:${event.eventId}`,
        producerModuleId: PRODUCER_MODULE_ID,
      });
      return;
    }

    if (event instanceof SubscriptionCanceledEvent) {
      await this.producer.produceInApp({
        tenantId: event.tenantId,
        branchId: event.branchId ?? null,
        recipientId: event.subscriptionId,
        title: 'Subscription canceled',
        body: `Subscription ${event.subscriptionId} has been canceled.`,
        priority: 'high',
        idempotencyKey: `domain-event:${event.eventId}`,
        producerModuleId: PRODUCER_MODULE_ID,
      });
    }
  }
}
