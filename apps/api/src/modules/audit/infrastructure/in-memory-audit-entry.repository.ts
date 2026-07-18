import { Injectable } from '@nestjs/common';
import { AuditEntry } from '../domain/audit-entry.entity';
import { AuditEntryRepository, AuditEntrySearchQuery } from '../domain/audit-entry.repository.interface';

@Injectable()
export class InMemoryAuditEntryRepository implements AuditEntryRepository {
  private readonly store = new Map<string, AuditEntry>();

  async save(entry: AuditEntry): Promise<void> {
    this.store.set(entry.id, entry);
  }

  async findById(id: string, tenantId: string): Promise<AuditEntry | null> {
    const entry = this.store.get(id);
    if (!entry || entry.tenantId !== tenantId) return null;
    return entry;
  }

  async search(query: AuditEntrySearchQuery): Promise<AuditEntry[]> {
    const results: AuditEntry[] = [];

    for (const entry of this.store.values()) {
      if (entry.tenantId !== query.tenantId) continue;
      if (query.action && entry.action !== query.action) continue;
      if (query.resourceType && entry.resourceType !== query.resourceType) continue;
      if (query.resourceId && entry.resourceId !== query.resourceId) continue;
      if (query.actorId && entry.actorId !== query.actorId) continue;
      results.push(entry);
    }

    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return results.slice(query.offset, query.offset + query.limit);
  }
}
