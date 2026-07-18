import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { DomainEvent } from '../../../../common/event.base';
import { DomainEventBus } from '../../../../infrastructure/domain-event-bus.service';
import { DomainEventHandler } from '../../../../infrastructure/domain-event-handler.interface';
import { AppointmentScheduledEvent } from '../../../scheduling/domain/events/appointment-scheduled.event';
import { PatientRegisteredEvent } from '../../../patients/domain/events/patient-registered.event';
import { NotificationCreatedEvent } from '../../../notifications/domain/events/notification-created.event';
import { WorkflowCreatedEvent } from '../../../workflow/domain/events/workflow-created.event';
import { WorkflowAdvancedEvent } from '../../../workflow/domain/events/workflow-advanced.event';
import { WorkflowCanceledEvent } from '../../../workflow/domain/events/workflow-canceled.event';
import { RealtimeBroadcastService } from '../services/realtime-broadcast.service';
import { RealtimeDashboardService } from '../services/realtime-dashboard.service';
import { RealtimeChannel } from '../../domain/realtime.types';

/**
 * Fans out domain events to WebSocket clients via RealtimeBroadcastService.
 * Registered on DomainEventBus — same path as outbox dispatch (reliable delivery).
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Subscribe to Redis Pub/Sub instead of in-process bus."
 *   Counter: In-process bus is already invoked by OutboxEventPublisher after
 *   DB commit. Adding Redis Pub/Sub duplicates the outbox guarantee. When scaling
 *   to multiple API nodes, the outbox processor + Redis adapter handles fan-out.
 */
@Injectable()
export class RealtimeDomainEventListener implements DomainEventHandler, OnModuleInit {
  private readonly logger = new Logger(RealtimeDomainEventListener.name);

  constructor(
    @Optional() private readonly bus: DomainEventBus,
    private readonly broadcast: RealtimeBroadcastService,
    private readonly dashboard: RealtimeDashboardService,
  ) {}

  onModuleInit(): void {
    this.bus?.register(this);
  }

  async handle(event: DomainEvent): Promise<void> {
    if (event instanceof AppointmentScheduledEvent) {
      await this.onAppointmentScheduled(event);
      return;
    }

    if (event instanceof PatientRegisteredEvent) {
      await this.onPatientRegistered(event);
      return;
    }

    if (event instanceof NotificationCreatedEvent) {
      await this.onNotificationCreated(event);
      return;
    }

    if (event instanceof WorkflowCreatedEvent) {
      await this.onWorkflowCreated(event);
      return;
    }

    if (event instanceof WorkflowAdvancedEvent) {
      await this.onWorkflowAdvanced(event);
      return;
    }

    if (event instanceof WorkflowCanceledEvent) {
      await this.onWorkflowCanceled(event);
      return;
    }
  }

  private async onAppointmentScheduled(event: AppointmentScheduledEvent): Promise<void> {
    const base = {
      eventId: event.eventId,
      tenantId: event.tenantId,
      branchId: event.branchId,
      payload: {
        appointmentId: event.appointmentId,
        patientId: event.patientId,
        providerId: event.providerId,
        start: event.start,
        end: event.end,
      },
    };

    await this.broadcast.publish({
      ...base,
      channel: 'appointments' as RealtimeChannel,
      type: 'appointment.scheduled',
    });

    await this.broadcast.publish({
      ...base,
      channel: 'queue' as RealtimeChannel,
      type: 'queue.enqueued',
      payload: {
        ...base.payload,
        action: 'enqueued',
        status: 'waiting',
      },
    });

    await this.pushDashboardUpdate(event.tenantId, event.branchId);
  }

  private async onPatientRegistered(event: PatientRegisteredEvent): Promise<void> {
    await this.broadcast.publish({
      eventId: event.eventId,
      tenantId: event.tenantId,
      branchId: event.branchId,
      channel: 'patients',
      type: 'patient.registered',
      payload: {
        patientId: event.patientId,
        patientName: event.patientName,
        status: 'registered',
        gender: event.gender,
        dateOfBirth: event.dateOfBirth,
      },
    });

    await this.pushDashboardUpdate(event.tenantId, event.branchId);
  }

  private async onNotificationCreated(event: NotificationCreatedEvent): Promise<void> {
    await this.broadcast.publish(
      {
        eventId: event.eventId,
        tenantId: event.tenantId,
        branchId: event.branchId,
        channel: 'notifications',
        type: 'notification.created',
        payload: {
          notificationId: event.notificationId,
          recipientId: event.recipientId,
          channel: event.channel,
          priority: event.priority,
        },
      },
      { targetUserId: event.recipientId },
    );
  }

  private async onWorkflowCreated(event: WorkflowCreatedEvent): Promise<void> {
    await this.broadcast.publish({
      eventId: event.eventId,
      tenantId: event.tenantId,
      branchId: event.branchId ?? null,
      channel: 'workflows',
      type: 'workflow.created',
      payload: {
        workflowId: event.workflowId,
        nameEn: event.nameEn,
        createdBy: event.createdBy,
      },
    });
  }

  private async onWorkflowAdvanced(event: WorkflowAdvancedEvent): Promise<void> {
    await this.broadcast.publish({
      eventId: event.eventId,
      tenantId: event.tenantId,
      branchId: null,
      channel: 'workflows',
      type: 'workflow.advanced',
      payload: {
        workflowId: event.workflowId,
        currentStepIndex: event.currentStepIndex,
        status: event.status,
        actionedBy: event.actionedBy,
      },
    });
  }

  private async onWorkflowCanceled(event: WorkflowCanceledEvent): Promise<void> {
    await this.broadcast.publish({
      eventId: event.eventId,
      tenantId: event.tenantId,
      branchId: null,
      channel: 'workflows',
      type: 'workflow.canceled',
      payload: {
        workflowId: event.workflowId,
        canceledBy: event.canceledBy,
        reason: event.reason,
      },
    });
  }

  private async pushDashboardUpdate(tenantId: string, branchId: string | null): Promise<void> {
    try {
      const snapshot = await this.dashboard.getSnapshot(tenantId);
      await this.broadcast.publish({
        eventId: `dashboard-${Date.now()}`,
        tenantId,
        branchId,
        channel: 'dashboard',
        type: 'dashboard.metrics_updated',
        payload: snapshot as unknown as Record<string, unknown>,
      });
    } catch (err) {
      this.logger.warn(`Dashboard snapshot failed: ${(err as Error).message}`);
    }
  }
}
