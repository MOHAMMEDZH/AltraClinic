export class SuspendPortalAccountCommand {
  constructor(
    public readonly portalAccountId: string,
    public readonly reason: string,
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly correlationId: string | null,
  ) {}
}
