import { randomUUID } from 'crypto';

/**
 * AnalyticsReport Aggregate Root
 * Represents a generated analytics report (exportable, schedulable)
 */
export enum ReportFormat {
  PDF = 'pdf',
  EXCEL = 'excel',
  CSV = 'csv',
  JSON = 'json',
}

export enum ReportStatus {
  QUEUED = 'queued',
  GENERATING = 'generating',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface AnalyticsReportProps {
  tenantId: string;
  branchId?: string;
  name: string;
  description?: string;
  reportType: 'operational' | 'clinical' | 'financial' | 'inventory' | 'executive' | 'custom';
  format: ReportFormat;
  createdBy: string;
  parameters?: Record<string, unknown>;
  recipientEmails?: string[];
  isScheduled?: boolean;
  scheduleFrequency?: 'daily' | 'weekly' | 'monthly';
}

export class AnalyticsReport {
  public readonly reportId: string;
  public readonly tenantId: string;
  public readonly branchId: string | undefined;
  public name: string;
  public description: string | undefined;
  public readonly reportType: string;
  public format: ReportFormat;
  public readonly createdBy: string;
  public parameters: Record<string, unknown>;
  public recipientEmails: string[];
  public status: ReportStatus;
  public readonly createdAt: Date;
  public updatedAt: Date;
  public completedAt: Date | null;
  public downloadUrl: string | null;
  public rowCount: number;
  public isScheduled: boolean;
  public scheduleFrequency: string | undefined;
  public lastScheduledRunAt: Date | null;

  private constructor(props: AnalyticsReportProps) {
    this.reportId = randomUUID();
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.name = props.name;
    this.description = props.description;
    this.reportType = props.reportType;
    this.format = props.format;
    this.createdBy = props.createdBy;
    this.parameters = props.parameters ?? {};
    this.recipientEmails = props.recipientEmails ?? [];
    this.status = ReportStatus.QUEUED;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.completedAt = null;
    this.downloadUrl = null;
    this.rowCount = 0;
    this.isScheduled = props.isScheduled ?? false;
    this.scheduleFrequency = props.scheduleFrequency;
    this.lastScheduledRunAt = null;
  }

  static create(props: AnalyticsReportProps): AnalyticsReport {
    if (!props.tenantId?.trim()) {
      throw new Error('tenantId is required');
    }
    if (!props.name?.trim()) {
      throw new Error('Report name is required');
    }
    if (!props.format) {
      throw new Error('Report format is required');
    }
    if (!props.createdBy?.trim()) {
      throw new Error('createdBy is required');
    }

    // Validate email addresses if provided
    if (props.recipientEmails && props.recipientEmails.length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      props.recipientEmails.forEach((email) => {
        if (!emailRegex.test(email)) {
          throw new Error(`Invalid email address: ${email}`);
        }
      });
    }

    return new AnalyticsReport(props);
  }

  static rehydrate(state: {
    reportId: string;
    tenantId: string;
    branchId?: string;
    name: string;
    description?: string;
    reportType: string;
    format: ReportFormat;
    createdBy: string;
    parameters?: Record<string, unknown>;
    recipientEmails?: string[];
    status: ReportStatus;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
    downloadUrl: string | null;
    rowCount: number;
    isScheduled: boolean;
    scheduleFrequency?: string;
    lastScheduledRunAt: Date | null;
  }): AnalyticsReport {
    const report = Object.assign(Object.create(AnalyticsReport.prototype), {
      reportId: state.reportId,
      tenantId: state.tenantId,
      branchId: state.branchId,
      name: state.name,
      description: state.description,
      reportType: state.reportType,
      format: state.format,
      createdBy: state.createdBy,
      parameters: state.parameters ?? {},
      recipientEmails: state.recipientEmails ?? [],
      status: state.status,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      completedAt: state.completedAt,
      downloadUrl: state.downloadUrl,
      rowCount: state.rowCount,
      isScheduled: state.isScheduled,
      scheduleFrequency: state.scheduleFrequency,
      lastScheduledRunAt: state.lastScheduledRunAt,
    }) as AnalyticsReport;
    return report;
  }

  /**
   * Mark report as generating
   */
  markGenerating(): void {
    if (this.status !== ReportStatus.QUEUED) {
      throw new Error('Can only start generation from QUEUED status');
    }
    this.status = ReportStatus.GENERATING;
    this.updatedAt = new Date();
  }

  /**
   * Mark report as completed with URL and row count
   */
  markCompleted(downloadUrl: string, rowCount: number): void {
    if (this.status !== ReportStatus.GENERATING) {
      throw new Error('Can only complete from GENERATING status');
    }
    this.status = ReportStatus.COMPLETED;
    this.downloadUrl = downloadUrl;
    this.rowCount = rowCount;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Mark report as failed
   */
  markFailed(): void {
    this.status = ReportStatus.FAILED;
    this.downloadUrl = null;
    this.updatedAt = new Date();
  }

  addRecipient(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error(`Invalid email address: ${email}`);
    }
    if (!this.recipientEmails.includes(email)) {
      this.recipientEmails.push(email);
      this.updatedAt = new Date();
    }
  }

  recordScheduledRun(): void {
    this.lastScheduledRunAt = new Date();
    this.updatedAt = new Date();
  }

  updateSchedule(options: {
    isScheduled?: boolean;
    scheduleFrequency?: 'daily' | 'weekly' | 'monthly';
    recipientEmails?: string[];
    name?: string;
  }): void {
    if (options.name?.trim()) this.name = options.name.trim();
    if (options.isScheduled !== undefined) this.isScheduled = options.isScheduled;
    if (options.scheduleFrequency) this.scheduleFrequency = options.scheduleFrequency;
    if (options.recipientEmails) this.recipientEmails = options.recipientEmails;
    this.updatedAt = new Date();
  }

  cancelSchedule(): void {
    this.isScheduled = false;
    this.scheduleFrequency = undefined;
    this.updatedAt = new Date();
  }

  cloneForScheduledRun(): AnalyticsReport {
    const run = AnalyticsReport.create({
      tenantId: this.tenantId,
      branchId: this.branchId,
      name: `${this.name} (${new Date().toISOString().slice(0, 10)})`,
      description: this.description,
      reportType: this.reportType as AnalyticsReportProps['reportType'],
      format: this.format,
      createdBy: this.createdBy,
      parameters: { ...this.parameters },
      recipientEmails: [...this.recipientEmails],
      isScheduled: false,
    });
    return run;
  }

  toJSON() {
    return {
      reportId: this.reportId,
      tenantId: this.tenantId,
      branchId: this.branchId,
      name: this.name,
      description: this.description,
      reportType: this.reportType,
      format: this.format,
      createdBy: this.createdBy,
      parameters: this.parameters,
      recipientEmails: this.recipientEmails,
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      completedAt: this.completedAt?.toISOString() ?? null,
      downloadUrl: this.downloadUrl,
      rowCount: this.rowCount,
      isScheduled: this.isScheduled,
      scheduleFrequency: this.scheduleFrequency,
      lastScheduledRunAt: this.lastScheduledRunAt?.toISOString() ?? null,
    };
  }
}
