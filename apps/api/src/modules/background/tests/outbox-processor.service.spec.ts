import { OutboxProcessorService } from '../application/services/outbox-processor.service';
import { OutboxEventRehydratorService } from '../application/services/outbox-event-rehydrator.service';
import { NotificationCreatedEvent } from '../../notifications/domain/events/notification-created.event';

describe('OutboxProcessorService', () => {
  const outboxRepo = {
    markProcessed: jest.fn(),
    markFailed: jest.fn(),
  };
  const bus = { publish: jest.fn().mockResolvedValue(undefined) };
  const prisma = {
    getRootClient: jest.fn(),
    outboxEvent: {
      findMany: jest.fn(),
    },
  };
  prisma.getRootClient.mockReturnValue(prisma);
  const rehydrator = new OutboxEventRehydratorService();

  const licensing = { allowWorkerExecution: jest.fn().mockResolvedValue(true) };

  const svc = new OutboxProcessorService(
    outboxRepo as any,
    rehydrator,
    bus as any,
    prisma as any,
    licensing as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('replays pending events and marks processed', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 'o1',
        eventType: 'NotificationCreatedEvent',
        payload: {
          tenantId: 't1',
          branchId: null,
          notificationId: 'n1',
          recipientId: 'u1',
          channel: 'in-app',
          priority: 'high',
        },
        attempts: 0,
      },
    ]);

    const result = await svc.processPending();
    expect(result.processed).toBe(1);
    expect(bus.publish).toHaveBeenCalledWith(expect.any(NotificationCreatedEvent));
    expect(outboxRepo.markProcessed).toHaveBeenCalledWith('o1');
  });

  it('marks unknown event types as failed', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      { id: 'o2', eventType: 'UnknownEvent', payload: {}, attempts: 0 },
    ]);

    const result = await svc.processPending();
    expect(result.failed).toBe(1);
    expect(outboxRepo.markFailed).toHaveBeenCalledWith('o2', expect.stringContaining('Unknown'));
  });

  it('skips rows exceeding max attempts', async () => {
    prisma.outboxEvent.findMany.mockResolvedValue([
      { id: 'o3', eventType: 'NotificationCreatedEvent', payload: {}, attempts: 10 },
    ]);

    const result = await svc.processPending();
    expect(result.skipped).toBe(1);
    expect(bus.publish).not.toHaveBeenCalled();
  });
});
