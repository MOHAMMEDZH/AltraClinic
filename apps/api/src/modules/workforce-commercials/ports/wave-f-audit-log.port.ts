export const WAVE_F_AUDIT_LOG = Symbol('WAVE_F_AUDIT_LOG');

export type WaveFAuditRecord = {
  tenantId: string;
  actorId: string;
  actorRoles: string[];
  action: string;
  resourceId: string;
  descriptionEn: string;
  descriptionAr?: string | null;
  details?: Record<string, string | number | boolean | null | undefined>;
};

export interface WaveFAuditLog {
  record(entry: WaveFAuditRecord): Promise<void>;
  recordInTransaction(client: unknown, entry: WaveFAuditRecord): Promise<void>;
}
