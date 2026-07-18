import { GetNotificationsOverviewHandler } from '../application/handlers/notification-enterprise.handlers';

describe('GetNotificationsOverviewHandler', () => {
  it('returns KPI aggregates', async () => {
    const prisma = {
      notification: {
        count: jest
          .fn()
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(7),
        groupBy: jest.fn().mockResolvedValue([{ channel: 'IN_APP', status: 'DELIVERED', _count: { _all: 8 } }]),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const tenantContext = { resolve: jest.fn().mockResolvedValue({ tenantId: 't1' }) };
    const handler = new GetNotificationsOverviewHandler(prisma as never, tenantContext as never);
    const result = await handler.execute();
    expect(result.total).toBe(10);
    expect(result.unread).toBe(3);
    expect(result.failed).toBe(1);
    expect(result.pending).toBe(2);
    expect(result.delivered).toBe(7);
    expect(typeof result.deliveryRate).toBe('number');
  });
});
