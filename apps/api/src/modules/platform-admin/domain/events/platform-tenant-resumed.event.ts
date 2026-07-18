import { PlatformAdminDomainEvent } from './platform-admin.event';

export class PlatformTenantResumedEvent extends PlatformAdminDomainEvent {
  readonly eventName = 'PlatformTenantResumed';

  constructor(
    tenantId: string,
    platformTenantId: string,
    public readonly resumedBy: string,
  ) {
    super(tenantId, platformTenantId);
  }
}
