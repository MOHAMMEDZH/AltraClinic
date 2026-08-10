import {
  PlatformTenantsAuditLog,
  PlatformTenantsAuditRecord,
} from '../../application/ports/platform-tenants-audit-log.port';

export class FakePlatformTenantsAuditLog implements PlatformTenantsAuditLog {
  readonly records: PlatformTenantsAuditRecord[] = [];

  async record(entry: PlatformTenantsAuditRecord): Promise<void> {
    this.records.push(entry);
  }
}
