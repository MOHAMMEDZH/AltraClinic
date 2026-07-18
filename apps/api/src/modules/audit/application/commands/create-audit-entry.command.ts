export class CreateAuditEntryCommand {
  constructor(
    public readonly action: string,
    public readonly resourceType: string,
    public readonly resourceId: string,
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly details: Record<string, string> | null,
    public readonly changes: Record<string, { before?: string | null; after?: string | null }> | null,
    public readonly category: string | null,
    public readonly descriptionEn: string | null,
    public readonly descriptionAr: string | null,
    public readonly reason: string | null,
    public readonly ipAddress: string | null,
    public readonly userAgent: string | null,
    public readonly correlationId: string | null,
  ) {}
}
