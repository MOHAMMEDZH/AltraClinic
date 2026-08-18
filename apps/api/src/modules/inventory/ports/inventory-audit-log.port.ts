export interface InventoryAuditRecord {
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

export interface InventoryAuditLog {
  record(entry: InventoryAuditRecord): Promise<void>;
  recordInTransaction(client: unknown, entry: InventoryAuditRecord): Promise<void>;
}

export const INVENTORY_AUDIT_LOG = Symbol('INVENTORY_AUDIT_LOG');
