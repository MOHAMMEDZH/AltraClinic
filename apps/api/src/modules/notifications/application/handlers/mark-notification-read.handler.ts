import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MarkNotificationReadCommand } from '../commands/mark-notification-read.command';
import { NOTIFICATION_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { NotificationRepository } from '../../domain/repositories/notification.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { NotificationReadEvent } from '../../domain/events/notification-read.event';

@Injectable()
export class MarkNotificationReadHandler {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly repository: NotificationRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: MarkNotificationReadCommand): Promise<{ notificationId: string }> {
    const tenant = await this.tenantContext.resolve();
    const notification = await this.repository.findById(command.notificationId, tenant.tenantId);
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.markAsRead();
    await this.repository.save(notification);
    await this.eventPublisher.publish(new NotificationReadEvent(tenant.tenantId, tenant.branchId ?? null, notification.notificationId, notification.recipientId));
    return { notificationId: notification.notificationId };
  }
}
