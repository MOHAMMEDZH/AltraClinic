import { AuditTrailPortalAuditLog } from '../infrastructure/audit-trail-portal-audit-log';
import { InMemoryAuditEntryRepository } from '../../audit/infrastructure/in-memory-audit-entry.repository';

describe('AuditTrailPortalAuditLog (bridge to central audit trail)', () => {
  it('persists a portal audit record into the central audit repository', async () => {
    const auditRepository = new InMemoryAuditEntryRepository();
    const adapter = new AuditTrailPortalAuditLog(auditRepository);

    await adapter.record({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      action: 'patient_portal.account.invited',
      resourceId: 'portal-1',
      actorId: 'staff-1',
      actorRoles: ['receptionist'],
      locale: 'en',
      reason: null,
      details: { patientId: 'patient-1' },
      correlationId: 'corr-1',
    });

    const found = await auditRepository.search({
      tenantId: 'tenant-1',
      action: 'patient_portal.account.invited',
      limit: 10,
      offset: 0,
    });

    expect(found).toHaveLength(1);
    expect(found[0].tenantId).toBe('tenant-1');
    expect(found[0].resourceId).toBe('portal-1');
  });

  it('isolates audit records by tenant', async () => {
    const auditRepository = new InMemoryAuditEntryRepository();
    const adapter = new AuditTrailPortalAuditLog(auditRepository);

    await adapter.record({
      tenantId: 'tenant-1',
      branchId: null,
      action: 'patient_portal.account.deactivated',
      resourceId: 'portal-1',
      actorId: 'mgr-1',
      actorRoles: ['tenant_admin'],
      locale: 'en',
      reason: 'closed',
      details: {},
      correlationId: null,
    });

    const otherTenant = await auditRepository.search({
      tenantId: 'tenant-2',
      limit: 10,
      offset: 0,
    });
    expect(otherTenant).toHaveLength(0);
  });
});
