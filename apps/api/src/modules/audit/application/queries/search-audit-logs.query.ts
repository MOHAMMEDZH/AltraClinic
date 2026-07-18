export class SearchAuditLogsQuery {
  constructor(
    public readonly action?: string,
    public readonly resourceType?: string,
    public readonly resourceId?: string,
    public readonly actorId?: string,
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}
