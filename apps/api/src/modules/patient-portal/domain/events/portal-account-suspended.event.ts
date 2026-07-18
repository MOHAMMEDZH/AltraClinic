import { PortalDomainEvent } from './portal-domain.event';

export class PortalAccountSuspendedEvent extends PortalDomainEvent {
  readonly eventName = 'PortalAccountSuspended';

  constructor(
    tenantId: string,
    branchId: string | null,
    portalAccountId: string,
    patientId: string,
    public readonly reason: string,
    public readonly suspendedBy: string,
  ) {
    super(tenantId, branchId, portalAccountId, patientId);
  }
}
