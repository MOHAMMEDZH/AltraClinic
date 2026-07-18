import { PlatformAdminDomainEvent } from './platform-admin.event';

export class PlatformTenantArchivedEvent extends PlatformAdminDomainEvent {
  readonly eventName = 'PlatformTenantArchived';

  constructor(
    tenantId: string,
    platformTenantId: string,
    public readonly reason: string,
    public readonly archivedBy: string,
  ) {
    super(tenantId, platformTenantId);
  }
}
