import { Inject, Injectable } from '@nestjs/common';
import { ListNotificationsCommand } from '../commands/list-notifications.command';
import { NOTIFICATION_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { NotificationRepository } from '../../domain/repositories/notification.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';

@Injectable()
export class ListNotificationsHandler {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly repository: NotificationRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: ListNotificationsCommand): Promise<any[]> {
    const tenant = await this.tenantContext.resolve();
    const notifications = await this.repository.list({
      tenantId: tenant.tenantId,
      branchId: command.branchId,
      recipientId: command.recipientId,
      channel: command.channel,
      status: command.status,
    });
    return notifications.map((notification) => notification.toJSON());
  }
}
