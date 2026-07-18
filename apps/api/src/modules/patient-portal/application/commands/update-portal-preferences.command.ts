import { PortalLocale } from '../../domain/value-objects/portal-preferences.vo';

export class UpdatePortalPreferencesCommand {
  constructor(
    public readonly portalAccountId: string,
    public readonly locale: PortalLocale,
    public readonly channels: { email: boolean; sms: boolean; push: boolean },
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly correlationId: string | null,
  ) {}
}
