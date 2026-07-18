import { SubscriptionReminderService } from '../application/services/subscription-reminder.service';
import { JobDeduplicationService } from '../application/services/job-deduplication.service';
import { MockRedisService } from '../../../infrastructure/redis/tests/mock-redis.service';
import { RedisKeyBuilder } from '../../../infrastructure/redis/redis-key.builder';

describe('SubscriptionReminderService', () => {
  const prisma = {
    platformSubscription: { findMany: jest.fn().mockResolvedValue([]) },
    platformTenant: { findMany: jest.fn().mockResolvedValue([]) },
    clinicSubscription: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'admin-1' }]) },
  };
  const producer = { produceInApp: jest.fn().mockResolvedValue({ intentId: 'intent-1', notificationId: 'notif-1' }) };
  const dedup = new JobDeduplicationService(
    new MockRedisService() as any,
    new RedisKeyBuilder('app'),
  );

  const licensing = {
    allowWorkerExecution: jest.fn().mockResolvedValue(true),
  };

  const svc = new SubscriptionReminderService(
    prisma as any,
    producer as any,
    dedup,
    licensing as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('sends 30-day platform subscription reminder', async () => {
    const now = new Date('2026-05-16T09:00:00.000Z');
    const endDate = new Date('2026-06-15T00:00:00.000Z');

    prisma.platformSubscription.findMany.mockResolvedValue([
      {
        id: 'ps-1',
        plan: 'PRO',
        endDate,
        platformTenant: { tenantId: 'tenant-1' },
      },
    ]);

    const result = await svc.scanAndSendReminders(now);
    expect(result.remindersSent).toBe(1);
    expect(producer.produceInApp).toHaveBeenCalled();
  });

  it('skips duplicate reminders in same bucket', async () => {
    const now = new Date('2026-05-16T09:00:00.000Z');
    const endDate = new Date('2026-06-15T00:00:00.000Z');

    prisma.platformSubscription.findMany.mockResolvedValue([
      {
        id: 'ps-dup',
        plan: 'LITE',
        endDate,
        platformTenant: { tenantId: 'tenant-1' },
      },
    ]);

    await svc.scanAndSendReminders(now);
    const second = await svc.scanAndSendReminders(now);
    expect(second.duplicatesSkipped).toBe(1);
    expect(second.remindersSent).toBe(0);
  });
});
