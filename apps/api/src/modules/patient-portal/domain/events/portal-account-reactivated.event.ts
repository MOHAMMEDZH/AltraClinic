import { PortalDomainEvent } from './portal-domain.event';

export class PortalAccountReactivatedEvent extends PortalDomainEvent {
  readonly eventName = 'PortalAccountReactivated';

  constructor(
    tenantId: string,
    branchId: string | null,
    portalAccountId: string,
    patientId: string,
    public readonly reactivatedBy: string,
  ) {
    super(tenantId, branchId, portalAccountId, patientId);
  }
}
