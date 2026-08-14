import type { ClinicalCatalogAuditRecord } from '../../application/ports/clinical-catalog-audit-log.port';

export class FakeClinicalCatalogAuditLog {
  readonly entries: ClinicalCatalogAuditRecord[] = [];

  async record(entry: ClinicalCatalogAuditRecord): Promise<void> {
    this.entries.push(entry);
  }

  async recordInTransaction(_client: unknown, entry: ClinicalCatalogAuditRecord): Promise<void> {
    this.entries.push(entry);
  }
}
