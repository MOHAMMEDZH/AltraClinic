export type AuditCenterAccessClass = 'standard' | 'sensitive' | 'network_metadata';

export type AuditCenterSearchFilters = {
  from?: string;
  to?: string;
  actorId?: string;
  action?: string;
  category?: string;
  resourceType?: string;
  resourceId?: string;
  tenantId?: string;
  correlationId?: string;
  cursor?: string;
  limit?: number;
};

export type AuditCenterCursor = {
  createdAt: string;
  id: string;
};

export type AuditCenterListItem = {
  id: string;
  occurredAt: string;
  action: string;
  category: string | null;
  resourceType: string;
  resourceId: string;
  actorId: string;
  actorRoles: string[];
  reason: string | null;
  correlationId: string | null;
  tenantId: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  beforeAfterSummary: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgentSummary: string | null;
  accessClass: AuditCenterAccessClass;
};

export type AuditCenterExportInput = {
  filters: AuditCenterSearchFilters;
  reason: string;
  filterFingerprint: string;
  confirmation?: string;
};

export type AuditCenterFailureInjectionPoint =
  | 'after_authorization'
  | 'after_query_parse'
  | 'after_source_lookup'
  | 'after_cursor_decode'
  | 'before_export_generate'
  | 'after_export_staging'
  | 'after_export_audit_staging'
  | 'before_commit'
  | 'after_commit_before_response'
  | 'redaction_failure'
  | 'immutability_update_attempt'
  | 'immutability_delete_attempt'
  | 'service_recreation_before_replay';

export class AuditCenterError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 400,
  ) {
    super(message);
    this.name = 'AuditCenterError';
  }
}
