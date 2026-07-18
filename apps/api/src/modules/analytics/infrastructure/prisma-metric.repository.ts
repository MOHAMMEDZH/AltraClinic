import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Metric } from '../domain/entities/metric.entity';
import { MetricRepository } from '../domain/repositories/metric.repository.interface';
import { MetricFilters } from '../domain/value-objects/metric-filters.vo';
import { MetricName } from '../domain/value-objects/metric-name.vo';
import { MetricValue, MetricValueType } from '../domain/value-objects/metric-value.vo';
import { DimensionFilter } from '../domain/value-objects/dimension-filter.vo';

@Injectable()
export class PrismaMetricRepository implements MetricRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(metric: Metric): Promise<void> {
    await this.prisma.analyticsMetricRecord.create({
      data: {
        id: metric.metricId,
        tenantId: metric.tenantId,
        branchId: metric.branchId ?? null,
        metricName: metric.metricName.toString(),
        metricValue: metric.metricValue.toJSON() as Prisma.InputJsonValue,
        dimensionFilter: metric.dimensionFilter.toJSON() as Prisma.InputJsonValue,
        recordedAt: metric.timestamp,
        recordedBy: metric.recordedBy,
        tags: Object.fromEntries(metric.tags) as Prisma.InputJsonValue,
        metadata: metric.metadata as Prisma.InputJsonValue,
      },
    });
  }

  async findById(metricId: string, tenantId: string): Promise<Metric | null> {
    const row = await this.prisma.analyticsMetricRecord.findFirst({
      where: { id: metricId, tenantId },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(
    filters: MetricFilters,
    limit = 50,
    offset = 0,
  ): Promise<{ metrics: Metric[]; total: number }> {
    const where = {
      tenantId: filters.tenantId,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.metricName ? { metricName: filters.metricName.toString() } : {}),
      ...(filters.startDate || filters.endDate
        ? {
            recordedAt: {
              ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
              ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.analyticsMetricRecord.findMany({
        where,
        orderBy: { recordedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.analyticsMetricRecord.count({ where }),
    ]);

    return { metrics: rows.map((row) => this.toDomain(row)), total };
  }

  async delete(metricId: string, tenantId: string): Promise<void> {
    await this.prisma.analyticsMetricRecord.deleteMany({
      where: { id: metricId, tenantId },
    });
  }

  async count(filters: MetricFilters): Promise<number> {
    return this.prisma.analyticsMetricRecord.count({
      where: {
        tenantId: filters.tenantId,
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.metricName ? { metricName: filters.metricName.toString() } : {}),
      },
    });
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    metricName: string;
    metricValue: unknown;
    dimensionFilter: unknown;
    recordedAt: Date;
    recordedBy: string;
    tags: unknown;
    metadata: unknown;
    createdAt: Date;
  }): Metric {
    const valueJson = row.metricValue as {
      value: number | string;
      type: string;
      unit?: string | null;
      precision?: number;
    };
    const dimension = DimensionFilter.fromJSON(
      (row.dimensionFilter ?? {}) as Record<string, string>,
    );

    return Metric.reconstitute({
      metricId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId ?? undefined,
      metricName: MetricName.create(row.metricName),
      metricValue: this.restoreMetricValue(valueJson),
      dimensionFilter: dimension,
      timestamp: row.recordedAt,
      recordedBy: row.recordedBy,
      createdAt: row.createdAt,
      tags: new Map(Object.entries((row.tags ?? {}) as Record<string, string>)),
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
    });
  }

  private restoreMetricValue(json: {
    value: number | string;
    type: string;
    unit?: string | null;
    precision?: number;
  }): MetricValue {
    switch (json.type as MetricValueType) {
      case MetricValueType.PERCENTAGE:
        return MetricValue.percentage(Number(json.value));
      case MetricValueType.CURRENCY:
        return MetricValue.currency(Number(json.value));
      case MetricValueType.DURATION:
        return MetricValue.duration(Number(json.value));
      case MetricValueType.RATIO:
        return MetricValue.ratio(Number(json.value));
      case MetricValueType.TEXT:
        return MetricValue.text(String(json.value));
      default:
        return MetricValue.count(Number(json.value));
    }
  }
}
