import { CaregiverAccessScope } from '../../domain/value-objects/caregiver-access-scope';

export class GrantCaregiverAccessCommand {
  constructor(
    public readonly portalAccountId: string,
    public readonly caregiverContact: string,
    public readonly caregiverName: string,
    public readonly scopes: CaregiverAccessScope[],
    public readonly expiresAt: string | null,
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly correlationId: string | null,
  ) {}
}
