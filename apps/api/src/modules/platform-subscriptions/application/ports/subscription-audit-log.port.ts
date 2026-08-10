export type PlatformSubscriptionsAuditRecord = {
  tenantId: string;
  action: string;
  resourceId: string;
  actorId: string;
  actorRoles: string[];
  locale: string;
  descriptionEn: string;
  descriptionAr: string;
  correlationId?: string | null;
  details?: Record<string, unknown> | null;
};

export interface PlatformSubscriptionsAuditLog {
  record(entry: PlatformSubscriptionsAuditRecord): Promise<void>;
  /**
   * Append the AuditEntry using an already-open transaction client (Model A).
   * Must throw on persistence failure — never swallow — so the caller's
   * transaction rolls back together with the business mutation.
   */
  recordInTransaction(
    client: unknown,
    entry: PlatformSubscriptionsAuditRecord,
  ): Promise<void>;
}
