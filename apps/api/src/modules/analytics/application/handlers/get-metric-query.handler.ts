import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GetMetricQuery, ListMetricsQuery } from '../queries';
import { MetricRepository } from '../../domain/repositories/metric.repository.interface';
import { MetricFilters } from '../../domain/value-objects/metric-filters.vo';
import { METRIC_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { Metric } from '../../domain/entities/metric.entity';

/**
 * Get Metric Query Handler
 */
@Injectable()
export class GetMetricQueryHandler {
  constructor(@Inject(METRIC_REPOSITORY) private readonly repository: MetricRepository) {}

  async execute(query: GetMetricQuery): Promise<Metric> {
    const metric = await this.repository.findById(query.metricId, query.tenantId);
    if (!metric) {
      throw new NotFoundException(`Metric ${query.metricId} not found`);
    }
    return metric;
  }
}

/**
 * List Metrics Query Handler
 */
@Injectable()
export class ListMetricsQueryHandler {
  constructor(@Inject(METRIC_REPOSITORY) private readonly repository: MetricRepository) {}

  private readonly maxLimit = 100;

  async execute(query: ListMetricsQuery): Promise<{ metrics: Metric[]; total: number }> {
    const filters = MetricFilters.create({
      tenantId: query.tenantId,
      branchId: query.branchId,
      startDate: query.startDate,
      endDate: query.endDate,
      metricName: query.metricName,
    });

    const limit = Math.min(Math.max(query.limit, 1), this.maxLimit);
    const offset = Math.max(query.offset, 0);

    return await this.repository.list(filters, limit, offset);
  }
}
