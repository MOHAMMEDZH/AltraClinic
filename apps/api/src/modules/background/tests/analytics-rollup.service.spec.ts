import { AnalyticsRollupService } from '../application/services/analytics-rollup.service';

describe('AnalyticsRollupService', () => {
  const prisma = {
    tenant: {
      findMany: jest.fn().mockResolvedValue([{ id: 't1' }, { id: 't2' }]),
    },
  };
  const analytics = {
    getDailyStats: jest.fn().mockResolvedValue({ date: '2026-06-14', appointments: 5, newPatients: 2 }),
    getMonthlyAppointmentCount: jest.fn().mockResolvedValue(42),
    getActiveUserCount: jest.fn().mockResolvedValue(10),
  };

  const licensing = { allowWorkerExecution: jest.fn().mockResolvedValue(true) };

  const svc = new AnalyticsRollupService(prisma as any, analytics as any, licensing as any);

  it('aggregates daily metrics per tenant', async () => {
    const result = await svc.aggregateDaily('2026-06-14');
    expect(result.tenantsProcessed).toBe(2);
    expect(result.metricsRecorded).toBe(6);
    expect(analytics.getDailyStats).toHaveBeenCalledWith('t1', '2026-06-14');
  });
});
