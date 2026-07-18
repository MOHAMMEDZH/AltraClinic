import { Test, TestingModule } from '@nestjs/testing';
import { PrismaNotificationRepository } from '../infrastructure/prisma-notification.repository';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Notification } from '../domain/entities/notification.entity';
import { NotificationChannel } from '../domain/value-objects/notification-channel.vo';

const mockPrismaService = {
  notification: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

const TENANT_ID = 'tenant-001';

function makeNotification(): Notification {
  return Notification.create({
    tenantId: TENANT_ID,
    branchId: null,
    recipientId: 'user-001',
    channel: NotificationChannel.create('email'),
    title: 'Test notification',
    body: 'Hello world',
    priority: 'medium',
  });
}

const prismaRow = (n: Notification) => ({
  id: n.notificationId,
  tenantId: n.tenantId,
  branchId: n.branchId,
  recipientId: n.recipientId,
  channel: 'EMAIL' as const,
  title: n.title,
  body: n.body,
  priority: 'MEDIUM' as const,
  status: 'QUEUED' as const,
  sentAt: null,
  deliveredAt: null,
  readAt: null,
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
});

describe('PrismaNotificationRepository', () => {
  let repo: PrismaNotificationRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaNotificationRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaNotificationRepository>(PrismaNotificationRepository);
  });

  describe('save()', () => {
    it('persists notification with EMAIL channel and MEDIUM priority', async () => {
      const n = makeNotification();
      await repo.save(n);

      expect(mockPrismaService.notification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            channel: 'EMAIL',
            priority: 'MEDIUM',
            status: 'QUEUED',
          }),
        }),
      );
    });

    it('persists PUSH channel notification', async () => {
      const n = Notification.create({
        tenantId: TENANT_ID,
        branchId: null,
        recipientId: 'user-001',
        channel: NotificationChannel.create('push'),
        title: 'Push',
        body: 'body',
        priority: 'high',
      });

      await repo.save(n);

      expect(mockPrismaService.notification.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            channel: 'PUSH',
            priority: 'HIGH',
          }),
        }),
      );
    });
  });

  describe('findById()', () => {
    it('returns null when not found', async () => {
      mockPrismaService.notification.findFirst.mockResolvedValueOnce(null);
      const result = await repo.findById('notif-999', TENANT_ID);
      expect(result).toBeNull();
    });

    it('reconstructs notification from Prisma row', async () => {
      const n = makeNotification();
      mockPrismaService.notification.findFirst.mockResolvedValueOnce(prismaRow(n));

      const result = await repo.findById(n.notificationId, TENANT_ID);

      expect(result).not.toBeNull();
      expect(result!.channel.channel).toBe('email');
      expect(result!.priority).toBe('medium');
      expect(result!.status.status).toBe('queued');
    });
  });

  describe('list()', () => {
    it('applies tenantId and recipientId filters', async () => {
      mockPrismaService.notification.findMany.mockResolvedValueOnce([]);

      await repo.list({ tenantId: TENANT_ID, recipientId: 'user-001' });

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT_ID,
            recipientId: 'user-001',
          }),
        }),
      );
    });

    it('maps status filter to Prisma enum', async () => {
      mockPrismaService.notification.findMany.mockResolvedValueOnce([]);

      await repo.list({ tenantId: TENANT_ID, status: 'sent' });

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'SENT' }),
        }),
      );
    });

    it('maps channel filter to Prisma enum', async () => {
      mockPrismaService.notification.findMany.mockResolvedValueOnce([]);

      await repo.list({ tenantId: TENANT_ID, channel: 'in-app' });

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ channel: 'IN_APP' }),
        }),
      );
    });
  });
});
