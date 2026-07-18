import { Test, TestingModule } from '@nestjs/testing';
import { ListNotificationsHandler } from '../application/handlers/list-notifications.handler';
import { InMemoryNotificationRepository } from '../infrastructure/in-memory-notification.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { NOTIFICATION_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { Notification } from '../domain/entities/notification.entity';
import { NotificationChannel } from '../domain/value-objects/notification-channel.vo';

describe('ListNotificationsHandler', () => {
  let handler: ListNotificationsHandler;
  let repo: InMemoryNotificationRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListNotificationsHandler,
        { provide: NOTIFICATION_REPOSITORY, useClass: InMemoryNotificationRepository },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'tenant-1', branchId: 'branch-1', environment: 'sandbox' }) },
        },
      ],
    }).compile();

    handler = module.get(ListNotificationsHandler);
    repo = module.get(NOTIFICATION_REPOSITORY);
  });

  it('lists notifications for tenant', async () => {
    const notification = Notification.create({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      recipientId: 'user-1',
      channel: NotificationChannel.create('in-app'),
      title: 'Reminder',
      body: 'Appointment reminder',
      priority: 'high',
    });
    await repo.save(notification);

    const result = await handler.execute({ recipientId: 'user-1', channel: null, status: null, branchId: null });
    expect(result).toHaveLength(1);
    expect(result[0].notificationId).toBe(notification.notificationId);
  });
});
