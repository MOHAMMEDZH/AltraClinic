import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateNotificationCommand } from '../commands/create-notification.command';
import { NOTIFICATION_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { NotificationRepository } from '../../domain/repositories/notification.repository.interface';
import { Notification } from '../../domain/entities/notification.entity';
import { NotificationChannel } from '../../domain/value-objects/notification-channel.vo';
import { NotificationCreatedEvent } from '../../domain/events/notification-created.event';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { DeliveryOrchestratorService } from '../../delivery/delivery-orchestrator.service';
import { NotificationChannelId } from '../../delivery/delivery.types';

const CHANNEL_MAP: Record<string, NotificationChannelId> = {
  'in-app': 'in-app',
  in_app: 'in-app',
  IN_APP: 'in-app',
  email: 'email',
  EMAIL: 'email',
  sms: 'sms',
  SMS: 'sms',
  push: 'push',
  PUSH: 'push',
  whatsapp: 'whatsapp',
  WHATSAPP: 'whatsapp',
  webhook: 'webhook',
  WEBHOOK: 'webhook',
};

/**
 * Compatibility create path: routes through the Phase 41d DeliveryOrchestrator while
 * preserving the existing `{ notificationId }` contract for callers and inbox UI.
 * Falls back to direct repository persistence only if the orchestrator cannot produce
 * a legacy Notification projection (e.g. blocked consent with no in-app fan-out).
 */
@Injectable()
export class CreateNotificationHandler {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly repository: NotificationRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    private readonly deliveryOrchestrator: DeliveryOrchestratorService,
  ) {}

  async execute(command: CreateNotificationCommand): Promise<{ notificationId: string; intentId?: string }> {
    const tenantContext = await this.tenantContext.resolve();
    const tenantId = tenantContext?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('tenant context could not be resolved');
    }
    if (!command.recipientId?.trim()) {
      throw new BadRequestException('recipientId is required');
    }
    if (!command.channel?.trim()) {
      throw new BadRequestException('channel is required');
    }
    if (!command.title?.trim()) {
      throw new BadRequestException('title is required');
    }
    if (!command.body?.trim()) {
      throw new BadRequestException('body is required');
    }

    const channelId = CHANNEL_MAP[command.channel] ?? CHANNEL_MAP[command.channel.toLowerCase()];
    if (!channelId) {
      throw new BadRequestException(`Unsupported notification channel: ${command.channel}`);
    }

    const delivery = await this.deliveryOrchestrator.deliver({
      tenantId,
      branchId: command.branchId ?? tenantContext?.branchId ?? null,
      recipientId: command.recipientId,
      requestedChannels: [channelId],
      title: command.title,
      body: command.body,
      priority: (command.priority as 'low' | 'medium' | 'high' | 'critical') ?? 'medium',
      transactional: true,
      idempotencyKey: `create-notification:${tenantId}:${command.recipientId}:${channelId}:${randomUUID()}`,
      metadata: {
        deliveryEngine: '41d',
        legacyCreatePath: true,
        producerModuleId: 'notifications',
      },
    });

    if (delivery.legacyNotificationId) {
      await this.eventPublisher.publish(
        new NotificationCreatedEvent(
          tenantId,
          command.branchId ?? null,
          delivery.legacyNotificationId,
          command.recipientId,
          channelId,
          command.priority ?? 'medium',
        ),
      );
      return { notificationId: delivery.legacyNotificationId, intentId: delivery.intentId };
    }

    // Consent/preference blocked or non-in-app-only plan without legacy row: keep API contract
    // by persisting a Notification shell for Delivery Log (status FAILED when blocked).
    const notification = Notification.create({
      tenantId,
      branchId: command.branchId,
      recipientId: command.recipientId,
      channel: NotificationChannel.create(command.channel),
      title: command.title,
      body: command.body,
      priority: command.priority,
    });
    await this.repository.save(notification);
    await this.eventPublisher.publish(
      new NotificationCreatedEvent(
        tenantId,
        notification.branchId,
        notification.notificationId,
        notification.recipientId,
        notification.channel.channel,
        notification.priority,
      ),
    );
    return { notificationId: notification.notificationId, intentId: delivery.intentId };
  }
}
