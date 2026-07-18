import { PlatformAdminDomainEvent } from './platform-admin.event';

export class PrivilegedAccessApprovedEvent extends PlatformAdminDomainEvent {
  readonly eventName = 'PrivilegedAccessApproved';

  constructor(
    tenantId: string,
    platformTenantId: string,
    public readonly grantId: string,
    public readonly adminId: string,
    public readonly approvedBy: string,
  ) {
    super(tenantId, platformTenantId);
  }
}
