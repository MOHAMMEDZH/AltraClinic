export class DeactivatePortalAccountCommand {
  constructor(
    public readonly portalAccountId: string,
    public readonly reason: string | null,
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly correlationId: string | null,
  ) {}
}
