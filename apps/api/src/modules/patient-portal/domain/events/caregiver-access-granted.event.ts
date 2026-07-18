import { PortalDomainEvent } from './portal-domain.event';
import { CaregiverAccessScope } from '../value-objects/caregiver-access-scope';

export class CaregiverAccessGrantedEvent extends PortalDomainEvent {
  readonly eventName = 'CaregiverAccessGranted';

  constructor(
    tenantId: string,
    branchId: string | null,
    portalAccountId: string,
    patientId: string,
    public readonly grantId: string,
    public readonly caregiverContact: string,
    public readonly scopes: CaregiverAccessScope[],
    public readonly grantedBy: string,
    public readonly expiresAt: string | null,
  ) {
    super(tenantId, branchId, portalAccountId, patientId);
  }
}
