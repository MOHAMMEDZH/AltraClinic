import { PortalDomainEvent } from './portal-domain.event';

export class PortalAccountInvitedEvent extends PortalDomainEvent {
  readonly eventName = 'PortalAccountInvited';

  constructor(
    tenantId: string,
    branchId: string | null,
    portalAccountId: string,
    patientId: string,
    public readonly invitedBy: string,
  ) {
    super(tenantId, branchId, portalAccountId, patientId);
  }
}
