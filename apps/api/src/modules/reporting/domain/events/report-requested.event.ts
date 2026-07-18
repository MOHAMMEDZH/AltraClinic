import { DomainEvent } from '../../../../common/event.base';

export class ReportRequestedEvent extends DomainEvent {
  public readonly reportId: string;
  public readonly tenantId: string;
  public readonly branchId: string | null;
  public readonly createdBy: string;
  public readonly reportType: string;
  public readonly format: string;
  public readonly dateRange: { start: string; end: string };
  public readonly parameters: Record<string, unknown>;

  constructor(payload: {
    reportId: string;
    tenantId: string;
    branchId: string | null;
    createdBy: string;
    reportType: string;
    format: string;
    dateRange: { start: string; end: string };
    parameters: Record<string, unknown>;
  }) {
    super(payload.reportId, new Date().toISOString());
    this.reportId = payload.reportId;
    this.tenantId = payload.tenantId;
    this.branchId = payload.branchId;
    this.createdBy = payload.createdBy;
    this.reportType = payload.reportType;
    this.format = payload.format;
    this.dateRange = payload.dateRange;
    this.parameters = payload.parameters;
  }
}
