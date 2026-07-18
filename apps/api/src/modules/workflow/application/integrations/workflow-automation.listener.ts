import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { DomainEvent } from '../../../../common/event.base';
import { DomainEventBus } from '../../../../infrastructure/domain-event-bus.service';
import { DomainEventHandler } from '../../../../infrastructure/domain-event-handler.interface';
import { AppointmentScheduledEvent } from '../../../scheduling/domain/events/appointment-scheduled.event';
import { AppointmentCancelledEvent } from '../../../scheduling/domain/events/appointment-cancelled.event';
import { InvoiceCreatedEvent } from '../../../billing/domain/events/invoice-created.event';
import { InvoicePaymentRecordedEvent } from '../../../billing/domain/events/invoice-payment-recorded.event';
import { PatientRegisteredEvent } from '../../../patients/domain/events/patient-registered.event';
import { UserRegisteredEvent } from '../../../identity/domain/events/user-registered.event';
import { SuspiciousLoginEvent } from '../../../auth/domain/events/auth.events';
import {
  WorkflowAutomationContext,
  WorkflowAutomationExecutorService,
} from '../services/workflow-automation.executor';

@Injectable()
export class WorkflowAutomationListener implements DomainEventHandler, OnModuleInit {
  constructor(
    @Optional() private readonly bus: DomainEventBus,
    private readonly executor: WorkflowAutomationExecutorService,
  ) {}

  onModuleInit(): void {
    this.bus?.register(this);
  }

  async handle(event: DomainEvent): Promise<void> {
    const resolved = this.resolveEvent(event);
    if (!resolved) return;
    await this.executor.executeForEventType(resolved.eventType, resolved.context);
  }

  private resolveEvent(
    event: DomainEvent,
  ): { eventType: string; context: WorkflowAutomationContext } | null {
    if (event instanceof AppointmentScheduledEvent) {
      return {
        eventType: 'appointment.created',
        context: {
          tenantId: event.tenantId,
          branchId: event.branchId,
          patientId: event.patientId,
          userId: event.providerId,
          variables: { date: String(event.start) },
        },
      };
    }
    if (event instanceof AppointmentCancelledEvent) {
      return {
        eventType: 'appointment.cancelled',
        context: {
          tenantId: event.tenantId,
          branchId: event.branchId,
          patientId: event.patientId,
        },
      };
    }
    if (event instanceof InvoiceCreatedEvent) {
      return {
        eventType: 'invoice.created',
        context: {
          tenantId: event.tenantId,
          branchId: event.branchId,
          patientId: event.patientId,
          variables: { amount: String(event.amountTotal) },
        },
      };
    }
    if (event instanceof InvoicePaymentRecordedEvent) {
      return {
        eventType: 'payment.received',
        context: {
          tenantId: event.tenantId,
          variables: { amount: String(event.amount) },
        },
      };
    }
    if (event instanceof PatientRegisteredEvent) {
      return {
        eventType: 'patient.registered',
        context: {
          tenantId: event.tenantId,
          branchId: event.branchId,
          patientId: event.patientId,
          variables: { patientName: event.patientName },
        },
      };
    }
    if (event instanceof UserRegisteredEvent) {
      return {
        eventType: 'user.created',
        context: {
          tenantId: event.tenantId,
          branchId: event.branchId,
          userId: event.userId,
          variables: { email: event.email },
        },
      };
    }
    if (event instanceof SuspiciousLoginEvent) {
      return {
        eventType: 'security.alert',
        context: {
          tenantId: event.tenantId,
          userId: event.userId,
          variables: { reason: event.reason, ipAddress: event.ipAddress },
        },
      };
    }
    return null;
  }
}
