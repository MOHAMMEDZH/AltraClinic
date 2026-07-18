import { PlatformAdminDomainEvent } from './platform-admin.event';

export class PlatformTenantSuspendedEvent extends PlatformAdminDomainEvent {
  readonly eventName = 'PlatformTenantSuspended';

  constructor(
    tenantId: string,
    platformTenantId: string,
    public readonly reason: string,
    public readonly suspendedBy: string,
  ) {
    super(tenantId, platformTenantId);
  }
}
