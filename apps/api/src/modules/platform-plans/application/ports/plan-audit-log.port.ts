import type { Prisma } from '@prisma/client';

export interface PlatformPlansAuditRecord {
  tenantId: string;
  action: string;
  resourceId: string;
  actorId: string;
  actorRoles: string[];
  locale: string | null;
  descriptionEn: string;
  descriptionAr: string;
  details: Record<string, string> | null;
  correlationId: string | null;
}

export interface PlatformPlansAuditLog {
  record(entry: PlatformPlansAuditRecord): Promise<void>;
  /**
   * Step 21 Model A — append the AuditEntry inside the caller's open transaction
   * client. Must throw (not swallow) on failure so the enclosing transaction
   * rolls back together with the business mutation it documents.
   */
  recordInTransaction(
    client: Prisma.TransactionClient,
    entry: PlatformPlansAuditRecord,
  ): Promise<void>;
}
