import { AnalyticsDomainEvent } from './analytics-domain-event.base';

/**
 * ReportQueuedEvent
 * Fired when a new analytics report has been queued for generation
 */
export class ReportQueuedEvent extends AnalyticsDomainEvent {
  public readonly reportId: string;
  public readonly reportName: string;
  public readonly reportType: string;
  public readonly format: string;
  public readonly createdBy: string;
  public readonly branchId: string | undefined;
  public readonly isScheduled: boolean;
  public readonly scheduleFrequency: string | undefined;

  constructor(
    reportId: string,
    tenantId: string,
    reportName: string,
    reportType: string,
    format: string,
    createdBy: string,
    branchId?: string,
    isScheduled = false,
    scheduleFrequency?: string,
  ) {
    super(reportId, 'AnalyticsReport', tenantId);
    this.reportId = reportId;
    this.reportName = reportName;
    this.reportType = reportType;
    this.format = format;
    this.createdBy = createdBy;
    this.branchId = branchId;
    this.isScheduled = isScheduled;
    this.scheduleFrequency = scheduleFrequency;
  }

  eventName(): string {
    return 'ReportQueued';
  }

  toJSON() {
    return {
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      eventId: this.eventId,
      eventName: this.eventName(),
      occurredAt: this.occurredAt,
      tenantId: this.tenantId,
      reportId: this.reportId,
      reportName: this.reportName,
      reportType: this.reportType,
      format: this.format,
      branchId: this.branchId,
      createdBy: this.createdBy,
      isScheduled: this.isScheduled,
      scheduleFrequency: this.scheduleFrequency,
      version: this.version,
    };
  }
}
