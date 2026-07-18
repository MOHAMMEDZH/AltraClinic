import { PlatformAdminDomainEvent } from './platform-admin.event';

export class PrivilegedAccessRequestedEvent extends PlatformAdminDomainEvent {
  readonly eventName = 'PrivilegedAccessRequested';

  constructor(
    tenantId: string,
    platformTenantId: string,
    public readonly grantId: string,
    public readonly adminId: string,
    public readonly scopes: string[],
    public readonly expiresAt: string,
  ) {
    super(tenantId, platformTenantId);
  }
}
