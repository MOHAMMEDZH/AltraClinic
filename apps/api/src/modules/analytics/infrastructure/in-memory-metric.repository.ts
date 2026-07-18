import { Injectable } from '@nestjs/common';
import { Metric } from '../domain/entities/metric.entity';
import { MetricRepository } from '../domain/repositories/metric.repository.interface';
import { MetricFilters } from '../domain/value-objects/metric-filters.vo';

/**
 * In-Memory Metric Repository
 * Development implementation using Map-based storage with tenant isolation
 */
@Injectable()
export class InMemoryMetricRepository implements MetricRepository {
  private readonly store = new Map<string, Map<string, Metric>>();

  private bucket(tenantId: string): Map<string, Metric> {
    const key = tenantId.trim().toLowerCase();
    if (!this.store.has(key)) {
      this.store.set(key, new Map());
    }
    return this.store.get(key)!;
  }

  async save(metric: Metric): Promise<void> {
    const bucket = this.bucket(metric.tenantId);
    bucket.set(metric.metricId, metric);
  }

  async findById(metricId: string, tenantId: string): Promise<Metric | null> {
    return this.bucket(tenantId).get(metricId) ?? null;
  }

  async list(filters: MetricFilters, limit: number = 50, offset: number = 0): Promise<{ metrics: Metric[]; total: number }> {
    let metrics = Array.from(this.bucket(filters.tenantId).values());

    // Apply filters
    if (filters.branchId) {
      metrics = metrics.filter((m) => m.branchId === filters.branchId);
    }

    if (filters.metricName) {
      metrics = metrics.filter((m) => m.metricName.toString() === filters.metricName);
    }

    if (filters.startDate) {
      const startTime = new Date(filters.startDate).getTime();
      metrics = metrics.filter((m) => m.timestamp.getTime() >= startTime);
    }

    if (filters.endDate) {
      const endTime = new Date(filters.endDate).getTime();
      metrics = metrics.filter((m) => m.timestamp.getTime() <= endTime);
    }

    // Sort by timestamp descending
    metrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Paginate
    const total = metrics.length;
    const paginated = metrics.slice(offset, offset + limit);

    return { metrics: paginated, total };
  }

  async delete(metricId: string, tenantId: string): Promise<void> {
    this.bucket(tenantId).delete(metricId);
  }

  async count(filters: MetricFilters): Promise<number> {
    let metrics = Array.from(this.bucket(filters.tenantId).values());

    if (filters.branchId) {
      metrics = metrics.filter((m) => m.branchId === filters.branchId);
    }

    if (filters.metricName) {
      metrics = metrics.filter((m) => m.metricName.toString() === filters.metricName);
    }

    return metrics.length;
  }
}
