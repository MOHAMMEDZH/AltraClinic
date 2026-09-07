export interface ServicePerformanceAuditRecord {
  tenantId: string;
  action: string;
  resourceId: string;
  actorId: string;
  actorRoles: string[];
  descriptionEn: string;
  descriptionAr: string;
  details?: Record<string, string | number | boolean | null> | null;
}

export interface ServicePerformanceAuditLog {
  record(entry: ServicePerformanceAuditRecord): Promise<void>;
  recordInTransaction(client: unknown, entry: ServicePerformanceAuditRecord): Promise<void>;
}

export const SERVICE_PERFORMANCE_AUDIT_LOG = Symbol('SERVICE_PERFORMANCE_AUDIT_LOG');
