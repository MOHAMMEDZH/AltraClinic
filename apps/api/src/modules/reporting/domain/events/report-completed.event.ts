import { DomainEvent } from '../../../../common/event.base';

export class ReportCompletedEvent extends DomainEvent {
  public readonly reportId: string;
  public readonly tenantId: string;
  public readonly downloadUrl: string;

  constructor(payload: { reportId: string; tenantId: string; downloadUrl: string }) {
    super(payload.reportId, new Date().toISOString());
    this.reportId = payload.reportId;
    this.tenantId = payload.tenantId;
    this.downloadUrl = payload.downloadUrl;
  }
}
