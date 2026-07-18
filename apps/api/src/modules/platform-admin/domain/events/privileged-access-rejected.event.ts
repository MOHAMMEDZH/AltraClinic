import { PlatformAdminDomainEvent } from './platform-admin.event';

export class PrivilegedAccessRejectedEvent extends PlatformAdminDomainEvent {
  readonly eventName = 'PrivilegedAccessRejected';

  constructor(
    tenantId: string,
    platformTenantId: string,
    public readonly grantId: string,
    public readonly adminId: string,
    public readonly rejectedBy: string,
    public readonly reason: string | null,
  ) {
    super(tenantId, platformTenantId);
  }
}
