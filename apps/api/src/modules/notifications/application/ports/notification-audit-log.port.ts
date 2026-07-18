export interface NotificationAuditRecord {
  tenantId: string;
  branchId: string | null;
  action: string;
  resourceId: string;
  actorId: string;
  actorRoles: string[];
  locale?: string | null;
  reason?: string | null;
  details?: Record<string, unknown> | null;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
}

export interface NotificationAuditLog {
  record(entry: NotificationAuditRecord): Promise<void>;
}

export const NOTIFICATION_AUDIT_LOG = 'NOTIFICATION_AUDIT_LOG';
