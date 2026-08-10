export interface PlatformAddonsAuditRecord {
  tenantId: string;
  action: string;
  resourceId: string;
  actorId: string;
  actorRoles: string[];
  locale: string | null;
  descriptionEn: string;
  descriptionAr: string;
  details: Record<string, string> | null;
  correlationId: string | null;
}

export interface PlatformAddonsAuditLog {
  record(entry: PlatformAddonsAuditRecord): Promise<void>;
  /**
   * Append the AuditEntry using an already-open transaction client (Model A).
   * Must throw on persistence failure — never swallow — so the caller's
   * transaction rolls back together with the business mutation.
   */
  recordInTransaction(
    client: {
      tenant: { upsert: (args: unknown) => Promise<unknown> };
      auditEntry: { create: (args: unknown) => Promise<unknown> };
    },
    entry: PlatformAddonsAuditRecord,
  ): Promise<void>;
}
