import { Test, TestingModule } from '@nestjs/testing';
import { GetNotificationHandler } from '../application/handlers/get-notification.handler';
import { InMemoryNotificationRepository } from '../infrastructure/in-memory-notification.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { NOTIFICATION_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { Notification } from '../domain/entities/notification.entity';
import { NotificationChannel } from '../domain/value-objects/notification-channel.vo';

describe('GetNotificationHandler', () => {
  let handler: GetNotificationHandler;
  let repo: InMemoryNotificationRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetNotificationHandler,
        { provide: NOTIFICATION_REPOSITORY, useClass: InMemoryNotificationRepository },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'tenant-1', branchId: 'branch-1', environment: 'sandbox' }) },
        },
      ],
    }).compile();

    handler = module.get(GetNotificationHandler);
    repo = module.get(NOTIFICATION_REPOSITORY);
  });

  it('returns an existing notification', async () => {
    const notification = Notification.create({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      recipientId: 'user-1',
      channel: NotificationChannel.create('in-app'),
      title: 'Test',
      body: 'Message body',
      priority: 'low',
    });
    await repo.save(notification);

    const result = await handler.execute({ notificationId: notification.notificationId });
    expect(result.notificationId).toBe(notification.notificationId);
    expect(result.recipientId).toBe('user-1');
  });
});
