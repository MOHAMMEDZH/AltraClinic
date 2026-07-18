import { ListRegionsHandler } from '../application/handlers/user-enterprise-ext.handlers';

describe('ListRegionsHandler', () => {
  it('returns active regions for tenant', async () => {
    const prisma = {
      region: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'r1', name: 'Central', nameAr: 'الوسط' },
          { id: 'r2', name: 'North', nameAr: null },
        ]),
      },
    };
    const tenantContext = {
      resolve: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
    };
    const handler = new ListRegionsHandler(prisma as never, tenantContext as never);
    const result = await handler.execute();
    expect(result).toEqual([
      { id: 'r1', name: 'Central', nameAr: 'الوسط' },
      { id: 'r2', name: 'North', nameAr: null },
    ]);
    expect(prisma.region.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', isActive: true },
      orderBy: { name: 'asc' },
    });
  });
});
