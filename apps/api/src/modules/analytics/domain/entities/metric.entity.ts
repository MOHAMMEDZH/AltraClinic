import { randomUUID } from 'crypto';
import { MetricName } from '../value-objects/metric-name.vo';
import { MetricValue } from '../value-objects/metric-value.vo';
import { DimensionFilter } from '../value-objects/dimension-filter.vo';

/**
 * Metric Aggregate Root
 * Represents a single recorded metric data point
 * Examples: appointment_no_show_rate = 15%, revenue_total = $5000
 */
export interface MetricProps {
  tenantId: string;
  branchId?: string;
  metricName: MetricName;
  metricValue: MetricValue;
  dimensionFilter: DimensionFilter;
  timestamp: Date;
  recordedBy: string; // userId who recorded/triggered this metric
}

export class Metric {
  public readonly metricId: string;
  public readonly tenantId: string;
  public readonly branchId: string | undefined;
  public readonly metricName: MetricName;
  public readonly metricValue: MetricValue;
  public readonly dimensionFilter: DimensionFilter;
  public readonly timestamp: Date;
  public readonly recordedBy: string;
  public readonly createdAt: Date;
  public readonly recordedAt: Date; // When the metric was captured from source systems
  public tags: Map<string, string>; // Key-value tags for cross-cutting concerns
  public metadata: Record<string, unknown>; // Additional context

  private constructor(props: MetricProps) {
    this.metricId = randomUUID();
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.metricName = props.metricName;
    this.metricValue = props.metricValue;
    this.dimensionFilter = props.dimensionFilter;
    this.timestamp = props.timestamp;
    this.recordedBy = props.recordedBy;
    this.createdAt = new Date();
    this.recordedAt = new Date(props.timestamp);
    this.tags = new Map();
    this.metadata = {};
  }

  /** Rehydrate a persisted metric (repository layer only). */
  static reconstitute(props: MetricProps & {
    metricId: string;
    createdAt: Date;
    tags?: Map<string, string>;
    metadata?: Record<string, unknown>;
  }): Metric {
    const metric = Object.assign(Object.create(Metric.prototype), {
      metricId: props.metricId,
      tenantId: props.tenantId,
      branchId: props.branchId,
      metricName: props.metricName,
      metricValue: props.metricValue,
      dimensionFilter: props.dimensionFilter,
      timestamp: props.timestamp,
      recordedBy: props.recordedBy,
      createdAt: props.createdAt,
      recordedAt: props.timestamp,
      tags: props.tags ?? new Map<string, string>(),
      metadata: props.metadata ?? {},
    }) as Metric;
    return metric;
  }

  static create(props: MetricProps): Metric {
    if (!props.tenantId?.trim()) {
      throw new Error('tenantId is required');
    }
    if (!props.metricName) {
      throw new Error('metricName is required');
    }
    if (!props.metricValue) {
      throw new Error('metricValue is required');
    }
    if (!props.dimensionFilter) {
      throw new Error('dimensionFilter is required');
    }
    if (!props.timestamp || isNaN(props.timestamp.getTime())) {
      throw new Error('Valid timestamp is required');
    }
    if (!props.recordedBy?.trim()) {
      throw new Error('recordedBy is required');
    }

    return new Metric(props);
  }

  /**
   * Add contextual tags to metric (e.g., 'source' => 'appointment_service')
   */
  addTag(key: string, value: string): void {
    if (!key?.trim() || !value?.trim()) {
      throw new Error('Tag key and value must be non-empty strings');
    }
    this.tags.set(key.trim().toLowerCase(), value.trim());
  }

  /**
   * Add metadata for additional context
   */
  addMetadata(key: string, value: unknown): void {
    if (!key?.trim()) {
      throw new Error('Metadata key must be non-empty string');
    }
    this.metadata[key.trim().toLowerCase()] = value;
  }

  /**
   * Get metric for JSON serialization
   */
  toJSON() {
    return {
      metricId: this.metricId,
      tenantId: this.tenantId,
      branchId: this.branchId,
      metricName: this.metricName.toString(),
      metricValue: this.metricValue.toJSON(),
      dimensionFilter: this.dimensionFilter.toJSON(),
      timestamp: this.timestamp.toISOString(),
      recordedBy: this.recordedBy,
      createdAt: this.createdAt.toISOString(),
      recordedAt: this.recordedAt.toISOString(),
      tags: Object.fromEntries(this.tags),
      metadata: this.metadata,
    };
  }
}
