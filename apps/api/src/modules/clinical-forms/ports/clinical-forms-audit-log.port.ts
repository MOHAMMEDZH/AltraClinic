export interface ClinicalFormsAuditRecord {
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

export interface ClinicalFormsAuditLog {
  record(entry: ClinicalFormsAuditRecord): Promise<void>;
  recordInTransaction(
    client: unknown,
    entry: ClinicalFormsAuditRecord,
  ): Promise<void>;
}

export const CLINICAL_FORMS_AUDIT_LOG = Symbol('CLINICAL_FORMS_AUDIT_LOG');
