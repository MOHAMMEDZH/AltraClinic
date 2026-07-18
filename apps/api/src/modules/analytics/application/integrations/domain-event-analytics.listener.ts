import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { DomainEvent } from '../../../../common/event.base';
import { DomainEventBus } from '../../../../infrastructure/domain-event-bus.service';
import { DomainEventHandler } from '../../../../infrastructure/domain-event-handler.interface';
import { RecordMetricHandler } from '../handlers/record-metric.handler';
import { RecordMetricCommand } from '../commands/record-metric.command';
import { PatientRegisteredEvent } from '../../../patients/domain/events/patient-registered.event';
import { EncounterCreatedEvent } from '../../../emr/domain/events/encounter-created.event';
import { AppointmentScheduledEvent } from '../../../scheduling/domain/events/appointment-scheduled.event';
import { InvoiceCreatedEvent } from '../../../billing/domain/events/invoice-created.event';
import { NotificationCreatedEvent } from '../../../notifications/domain/events/notification-created.event';

@Injectable()
export class DomainEventAnalyticsListener implements DomainEventHandler, OnModuleInit {
  constructor(
    @Optional() private readonly bus: DomainEventBus,
    private readonly recordMetric: RecordMetricHandler,
  ) {}

  onModuleInit(): void {
    this.bus?.register(this);
  }

  async handle(event: DomainEvent): Promise<void> {
    if (event instanceof PatientRegisteredEvent) {
      await this.recordMetric.execute(
        new RecordMetricCommand(
          event.tenantId,
          'patient_count',
          1,
          'system.integration',
          undefined,
          event.branchId ?? undefined,
          { source_event: 'PatientRegisteredEvent' },
        ),
      );
      return;
    }

    if (event instanceof AppointmentScheduledEvent) {
      await this.recordMetric.execute(
        new RecordMetricCommand(
          event.tenantId,
          'appointment_scheduled_count',
          1,
          'system.integration',
          undefined,
          event.branchId ?? undefined,
          { source_event: 'AppointmentScheduledEvent' },
        ),
      );
      return;
    }

    if (event instanceof EncounterCreatedEvent) {
      await this.recordMetric.execute(
        new RecordMetricCommand(
          event.tenantId,
          'encounter_count',
          1,
          'system.integration',
          undefined,
          event.branchId ?? undefined,
          { source_event: 'EncounterCreatedEvent' },
        ),
      );
      return;
    }

    if (event instanceof InvoiceCreatedEvent) {
      await this.recordMetric.execute(
        new RecordMetricCommand(
          event.tenantId,
          'revenue_total',
          event.amountTotal,
          'system.integration',
          undefined,
          event.branchId ?? undefined,
          { source_event: 'InvoiceCreatedEvent' },
        ),
      );
      return;
    }

    if (event instanceof NotificationCreatedEvent) {
      await this.recordMetric.execute(
        new RecordMetricCommand(
          event.tenantId,
          'notification_count',
          1,
          'system.integration',
          undefined,
          event.branchId ?? undefined,
          { source_event: 'NotificationCreatedEvent', channel: event.channel },
        ),
      );
    }
  }
}
