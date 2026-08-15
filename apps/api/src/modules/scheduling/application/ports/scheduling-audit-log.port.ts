export interface SchedulingAuditRecord {
  tenantId: string;
  locale?: string | null;
  action: string;
  resourceId: string;
  actorId: string;
  actorRoles: string[];
  descriptionEn: string;
  descriptionAr: string;
  details?: Record<string, string | number | boolean | null> | null;
  correlationId?: string | null;
}

export interface SchedulingAuditLog {
  record(entry: SchedulingAuditRecord): Promise<void>;
  recordInTransaction(client: unknown, entry: SchedulingAuditRecord): Promise<void>;
}

export const SCHEDULING_AUDIT_LOG = Symbol('SCHEDULING_AUDIT_LOG');
