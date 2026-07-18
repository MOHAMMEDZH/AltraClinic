import { AnalyticsDomainEvent } from './analytics-domain-event.base';

/**
 * DashboardCreated Event
 * Fired when a dashboard is created
 */
export class DashboardCreatedEvent extends AnalyticsDomainEvent {
  public readonly dashboardId: string;
  public readonly dashboardName: string;
  public readonly dashboardType: string;
  public readonly branchId: string | undefined;
  public readonly createdBy: string;
  public readonly widgetCount: number;

  constructor(
    dashboardId: string,
    tenantId: string,
    dashboardName: string,
    dashboardType: string,
    createdBy: string,
    widgetCount: number,
    branchId?: string,
  ) {
    super(dashboardId, 'Dashboard', tenantId);
    this.dashboardId = dashboardId;
    this.dashboardName = dashboardName;
    this.dashboardType = dashboardType;
    this.createdBy = createdBy;
    this.widgetCount = widgetCount;
    this.branchId = branchId;
  }

  eventName(): string {
    return 'DashboardCreated';
  }

  toJSON() {
    return {
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      eventId: this.eventId,
      eventName: this.eventName(),
      occurredAt: this.occurredAt,
      tenantId: this.tenantId,
      dashboardId: this.dashboardId,
      dashboardName: this.dashboardName,
      dashboardType: this.dashboardType,
      branchId: this.branchId,
      createdBy: this.createdBy,
      widgetCount: this.widgetCount,
      version: this.version,
    };
  }
}
