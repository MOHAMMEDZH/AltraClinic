import { PlatformAdminDomainEvent } from './platform-admin.event';

export class PlatformTenantPlanChangedEvent extends PlatformAdminDomainEvent {
  readonly eventName = 'PlatformTenantPlanChanged';

  constructor(
    tenantId: string,
    platformTenantId: string,
    public readonly previousPlan: string,
    public readonly newPlan: string,
    public readonly changedBy: string,
  ) {
    super(tenantId, platformTenantId);
  }
}
