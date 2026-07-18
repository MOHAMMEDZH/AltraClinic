import { DomainEvent } from '../../../../common/event.base';

export class ReportFailedEvent extends DomainEvent {
  public readonly reportId: string;
  public readonly tenantId: string;
  public readonly reason: string;

  constructor(payload: { reportId: string; tenantId: string; reason: string }) {
    super(payload.reportId, new Date().toISOString());
    this.reportId = payload.reportId;
    this.tenantId = payload.tenantId;
    this.reason = payload.reason;
  }
}
