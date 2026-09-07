export interface ClinicalCatalogAuditRecord {
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

export interface ClinicalCatalogAuditLog {
  record(entry: ClinicalCatalogAuditRecord): Promise<void>;
  recordInTransaction(
    client: unknown,
    entry: ClinicalCatalogAuditRecord,
  ): Promise<void>;
}

export const CLINICAL_CATALOG_AUDIT_LOG = Symbol('CLINICAL_CATALOG_AUDIT_LOG');
