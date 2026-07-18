import { Metric } from '../entities/metric.entity';
import { MetricFilters } from '../value-objects/metric-filters.vo';

/**
 * Metric Repository Interface
 * Abstraction for metric persistence
 */
export interface MetricRepository {
  save(metric: Metric): Promise<void>;
  findById(metricId: string, tenantId: string): Promise<Metric | null>;
  list(filters: MetricFilters, limit: number, offset: number): Promise<{ metrics: Metric[]; total: number }>;
  delete(metricId: string, tenantId: string): Promise<void>;
  count(filters: MetricFilters): Promise<number>;
}
