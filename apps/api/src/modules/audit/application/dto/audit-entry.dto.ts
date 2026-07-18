export class AuditEntryDTO {
  id!: string;
  tenantId!: string;
  branchId!: string | null;
  action!: string;
  resourceType!: string;
  resourceId!: string;
  actorId!: string;
  actorRoles!: string[];
  category!: string | null;
  description!: string | null;
  details!: Record<string, string> | null;
  changes!: Record<string, { before?: string | null; after?: string | null }> | null;
  reason!: string | null;
  ipAddress!: string | null;
  userAgent!: string | null;
  correlationId!: string | null;
  locale!: string | null;
  createdAt!: Date;
}
