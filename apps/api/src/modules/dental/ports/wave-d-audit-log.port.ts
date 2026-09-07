export interface WaveDAuditRecord {
  tenantId: string;
  action: string;
  resourceId: string;
  actorId: string;
  actorRoles: string[];
  descriptionEn: string;
  descriptionAr: string;
  details?: Record<string, string | number | boolean | null> | null;
}

export interface WaveDAuditLog {
  record(entry: WaveDAuditRecord): Promise<void>;
  recordInTransaction(client: unknown, entry: WaveDAuditRecord): Promise<void>;
}

export const WAVE_D_AUDIT_LOG = Symbol('WAVE_D_AUDIT_LOG');
