export const WAVE_E_AUDIT_LOG = Symbol('WAVE_E_AUDIT_LOG');

export type WaveEAuditRecord = {
  tenantId: string;
  actorId: string;
  actorRoles: string[];
  action: string;
  resourceId: string;
  descriptionEn: string;
  descriptionAr?: string | null;
  details?: Record<string, string | number | boolean | null | undefined>;
};

export interface WaveEAuditLog {
  record(entry: WaveEAuditRecord): Promise<void>;
  recordInTransaction(client: unknown, entry: WaveEAuditRecord): Promise<void>;
}
