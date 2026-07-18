import { PlatformTenant } from '../domain/entities/platform-tenant.entity';
import { PrivilegedAccessDomainService } from '../domain/services/privileged-access.domain-service';

describe('PrivilegedAccessDomainService', () => {
  const service = new PrivilegedAccessDomainService();

  function activeTenant(): PlatformTenant {
    const tenant = PlatformTenant.provision({
      tenantId: 'tenant-1',
      displayName: 'Acme',
      region: 'eu-west',
      plan: 'growth',
      provisionedBy: 'admin-1',
    });
    tenant.activate();
    return tenant;
  }

  it('allows an admin holding an active grant for the scope', () => {
    const tenant = activeTenant();
    tenant.requestPrivilegedAccess({
      adminId: 'admin-2',
      adminName: 'Ops',
      scopes: ['support', 'read_only'],
      justification: 'support investigation',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      breakGlass: true,
    });

    expect(service.decide(tenant, 'admin-2', 'support').allowed).toBe(true);
    expect(service.decide(tenant, 'admin-2', 'read_only').allowed).toBe(true);
  });

  it('denies a scope the grant does not include', () => {
    const tenant = activeTenant();
    tenant.requestPrivilegedAccess({
      adminId: 'admin-2',
      adminName: 'Ops',
      scopes: ['read_only'],
      justification: 'read only investigation',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      breakGlass: true,
    });

    const decision = service.decide(tenant, 'admin-2', 'emergency_write');
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('scope_not_granted');
  });

  it('denies when the admin has no active grant', () => {
    const tenant = activeTenant();
    expect(service.decide(tenant, 'admin-2', 'support').reason).toBe('no_active_grant');
  });

  it('denies all access for an archived tenant', () => {
    const tenant = activeTenant();
    tenant.requestPrivilegedAccess({
      adminId: 'admin-2',
      adminName: 'Ops',
      scopes: ['support'],
      justification: 'support before archival',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      breakGlass: true,
    });
    tenant.archive('decommissioned');

    expect(service.decide(tenant, 'admin-2', 'support').reason).toBe('tenant_archived');
  });
});
