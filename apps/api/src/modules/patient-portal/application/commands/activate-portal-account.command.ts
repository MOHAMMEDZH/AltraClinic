export class ActivatePortalAccountCommand {
  constructor(
    public readonly portalAccountId: string,
    public readonly userId: string,
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly correlationId: string | null,
  ) {}
}
