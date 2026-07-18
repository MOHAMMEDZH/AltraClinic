import { PortalLocale } from '../../domain/value-objects/portal-preferences.vo';

export class InvitePortalAccountCommand {
  constructor(
    public readonly patientId: string,
    public readonly invitedBy: string,
    public readonly invitedByRoles: string[],
    public readonly locale: PortalLocale | null,
    public readonly correlationId: string | null,
  ) {}
}
