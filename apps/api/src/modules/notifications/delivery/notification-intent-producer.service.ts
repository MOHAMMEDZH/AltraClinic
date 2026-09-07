import { Inject, Injectable } from '@nestjs/common';
import { EVENT_PUBLISHER } from '../../../infrastructure/provider.tokens';
import { EventPublisherInterface } from '../../../infrastructure/event-publisher.interface';
import { NotificationCreatedEvent } from '../domain/events/notification-created.event';
import { DeliveryOrchestratorService, DeliveryResult } from './delivery-orchestrator.service';
import { IntentInput, NotificationChannelId, NotificationPriority } from './delivery.types';

export interface NotificationIntentProducerResult {
  intentId: string;
  notificationId?: string | null;
}

export interface ProduceBaseParams {
  tenantId: string;
  branchId?: string | null;
  recipientId: string;
  recipientType?: 'user' | 'patient' | 'platform_user';
  title: string;
  body: string;
  titleAr?: string | null;
  bodyAr?: string | null;
  priority?: NotificationPriority;
  notificationTypeId?: string;
  category?: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
  causationId?: string;
  journeyInstanceId?: string;
  workflowInstanceId?: string;
  /** Identifies the calling module (e.g. 'background.appointment-reminders',
   * 'queue.notifications') for audit/observability — required so a delivery can always be
   * traced back to its producer. */
  producerModuleId: string;
  transactional?: boolean;
}

export interface ProduceEmailParams extends ProduceBaseParams {
  recipientEmail: string;
}

export interface ProduceChannelsParams extends ProduceBaseParams {
  channels: NotificationChannelId[];
}

/**
 * Phase 41e — the ONLY sanctioned entrypoint into DeliveryOrchestratorService for producers
 * other than the user-facing compose/API path (CreateNotificationHandler). Every notification
 * producer in the system must go through this service or CreateNotificationHandler; direct
 * `Notification.create` + repository persistence, or direct `TransactionalEmailService.send`,
 * bypasses consent evaluation, preference gating, quiet-hours deferral and channel-availability
 * fail-closed checks in the orchestrator and is therefore forbidden for send paths.
 *
 * Deliberately thin: it only shapes an `IntentInput` (tagging `metadata.deliveryEngine='41d'`
 * and `metadata.producerModuleId`) and republishes `NotificationCreatedEvent` for realtime/inbox
 * fan-out when the orchestrator produced a legacy `Notification` row — mirroring what
 * `CreateNotificationHandler` already does for the compose path.
 */
@Injectable()
export class NotificationIntentProducerService {
  constructor(
    private readonly orchestrator: DeliveryOrchestratorService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async produceInApp(params: ProduceBaseParams): Promise<NotificationIntentProducerResult> {
    return this.produce({ ...params, channels: ['in-app'] });
  }

  async produceEmail(params: ProduceEmailParams): Promise<NotificationIntentProducerResult> {
    const { recipientEmail, metadata, ...rest } = params;
    return this.produce({
      ...rest,
      channels: ['email'],
      metadata: { ...(metadata ?? {}), recipientEmail },
    });
  }

  async produceChannels(params: ProduceChannelsParams): Promise<NotificationIntentProducerResult> {
    const { channels, ...rest } = params;
    return this.produce({ ...rest, channels });
  }

  private async produce(
    params: ProduceBaseParams & { channels: NotificationChannelId[] },
  ): Promise<NotificationIntentProducerResult> {
    const intentInput: IntentInput = {
      tenantId: params.tenantId,
      branchId: params.branchId ?? null,
      recipientId: params.recipientId,
      recipientType: params.recipientType,
      requestedChannels: params.channels,
      notificationTypeId: params.notificationTypeId ?? null,
      category: params.category ?? null,
      transactional: params.transactional,
      priority: params.priority ?? 'medium',
      title: params.title,
      body: params.body,
      titleAr: params.titleAr,
      bodyAr: params.bodyAr,
      idempotencyKey: params.idempotencyKey,
      correlationId: params.correlationId,
      causationId: params.causationId,
      journeyInstanceId: params.journeyInstanceId,
      workflowInstanceId: params.workflowInstanceId,
      producerModuleId: params.producerModuleId,
      metadata: {
        ...(params.metadata ?? {}),
        deliveryEngine: '41d',
        producerModuleId: params.producerModuleId,
        ...(params.recipientType ? { recipientType: params.recipientType } : {}),
        ...(params.correlationId ? { correlationId: params.correlationId } : {}),
        ...(params.causationId ? { causationId: params.causationId } : {}),
        ...(params.journeyInstanceId ? { journeyInstanceId: params.journeyInstanceId } : {}),
        ...(params.workflowInstanceId ? { workflowInstanceId: params.workflowInstanceId } : {}),
      },
    };

    const result: DeliveryResult = await this.orchestrator.deliver(intentInput);

    if (result.legacyNotificationId) {
      const primaryChannel = result.plan[0]?.channel ?? params.channels[0];
      await this.eventPublisher.publish(
        new NotificationCreatedEvent(
          params.tenantId,
          params.branchId ?? null,
          result.legacyNotificationId,
          params.recipientId,
          primaryChannel,
          params.priority ?? 'medium',
        ),
      );
    }

    return { intentId: result.intentId, notificationId: result.legacyNotificationId ?? null };
  }
}
