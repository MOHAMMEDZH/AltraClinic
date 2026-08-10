import type {
  PlatformAddonsAuditLog,
  PlatformAddonsAuditRecord,
} from '../../application/ports/addon-audit-log.port';

export class FakeAddonAuditLog implements PlatformAddonsAuditLog {
  readonly records: PlatformAddonsAuditRecord[] = [];
  async record(entry: PlatformAddonsAuditRecord): Promise<void> {
    this.records.push(entry);
  }
  async recordInTransaction(_client: unknown, entry: PlatformAddonsAuditRecord): Promise<void> {
    this.records.push(entry);
  }
}
