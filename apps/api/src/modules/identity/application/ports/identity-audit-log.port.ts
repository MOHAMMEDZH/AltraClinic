export interface IdentityAuditRecord {
  tenantId: string;
  branchId: string | null;
  action: string;
  resourceId: string;
  actorId: string;
  actorRoles: string[];
  locale: string | null;
  reason?: string | null;
  details?: Record<string, unknown> | null;
  changes?: Record<string, unknown> | null;
  correlationId?: string | null;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface IdentityAuditLog {
  record(entry: IdentityAuditRecord): Promise<void>;
}

export const IDENTITY_AUDIT_LOG = 'IDENTITY_AUDIT_LOG';
