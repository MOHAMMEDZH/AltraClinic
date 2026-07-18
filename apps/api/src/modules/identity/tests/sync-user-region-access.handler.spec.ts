import { ConflictException } from '@nestjs/common';
import { SyncUserRegionAccessHandler } from '../application/handlers/user-enterprise-ext.handlers';

describe('SyncUserRegionAccessHandler', () => {
  const tenantContext = {
    resolve: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
  };

  it('rejects unknown region ids', async () => {
    const prisma = {
      region: {
        findMany: jest.fn().mockResolvedValue([{ id: 'r1' }]),
      },
      $transaction: jest.fn(),
    };
    const handler = new SyncUserRegionAccessHandler(prisma as never, tenantContext as never);
    await expect(handler.execute('user-1', ['r1', 'bad'])).rejects.toBeInstanceOf(ConflictException);
  });

  it('syncs valid region grants', async () => {
    const tx = {
      userRegionAccess: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
    };
    const prisma = {
      region: {
        findMany: jest.fn().mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]),
      },
      $transaction: jest.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    };
    const handler = new SyncUserRegionAccessHandler(prisma as never, tenantContext as never);
    const result = await handler.execute('user-1', ['r1', 'r2']);
    expect(result).toEqual(['r1', 'r2']);
    expect(tx.userRegionAccess.deleteMany).toHaveBeenCalled();
    expect(tx.userRegionAccess.createMany).toHaveBeenCalled();
  });
});
