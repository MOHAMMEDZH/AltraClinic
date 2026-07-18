import { PortalDomainEvent } from './portal-domain.event';
import { PortalLocale } from '../value-objects/portal-preferences.vo';

export class PortalPreferencesUpdatedEvent extends PortalDomainEvent {
  readonly eventName = 'PortalPreferencesUpdated';

  constructor(
    tenantId: string,
    branchId: string | null,
    portalAccountId: string,
    patientId: string,
    public readonly locale: PortalLocale,
    public readonly channels: { email: boolean; sms: boolean; push: boolean },
  ) {
    super(tenantId, branchId, portalAccountId, patientId);
  }
}
