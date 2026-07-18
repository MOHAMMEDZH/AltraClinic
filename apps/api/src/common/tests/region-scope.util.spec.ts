import { ForbiddenException } from '@nestjs/common';
import { requireRegionScope } from '../region-scope.util';

describe('requireRegionScope', () => {
  const tenantId = 'tenant-1';
  const branchId = 'branch-1';
  const userId = 'user-1';

  function prismaMock(overrides: {
    branchRegionId?: string | null;
    branchAccessMode?: 'SINGLE' | 'MULTI' | 'GLOBAL';
    grants?: string[];
  }) {
    return {
      branch: {
        findFirst: jest.fn().mockResolvedValue(
          overrides.branchRegionId === undefined ? null : { regionId: overrides.branchRegionId },
        ),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue(
          overrides.branchAccessMode ? { branchAccessMode: overrides.branchAccessMode } : { branchAccessMode: 'SINGLE' },
        ),
      },
      userRegionAccess: {
        findMany: jest.fn().mockResolvedValue(
          (overrides.grants ?? []).map((regionId) => ({ regionId })),
        ),
      },
    };
  }

  const request = {
    user: { id: userId, roles: ['branch_manager'] },
    headers: { 'x-tenant-id': tenantId, 'x-branch-id': branchId },
  };

  it('allows owners without region checks', async () => {
    const prisma = prismaMock({ branchRegionId: 'region-x', grants: [] });
    await expect(
      requireRegionScope(prisma as never, { user: { id: userId, roles: ['owner'] } }, tenantId, branchId),
    ).resolves.toBeUndefined();
    expect(prisma.branch.findFirst).not.toHaveBeenCalled();
  });

  it('allows access when user has no regional grants configured', async () => {
    const prisma = prismaMock({ branchRegionId: 'region-x', grants: [] });
    await expect(requireRegionScope(prisma as never, request, tenantId, branchId)).resolves.toBeUndefined();
  });

  it('allows access when branch region matches a grant', async () => {
    const prisma = prismaMock({ branchRegionId: 'region-x', grants: ['region-x'] });
    await expect(requireRegionScope(prisma as never, request, tenantId, branchId)).resolves.toBeUndefined();
  });

  it('denies access when branch region is outside grants', async () => {
    const prisma = prismaMock({ branchRegionId: 'region-x', grants: ['region-y'] });
    await expect(requireRegionScope(prisma as never, request, tenantId, branchId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('bypasses check for global branch access mode', async () => {
    const prisma = prismaMock({ branchRegionId: 'region-x', branchAccessMode: 'GLOBAL', grants: ['region-y'] });
    await expect(requireRegionScope(prisma as never, request, tenantId, branchId)).resolves.toBeUndefined();
  });
});
