import { ForbiddenException } from '@nestjs/common';
import { requireTenantScope } from '../tenant-scope.util';

describe('requireTenantScope', () => {
  it('requires x-tenant-id header', () => {
    expect(() => requireTenantScope({ headers: {}, user: { tenantId: 't1' } })).toThrow(ForbiddenException);
  });

  it('rejects JWT tenant mismatch', () => {
    expect(() =>
      requireTenantScope({
        headers: { 'x-tenant-id': 'tenant-a' },
        user: { tenantId: 'tenant-b' },
      }),
    ).toThrow('Tenant mismatch');
  });

  it('accepts matching JWT and header tenant', () => {
    const scope = requireTenantScope({
      headers: { 'x-tenant-id': 'tenant-a' },
      user: { tenantId: 'tenant-a', branchId: 'branch-1' },
    });
    expect(scope.tenantId).toBe('tenant-a');
  });

  it('rejects branch mismatch when both provided', () => {
    expect(() =>
      requireTenantScope({
        headers: { 'x-tenant-id': 'tenant-a', 'x-branch-id': 'branch-1' },
        user: { tenantId: 'tenant-a', branchId: 'branch-2' },
      }),
    ).toThrow('Branch mismatch');
  });
});
