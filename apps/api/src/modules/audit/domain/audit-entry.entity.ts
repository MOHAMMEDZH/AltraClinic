import { LocalizedTextVO } from './value-objects/localized-text.vo';

export class AuditEntry {
  public readonly id: string;
  public readonly createdAt: Date;
  public readonly locale: string | null;

  constructor(
    id: string,
    public readonly tenantId: string,
    public readonly branchId: string | null,
    public readonly action: string,
    public readonly resourceType: string,
    public readonly resourceId: string,
    public readonly actorId: string,
    public readonly actorRoles: string[],
    public readonly details: Record<string, string> | null,
    public readonly changes: Record<string, { before?: string | null; after?: string | null }> | null,
    public readonly category: string | null,
    public readonly description: LocalizedTextVO | null,
    public readonly reason: string | null,
    public readonly ipAddress: string | null,
    public readonly userAgent: string | null,
    public readonly correlationId: string | null,
    locale?: string | null,
    createdAt?: Date,
  ) {
    this.id = id;
    this.createdAt = createdAt ?? new Date();
    this.locale = locale ?? null;
  }

  getDescription(locale?: string | null): string | null {
    if (!this.description) return null;
    return this.description.getPreferred(locale);
  }
}
