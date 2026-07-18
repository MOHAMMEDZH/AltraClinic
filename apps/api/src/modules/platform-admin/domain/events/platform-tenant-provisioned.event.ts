import { PlatformAdminDomainEvent } from './platform-admin.event';

export class PlatformTenantProvisionedEvent extends PlatformAdminDomainEvent {
  readonly eventName = 'PlatformTenantProvisioned';

  constructor(
    tenantId: string,
    platformTenantId: string,
    public readonly displayName: string,
    public readonly region: string,
    public readonly plan: string,
    public readonly provisionedBy: string,
  ) {
    super(tenantId, platformTenantId);
  }
}
