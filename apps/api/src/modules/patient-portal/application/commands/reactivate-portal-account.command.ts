export class ReactivatePortalAccountCommand {
  constructor(
    public readonly portalAccountId: string,
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly correlationId: string | null,
  ) {}
}
