import { BillingOverdueService } from '../../background/application/services/billing-overdue.service';

describe('BillingOverdueService', () => {
  const prisma = {
    tenant: {
      findMany: jest.fn().mockResolvedValue([{ id: 't1' }]),
    },
    invoice: {
      updateMany: jest.fn(),
    },
  };
  const licensing = {
    allowWorkerExecution: jest.fn().mockResolvedValue(true),
  };

  let service: BillingOverdueService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.invoice.updateMany.mockResolvedValue({ count: 2 });
    service = new BillingOverdueService(prisma as never, licensing as never);
  });

  it('marks past-due issued invoices as overdue', async () => {
    const result = await service.scanAndMarkOverdue(new Date('2026-06-20T12:00:00Z'));
    expect(result.marked).toBe(2);
    const call = prisma.invoice.updateMany.mock.calls[0]?.[0];
    expect(call?.where?.status).toEqual({ in: ['ISSUED', 'PARTIAL_PAID'] });
    expect(call?.data?.status).toBe('OVERDUE');
  });
});
