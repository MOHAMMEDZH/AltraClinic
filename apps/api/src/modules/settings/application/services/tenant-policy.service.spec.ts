import { TenantPolicyService } from './tenant-policy.service';

describe('TenantPolicyService', () => {
  const prisma = {
    tenant: { findUnique: jest.fn() },
  };
  const service = new TenantPolicyService(prisma as never);

  it('loads security policy from tenant features', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      features: { securityPolicy: { minPasswordLength: 12, mfaRequired: true } },
    });
    const policy = await service.getSecurityPolicy('tenant-1');
    expect(policy.minPasswordLength).toBe(12);
    expect(policy.mfaRequired).toBe(true);
  });

  it('detects maintenance mode', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      features: { advancedSettings: { maintenanceMode: true } },
    });
    expect(await service.isMaintenanceMode('tenant-1')).toBe(true);
  });

  it('defaults allowPatientPortal OFF', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ features: { advancedSettings: {} } });
    const policy = await service.getAdvancedPolicy('tenant-1');
    expect(policy.allowPatientPortal).toBe(false);
    expect(policy.allowObservability).toBe(false);
  });
});
