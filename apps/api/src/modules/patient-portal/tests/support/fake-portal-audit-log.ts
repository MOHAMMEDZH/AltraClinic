import { PortalAuditLog, PortalAuditRecord } from '../../application/ports/portal-audit-log.port';

/**
 * Test double for the {@link PortalAuditLog} port that captures records in
 * memory so specs can assert that security-sensitive actions are audited.
 */
export class FakePortalAuditLog implements PortalAuditLog {
  readonly records: PortalAuditRecord[] = [];

  async record(entry: PortalAuditRecord): Promise<void> {
    this.records.push(entry);
  }
}
