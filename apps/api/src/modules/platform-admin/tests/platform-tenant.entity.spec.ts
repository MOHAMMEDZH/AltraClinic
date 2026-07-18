import { PlatformTenant } from '../domain/entities/platform-tenant.entity';
import {
  PlatformAdminStateError,
  PlatformAdminValidationError,
} from '../domain/exceptions/platform-admin.exception';

describe('PlatformTenant aggregate', () => {
  const baseParams = {
    tenantId: 'tenant-1',
    displayName: 'Acme Dental',
    region: 'me-central',
    plan: 'starter',
    provisionedBy: 'admin-1',
  };

  function provisioned(): PlatformTenant {
    return PlatformTenant.provision(baseParams);
  }

  function active(): PlatformTenant {
    const tenant = provisioned();
    tenant.activate();
    return tenant;
  }

  it('provisions in the provisioning state', () => {
    const tenant = provisioned();
    expect(tenant.status.value).toBe('provisioning');
    expect(tenant.tenantId).toBe('tenant-1');
    expect(tenant.plan.value).toBe('starter');
    expect(tenant.region.value).toBe('me-central');
  });

  it('rejects an invalid region or plan at provisioning', () => {
    expect(() => PlatformTenant.provision({ ...baseParams, region: 'mars' })).toThrow(PlatformAdminValidationError);
    expect(() => PlatformTenant.provision({ ...baseParams, plan: 'unlimited' })).toThrow(PlatformAdminValidationError);
  });

  it('requires tenantId, displayName and provisionedBy', () => {
    expect(() => PlatformTenant.provision({ ...baseParams, tenantId: ' ' })).toThrow(PlatformAdminValidationError);
    expect(() => PlatformTenant.provision({ ...baseParams, displayName: ' ' })).toThrow(PlatformAdminValidationError);
    expect(() => PlatformTenant.provision({ ...baseParams, provisionedBy: ' ' })).toThrow(PlatformAdminValidationError);
  });

  it('activates from provisioning and exposes plan limits', () => {
    const tenant = active();
    expect(tenant.status.value).toBe('active');
    expect(tenant.plan.limits).toEqual({ maxBranches: 1, maxUsers: 10 });
  });

  it('cannot activate an already-active tenant', () => {
    const tenant = active();
    expect(() => tenant.activate()).toThrow(PlatformAdminStateError);
  });

  it('suspends an active tenant with a reason and resumes it', () => {
    const tenant = active();
    tenant.suspend('non-payment');
    expect(tenant.status.value).toBe('suspended');
    expect(tenant.suspensionReason).toBe('non-payment');

    tenant.resume();
    expect(tenant.status.value).toBe('active');
    expect(tenant.suspensionReason).toBeNull();
  });

  it('requires a reason to suspend and only suspends active tenants', () => {
    const tenant = active();
    expect(() => tenant.suspend(' ')).toThrow(PlatformAdminValidationError);
    tenant.suspend('reason');
    expect(() => tenant.suspend('again')).toThrow(PlatformAdminStateError);
  });

  it('changes plan and is idempotent for the same plan', () => {
    const tenant = active();
    expect(tenant.changePlan('growth')).toBe(true);
    expect(tenant.plan.value).toBe('growth');
    expect(tenant.changePlan('growth')).toBe(false);
  });

  it('archives terminally and cascades revocation of active grants', () => {
    const tenant = active();
    const grant = tenant.requestPrivilegedAccess({
      adminId: 'admin-2',
      adminName: 'Ops Two',
      scopes: ['support'],
      justification: 'incident triage',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      breakGlass: true,
    });
    expect(grant.isActive()).toBe(true);

    tenant.archive('contract ended');
    expect(tenant.status.value).toBe('archived');
    expect(tenant.findGrant(grant.grantId)?.status).toBe('revoked');
    expect(() => tenant.archive('again')).toThrow(PlatformAdminStateError);
  });

  it('forbids privileged access on provisioning or archived tenants', () => {
    const provisioning = provisioned();
    expect(() =>
      provisioning.requestPrivilegedAccess({
        adminId: 'admin-2',
        adminName: 'Ops',
        scopes: ['support'],
        justification: 'too early to help',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        breakGlass: false,
      }),
    ).toThrow(PlatformAdminStateError);
  });

  it('enforces the maximum privileged-access duration', () => {
    const tenant = active();
    expect(() =>
      tenant.requestPrivilegedAccess({
        adminId: 'admin-2',
        adminName: 'Ops',
        scopes: ['support'],
        justification: 'long lived access',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        breakGlass: false,
      }),
    ).toThrow(PlatformAdminValidationError);
  });

  it('caps simultaneous active privileged grants', () => {
    const tenant = active();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    for (let i = 0; i < PlatformTenant.MAX_ACTIVE_PRIVILEGED_GRANTS; i++) {
      tenant.requestPrivilegedAccess({
        adminId: `admin-${i}`,
        adminName: `Ops ${i}`,
        scopes: ['support'],
        justification: 'concurrent access window',
        expiresAt,
        breakGlass: true,
      });
    }
    expect(() =>
      tenant.requestPrivilegedAccess({
        adminId: 'admin-overflow',
        adminName: 'Ops Overflow',
        scopes: ['support'],
        justification: 'one too many',
        expiresAt,
        breakGlass: true,
      }),
    ).toThrow(PlatformAdminStateError);
  });

  it('round-trips through primitives and restore', () => {
    const tenant = active();
    const primitives = tenant.toPrimitives();
    expect(primitives.status).toBe('active');
    expect(primitives.planLimits).toEqual({ maxBranches: 1, maxUsers: 10 });
  });
});
