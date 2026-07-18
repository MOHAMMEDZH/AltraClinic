export class GetPortalAccountQuery {
  constructor(
    public readonly portalAccountId: string,
    public readonly actorId: string,
    public readonly actorRoles: string[],
  ) {}
}
