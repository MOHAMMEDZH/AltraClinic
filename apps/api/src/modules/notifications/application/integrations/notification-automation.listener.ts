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

import { SubscriptionCanceledEvent } from '../../../subscription/domain/events/subscription-canceled.event';

import {

  LoginFailedEvent,

  PasswordResetRequestedEvent,

  SuspiciousLoginEvent,

} from '../../../auth/domain/events/auth.events';

import { PortalAccountInvitedEvent } from '../../../patient-portal/domain/events/portal-account-invited.event';

import {

  AutomationEventContext,

  NotificationAutomationExecutorService,

} from '../services/notification-automation.executor';



@Injectable()

export class NotificationAutomationListener implements DomainEventHandler, OnModuleInit {

  constructor(

    @Optional() private readonly bus: DomainEventBus,

    private readonly executor: NotificationAutomationExecutorService,

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

  ): { eventType: string; context: AutomationEventContext } | null {

    if (event instanceof AppointmentScheduledEvent) {

      return {

        eventType: 'appointment.scheduled',

        context: {

          tenantId: event.tenantId,

          branchId: event.branchId,

          patientId: event.patientId,

          providerId: event.providerId,

          variables: { date: event.start, time: event.start },

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

          providerId: event.providerId,

          variables: { date: event.start, time: event.start },

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

          variables: { amount: String(event.amountTotal), invoiceNumber: event.invoiceId },

        },

      };

    }

    if (event instanceof InvoicePaymentRecordedEvent) {

      return {

        eventType: 'payment.received',

        context: {

          tenantId: event.tenantId,

          variables: { amount: String(event.amount), invoiceNumber: event.invoiceId },

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

        eventType: 'staff.invited',

        context: {

          tenantId: event.tenantId,

          branchId: event.branchId,

          userId: event.userId,

          variables: { email: event.email },

        },

      };

    }

    if (event instanceof PortalAccountInvitedEvent) {

      return {

        eventType: 'portal.invited',

        context: {

          tenantId: event.tenantId,

          branchId: event.branchId,

          patientId: event.patientId,

        },

      };

    }

    if (event instanceof SubscriptionCanceledEvent) {

      return {

        eventType: 'subscription.canceled',

        context: {

          tenantId: event.tenantId,

          branchId: event.branchId ?? null,

          userId: event.canceledBy,

          variables: { subscriptionId: event.subscriptionId },

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

    if (event instanceof LoginFailedEvent) {

      if (!event.tenantId) return null;

      return {

        eventType: 'security.failed_login',

        context: {

          tenantId: event.tenantId,

          variables: { email: event.email, reason: event.reason, ipAddress: event.ipAddress },

        },

      };

    }

    if (event instanceof PasswordResetRequestedEvent) {

      return {

        eventType: 'security.password_reset',

        context: {

          tenantId: event.tenantId,

          userId: event.userId,

          variables: { email: event.email },

        },

      };

    }

    return null;

  }

}

