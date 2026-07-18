import { Test, TestingModule } from '@nestjs/testing';
import { MarkNotificationReadHandler } from '../application/handlers/mark-notification-read.handler';
import { InMemoryNotificationRepository } from '../infrastructure/in-memory-notification.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { NOTIFICATION_REPOSITORY, EVENT_PUBLISHER } from '../../../infrastructure/provider.tokens';
import { Notification } from '../domain/entities/notification.entity';
import { NotificationChannel } from '../domain/value-objects/notification-channel.vo';

describe('MarkNotificationReadHandler', () => {
  let handler: MarkNotificationReadHandler;
  let repo: InMemoryNotificationRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarkNotificationReadHandler,
        { provide: NOTIFICATION_REPOSITORY, useClass: InMemoryNotificationRepository },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'tenant-1', branchId: 'branch-1', environment: 'sandbox' }) },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: async () => {} } },
      ],
    }).compile();

    handler = module.get(MarkNotificationReadHandler);
    repo = module.get(NOTIFICATION_REPOSITORY);
  });

  it('marks an existing notification as read', async () => {
    const notification = Notification.create({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      recipientId: 'user-1',
      channel: NotificationChannel.create('in-app'),
      title: 'Hello',
      body: 'Please review',
      priority: 'low',
    });
    await repo.save(notification);

    const result = await handler.execute({ notificationId: notification.notificationId });
    expect(result.notificationId).toBe(notification.notificationId);

    const saved = await repo.findById(notification.notificationId, 'tenant-1');
    expect(saved?.status.status).toBe('read');
    expect(saved?.readAt).not.toBeNull();
  });
});
