import { PortalDomainEvent } from './portal-domain.event';

export class CaregiverAccessRevokedEvent extends PortalDomainEvent {
  readonly eventName = 'CaregiverAccessRevoked';

  constructor(
    tenantId: string,
    branchId: string | null,
    portalAccountId: string,
    patientId: string,
    public readonly grantId: string,
    public readonly reason: string | null,
    public readonly revokedBy: string,
  ) {
    super(tenantId, branchId, portalAccountId, patientId);
  }
}
