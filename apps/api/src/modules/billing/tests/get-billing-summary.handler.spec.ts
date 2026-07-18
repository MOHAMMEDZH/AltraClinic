import { GetBillingSummaryHandler } from '../application/handlers/get-billing-summary.handler';

describe('GetBillingSummaryHandler', () => {
  const tenantContext = {
    resolve: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
  };

  const prisma = {
    invoice: {
      count: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    invoicePayment: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
  };

  let handler: GetBillingSummaryHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.invoice.count.mockResolvedValue(2);
    prisma.invoice.aggregate.mockResolvedValue({
      _sum: { amountTotal: 1000, amountPaid: 400 },
      _count: 3,
    });
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.invoicePayment.aggregate.mockResolvedValue({ _sum: { amount: 150 }, _count: 2 });
    prisma.invoicePayment.findMany.mockResolvedValue([]);
    handler = new GetBillingSummaryHandler(prisma as never, tenantContext as never);
  });

  it('returns billing summary KPIs', async () => {
    const result = await handler.execute();
    expect(result.outstandingAmount).toBe(600);
    expect(result.outstandingCount).toBe(3);
    expect(result.revenueToday).toBe(150);
    expect(result.aging).toEqual({
      current: 0,
      days1to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90: 0,
    });
  });
});
