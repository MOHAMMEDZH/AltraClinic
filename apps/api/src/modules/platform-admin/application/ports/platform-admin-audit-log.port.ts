/**
 * Application-layer port for security-relevant audit logging of Super Admin
 * Platform actions (SECURITY.md §4, PERSONAS.md §13).
 *
 * Every privileged platform operation — tenant lifecycle transitions, plan
 * changes, and especially privileged-access grant/approve/reject/revoke and
 * break-glass — must be recorded synchronously and reliably, not as a
 * best-effort side effect of asynchronous event consumption. Handlers depend on
 * this port (Dependency Inversion); the infrastructure layer supplies an adapter
 * that writes to the platform's central audit trail. Bilingual (ar/en)
 * descriptions are carried so the audit trail is localizable.
 */
export interface PlatformAdminAuditRecord {
  tenantId: string;
  action: string;
  resourceId: string;
  actorId: string;
  actorRoles: string[];
  locale: string | null;
  reason: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  details: Record<string, string> | null;
  correlationId: string | null;
}

export interface PlatformAdminAuditLog {
  record(entry: PlatformAdminAuditRecord): Promise<void>;
}
