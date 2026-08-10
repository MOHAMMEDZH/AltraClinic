import type {
  PlatformPlansAuditLog,
  PlatformPlansAuditRecord,
} from '../../application/ports/plan-audit-log.port';

export class FakePlanAuditLog implements PlatformPlansAuditLog {
  readonly records: PlatformPlansAuditRecord[] = [];
  async record(entry: PlatformPlansAuditRecord): Promise<void> {
    this.records.push(entry);
  }
  async recordInTransaction(_client: unknown, entry: PlatformPlansAuditRecord): Promise<void> {
    this.records.push(entry);
  }
}
