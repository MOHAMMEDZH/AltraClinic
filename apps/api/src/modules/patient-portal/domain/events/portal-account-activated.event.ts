import { PortalDomainEvent } from './portal-domain.event';

export class PortalAccountActivatedEvent extends PortalDomainEvent {
  readonly eventName = 'PortalAccountActivated';

  constructor(
    tenantId: string,
    branchId: string | null,
    portalAccountId: string,
    patientId: string,
    public readonly userId: string,
  ) {
    super(tenantId, branchId, portalAccountId, patientId);
  }
}
