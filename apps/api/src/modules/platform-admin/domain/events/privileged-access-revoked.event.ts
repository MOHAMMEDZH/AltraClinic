import { PlatformAdminDomainEvent } from './platform-admin.event';

export class PrivilegedAccessRevokedEvent extends PlatformAdminDomainEvent {
  readonly eventName = 'PrivilegedAccessRevoked';

  constructor(
    tenantId: string,
    platformTenantId: string,
    public readonly grantId: string,
    public readonly adminId: string,
    public readonly revokedBy: string,
    public readonly reason: string | null,
  ) {
    super(tenantId, platformTenantId);
  }
}
