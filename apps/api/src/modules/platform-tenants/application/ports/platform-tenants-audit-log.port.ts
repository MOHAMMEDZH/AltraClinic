/**
 * Application port for Release 47 Step 11 tenant directory/detail read audits.
 * Directory-scope entries use the sentinel tenant UUID; detail views record the
 * governed tenant's real tenantId.
 *
 * Failure policy: callers catch and warn — directory/detail reads continue
 * when persistence fails (best-effort durable audit).
 */
export interface PlatformTenantsAuditRecord {
  /** Real tenant id for detail views; sentinel for directory-wide reads. */
  tenantId: string;
  action: string;
  resourceId: string;
  actorId: string;
  actorRoles: string[];
  locale: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  /** Never include raw search text — use flags/counts only. */
  details: Record<string, string> | null;
  /** UUID only when persisted as AuditEntry.correlationId; otherwise null. */
  correlationId: string | null;
}

export interface PlatformTenantsAuditLog {
  record(entry: PlatformTenantsAuditRecord): Promise<void>;
}
