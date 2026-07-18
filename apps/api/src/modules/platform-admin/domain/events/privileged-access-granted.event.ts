import { PlatformAdminDomainEvent } from './platform-admin.event';

/** Emitted when a break-glass (emergency) privileged grant is activated. */
export class PrivilegedAccessGrantedEvent extends PlatformAdminDomainEvent {
  readonly eventName = 'PrivilegedAccessGranted';

  constructor(
    tenantId: string,
    platformTenantId: string,
    public readonly grantId: string,
    public readonly adminId: string,
    public readonly scopes: string[],
    public readonly breakGlass: boolean,
    public readonly expiresAt: string,
  ) {
    super(tenantId, platformTenantId);
  }
}
