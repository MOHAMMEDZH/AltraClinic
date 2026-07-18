export type ReportAuditAction =
  | 'created'
  | 'viewed'
  | 'exported'
  | 'shared'
  | 'scheduled'
  | 'duplicated'
  | 'downloaded';

export interface ReportAuditEntry {
  id: string;
  reportId: string;
  action: ReportAuditAction;
  userId: string;
  userName?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
