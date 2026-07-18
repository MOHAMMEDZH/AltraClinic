import { AuditEntry } from './audit-entry.entity';

export interface AuditEntrySearchQuery {
  tenantId: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  actorId?: string;
  limit: number;
  offset: number;
}

export interface AuditEntryRepository {
  save(entry: AuditEntry): Promise<void>;
  findById(id: string, tenantId: string): Promise<AuditEntry | null>;
  search(query: AuditEntrySearchQuery): Promise<AuditEntry[]>;
}
