import { randomUUID } from 'crypto';
import { ReportStatus } from '../value-objects/report-status.vo';
import { ReportType } from '../value-objects/report-type.vo';
import { ReportFormat } from '../value-objects/report-format.vo';
import { DateRange } from '../value-objects/date-range.vo';

export interface ReportProps {
  tenantId: string;
  branchId: string | null;
  createdBy: string;
  name: string;
  type: ReportType;
  format: ReportFormat;
  dateRange: DateRange;
  parameters: Record<string, unknown>;
}

export class Report {
  public readonly reportId: string;
  public readonly tenantId: string;
  public readonly branchId: string | null;
  public readonly createdBy: string;
  public readonly name: string;
  public readonly type: ReportType;
  public readonly format: ReportFormat;
  public readonly dateRange: DateRange;
  public readonly parameters: Record<string, unknown>;
  public status: ReportStatus;
  public readonly createdAt: Date;
  public updatedAt: Date;
  public completedAt: Date | null;
  public downloadUrl: string | null;

  private constructor(props: ReportProps) {
    this.reportId = randomUUID();
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.createdBy = props.createdBy;
    this.name = props.name;
    this.type = props.type;
    this.format = props.format;
    this.dateRange = props.dateRange;
    this.parameters = props.parameters;
    this.status = ReportStatus.queued();
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.completedAt = null;
    this.downloadUrl = null;
  }

  public static create(props: ReportProps): Report {
    if (!props.tenantId?.trim()) throw new Error('tenantId is required');
    if (!props.createdBy?.trim()) throw new Error('createdBy is required');
    if (!props.name?.trim()) throw new Error('name is required');
    if (!props.type) throw new Error('type is required');
    if (!props.format) throw new Error('format is required');
    if (!props.dateRange) throw new Error('dateRange is required');

    return new Report(props);
  }

  static rehydrate(state: {
    reportId: string;
    tenantId: string;
    branchId: string | null;
    createdBy: string;
    name: string;
    type: ReportType;
    format: ReportFormat;
    dateRange: DateRange;
    parameters: Record<string, unknown>;
    status: ReportStatus;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
    downloadUrl: string | null;
  }): Report {
    const report = Object.create(Report.prototype) as Report;
    report.reportId = state.reportId;
    report.tenantId = state.tenantId;
    report.branchId = state.branchId;
    report.createdBy = state.createdBy;
    report.name = state.name;
    report.type = state.type;
    report.format = state.format;
    report.dateRange = state.dateRange;
    report.parameters = state.parameters;
    report.status = state.status;
    report.createdAt = state.createdAt;
    report.updatedAt = state.updatedAt;
    report.completedAt = state.completedAt;
    report.downloadUrl = state.downloadUrl;
    return report;
  }

  public markGenerating(): void {
    if (this.status.isGeneratingOrLater()) return;
    this.status = ReportStatus.generating();
    this.updatedAt = new Date();
  }

  public markCompleted(downloadUrl: string): void {
    this.status = ReportStatus.completed();
    this.downloadUrl = downloadUrl;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  public markFailed(): void {
    this.status = ReportStatus.failed();
    this.updatedAt = new Date();
  }
}
