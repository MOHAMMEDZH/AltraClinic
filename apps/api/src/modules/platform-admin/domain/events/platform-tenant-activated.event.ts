import { PlatformAdminDomainEvent } from './platform-admin.event';

export class PlatformTenantActivatedEvent extends PlatformAdminDomainEvent {
  readonly eventName = 'PlatformTenantActivated';

  constructor(
    tenantId: string,
    platformTenantId: string,
    public readonly activatedBy: string,
  ) {
    super(tenantId, platformTenantId);
  }
}
