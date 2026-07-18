import { PlatformAdminAuditLog, PlatformAdminAuditRecord } from '../../application/ports/platform-admin-audit-log.port';

/**
 * Test double for the {@link PlatformAdminAuditLog} port that captures records in
 * memory so specs can assert that privileged platform actions are audited.
 */
export class FakePlatformAdminAuditLog implements PlatformAdminAuditLog {
  readonly records: PlatformAdminAuditRecord[] = [];

  async record(entry: PlatformAdminAuditRecord): Promise<void> {
    this.records.push(entry);
  }
}
