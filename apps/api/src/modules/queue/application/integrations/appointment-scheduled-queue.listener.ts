import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { DomainEvent } from '../../../../common/event.base';
import { AppointmentScheduledEvent } from '../../../scheduling/domain/events/appointment-scheduled.event';
import { DomainEventBus } from '../../../../infrastructure/domain-event-bus.service';
import { DomainEventHandler } from '../../../../infrastructure/domain-event-handler.interface';
import { EnqueueAppointmentHandler } from '../handlers/enqueue-appointment.handler';

@Injectable()
export class AppointmentScheduledQueueListener implements DomainEventHandler, OnModuleInit {
  constructor(
    @Optional() private readonly bus: DomainEventBus,
    private readonly enqueueAppointment: EnqueueAppointmentHandler,
  ) {}

  onModuleInit(): void {
    this.bus?.register(this);
  }

  async handle(event: DomainEvent): Promise<void> {
    if (!(event instanceof AppointmentScheduledEvent)) {
      return;
    }

    await this.enqueueAppointment.execute({
      tenantId: event.tenantId,
      branchId: event.branchId,
      appointmentId: event.appointmentId,
      patientId: event.patientId,
      providerId: event.providerId,
      start: event.start,
      end: event.end,
    });
  }
}
