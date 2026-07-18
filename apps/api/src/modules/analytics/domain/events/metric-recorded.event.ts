import { AnalyticsDomainEvent } from './analytics-domain-event.base';

/**
 * MetricRecorded Event
 * Fired when a new metric measurement is recorded
 */
export class MetricRecordedEvent extends AnalyticsDomainEvent {
  public readonly metricId: string;
  public readonly metricName: string;
  public readonly metricValue: number | string;
  public readonly branchId: string | undefined;
  public readonly dimensions: Record<string, string>;
  public readonly recordedBy: string;

  constructor(
    metricId: string,
    tenantId: string,
    metricName: string,
    metricValue: number | string,
    recordedBy: string,
    dimensions: Record<string, string>,
    branchId?: string,
  ) {
    super(metricId, 'Metric', tenantId);
    this.metricId = metricId;
    this.metricName = metricName;
    this.metricValue = metricValue;
    this.recordedBy = recordedBy;
    this.dimensions = dimensions;
    this.branchId = branchId;
  }

  eventName(): string {
    return 'MetricRecorded';
  }

  toJSON() {
    return {
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      eventId: this.eventId,
      eventName: this.eventName(),
      occurredAt: this.occurredAt,
      tenantId: this.tenantId,
      metricId: this.metricId,
      metricName: this.metricName,
      metricValue: this.metricValue,
      branchId: this.branchId,
      dimensions: this.dimensions,
      recordedBy: this.recordedBy,
      version: this.version,
    };
  }
}
