import { Test, TestingModule } from '@nestjs/testing';
import { LoyaltyPolicyService } from '../policies/loyalty-policy.service';

describe('LoyaltyPolicyService', () => {
  let policy: LoyaltyPolicyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoyaltyPolicyService],
    }).compile();

    policy = module.get(LoyaltyPolicyService);
  });

  it('returns false when user is null', async () => {
    await expect(policy.canAccess(null, {}, 'tenant-1')).resolves.toBe(false);
  });

  it('returns false when user tenant is missing', async () => {
    await expect(policy.canAccess({ id: 'user-1', roles: ['patient'] }, {}, 'tenant-1')).resolves.toBe(false);
  });

  it('returns false when user tenant mismatches', async () => {
    await expect(policy.canAccess({ id: 'user-1', roles: ['patient'], tenantId: 'tenant-2' }, {}, 'tenant-1')).resolves.toBe(false);
  });

  it('returns true for authorized roles with matching tenant', async () => {
    await expect(policy.canAccess({ id: 'user-1', roles: ['tenant_admin'], tenantId: 'tenant-1' }, {}, 'tenant-1')).resolves.toBe(true);
  });

  it('returns false for unauthorized roles even with matching tenant', async () => {
    await expect(policy.canAccess({ id: 'user-1', roles: ['guest'], tenantId: 'tenant-1' }, {}, 'tenant-1')).resolves.toBe(false);
  });
});
