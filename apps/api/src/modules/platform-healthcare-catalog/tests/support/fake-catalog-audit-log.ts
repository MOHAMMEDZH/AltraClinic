import type {
  HealthcareCatalogAuditLog,
  HealthcareCatalogAuditRecord,
} from '../../application/ports/catalog-audit-log.port';

export class FakeCatalogAuditLog implements HealthcareCatalogAuditLog {
  readonly records: HealthcareCatalogAuditRecord[] = [];

  async record(entry: HealthcareCatalogAuditRecord): Promise<void> {
    this.records.push(entry);
  }

  async recordInTransaction(
    _client: unknown,
    entry: HealthcareCatalogAuditRecord,
  ): Promise<void> {
    this.records.push(entry);
  }
}
