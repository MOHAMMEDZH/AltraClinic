import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  const prisma = {
    tenant: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    branch: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: { count: jest.fn() },
    department: { count: jest.fn() },
    tenantBillingSequence: { findMany: jest.fn(), upsert: jest.fn() },
  };

  const subscriptionEnforcement = {
    enforceBranchLimit: jest.fn().mockResolvedValue(undefined),
  };

  const service = new SettingsService(prisma as never, subscriptionEnforcement as never);

  it('creates a branch for tenant', async () => {
    prisma.branch.create.mockResolvedValue({ id: 'b1', name: 'Main', tenantId: 't1' });
    const result = await service.createBranch('t1', { name: 'Main' });
    expect(result.name).toBe('Main');
    expect(prisma.branch.create).toHaveBeenCalled();
  });

  it('archives a branch', async () => {
    prisma.branch.findFirst.mockResolvedValue({ id: 'b1', tenantId: 't1' });
    prisma.branch.update.mockResolvedValue({ id: 'b1', isActive: false });
    await service.archiveBranch('t1', 'b1');
    expect(prisma.branch.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
    );
  });
});
