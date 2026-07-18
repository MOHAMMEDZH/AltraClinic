import { PortalDomainEvent } from './portal-domain.event';

export class PortalAccountDeactivatedEvent extends PortalDomainEvent {
  readonly eventName = 'PortalAccountDeactivated';

  constructor(
    tenantId: string,
    branchId: string | null,
    portalAccountId: string,
    patientId: string,
    public readonly reason: string | null,
    public readonly deactivatedBy: string,
    public readonly revokedGrantIds: string[],
  ) {
    super(tenantId, branchId, portalAccountId, patientId);
  }
}
