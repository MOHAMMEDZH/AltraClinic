import { AnalyticsDomainEvent } from './analytics-domain-event.base';

/**
 * ReportGeneratedEvent
 * Fired when an analytics report is completed
 */
export class ReportGeneratedEvent extends AnalyticsDomainEvent {
  public readonly reportId: string;
  public readonly reportName: string;
  public readonly reportType: string;
  public readonly format: string;
  public readonly branchId: string | undefined;
  public readonly createdBy: string;
  public readonly downloadUrl: string;
  public readonly rowCount: number;

  constructor(
    reportId: string,
    tenantId: string,
    reportName: string,
    reportType: string,
    format: string,
    createdBy: string,
    downloadUrl: string,
    rowCount: number,
    branchId?: string,
  ) {
    super(reportId, 'AnalyticsReport', tenantId);
    this.reportId = reportId;
    this.reportName = reportName;
    this.reportType = reportType;
    this.format = format;
    this.createdBy = createdBy;
    this.downloadUrl = downloadUrl;
    this.rowCount = rowCount;
    this.branchId = branchId;
  }

  eventName(): string {
    return 'ReportGenerated';
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
      downloadUrl: this.downloadUrl,
      rowCount: this.rowCount,
      version: this.version,
    };
  }
}
