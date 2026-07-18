import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GetNotificationCommand } from '../commands/get-notification.command';
import { NOTIFICATION_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { NotificationRepository } from '../../domain/repositories/notification.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';

@Injectable()
export class GetNotificationHandler {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly repository: NotificationRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: GetNotificationCommand): Promise<any> {
    const tenant = await this.tenantContext.resolve();
    const notification = await this.repository.findById(command.notificationId, tenant.tenantId);
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    return notification.toJSON();
  }
}
