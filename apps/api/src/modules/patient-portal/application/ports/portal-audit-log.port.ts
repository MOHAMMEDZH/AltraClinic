/**
 * Application-layer port for security-relevant audit logging (SECURITY.md §4).
 *
 * Sensitive Patient Portal actions — consent changes, account suspension,
 * authorization denials — must be recorded synchronously and reliably, not as a
 * best-effort side effect of asynchronous event consumption. Handlers depend on
 * this port (Dependency Inversion); the infrastructure layer supplies an adapter
 * that writes to the platform's central audit trail.
 */
export interface PortalAuditRecord {
  tenantId: string;
  branchId: string | null;
  action: string;
  resourceId: string;
  actorId: string;
  actorRoles: string[];
  locale: string | null;
  reason: string | null;
  details: Record<string, string> | null;
  correlationId: string | null;
}

export interface PortalAuditLog {
  record(entry: PortalAuditRecord): Promise<void>;
}
