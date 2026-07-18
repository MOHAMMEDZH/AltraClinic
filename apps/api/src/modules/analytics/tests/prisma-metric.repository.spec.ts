import { PrismaMetricRepository } from '../infrastructure/prisma-metric.repository';
import { MetricName } from '../domain/value-objects/metric-name.vo';
import { MetricValue } from '../domain/value-objects/metric-value.vo';
import { DimensionFilter } from '../domain/value-objects/dimension-filter.vo';
import { MetricFilters } from '../domain/value-objects/metric-filters.vo';
import { Metric } from '../domain/entities/metric.entity';

describe('PrismaMetricRepository', () => {
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';

  const prisma = {
    analyticsMetricRecord: {
      create: jest.fn().mockResolvedValue(undefined),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const repo = new PrismaMetricRepository(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('save persists tenant-scoped metric row', async () => {
    const metric = Metric.create({
      tenantId: TENANT_A,
      metricName: MetricName.create('appointment_no_show_rate'),
      metricValue: MetricValue.percentage(12),
      dimensionFilter: DimensionFilter.empty(),
      timestamp: new Date('2026-07-01T10:00:00Z'),
      recordedBy: 'user-1',
    });

    await repo.save(metric);

    expect(prisma.analyticsMetricRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_A, metricName: 'appointment_no_show_rate' }),
      }),
    );
  });

  it('findById scopes query by tenantId', async () => {
    prisma.analyticsMetricRecord.findFirst.mockResolvedValueOnce(null);
    await repo.findById('metric-1', TENANT_B);
    expect(prisma.analyticsMetricRecord.findFirst).toHaveBeenCalledWith({
      where: { id: 'metric-1', tenantId: TENANT_B },
    });
  });

  it('list always filters by tenantId', async () => {
    await repo.list(MetricFilters.create({ tenantId: TENANT_A }));
    expect(prisma.analyticsMetricRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) }),
    );
  });

  it('deleteMany requires matching tenantId', async () => {
    await repo.delete('metric-1', TENANT_A);
    expect(prisma.analyticsMetricRecord.deleteMany).toHaveBeenCalledWith({
      where: { id: 'metric-1', tenantId: TENANT_A },
    });
  });
});
