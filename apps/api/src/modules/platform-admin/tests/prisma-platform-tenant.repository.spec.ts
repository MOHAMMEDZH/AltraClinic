import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPlatformTenantRepository } from '../infrastructure/prisma-platform-tenant.repository';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PlatformTenant } from '../domain/entities/platform-tenant.entity';

const mockTx = {
  platformTenant: { upsert: jest.fn() },
  privilegedAccessGrant: { upsert: jest.fn() },
};

const mockPrismaService = {
  $transaction: jest.fn((cb) => cb(mockTx)),
  platformTenant: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

function makePlatformTenant(): PlatformTenant {
  return PlatformTenant.provision({
    tenantId: 'tenant-001',
    displayName: 'Test Clinic',
    region: 'me-central',
    plan: 'starter',
    provisionedBy: 'admin-001',
  });
}

const prismaTenantRow = (pt: PlatformTenant) => ({
  id: pt.id,
  tenantId: pt.tenantId,
  displayName: pt.displayName,
  region: pt.region.value,
  plan: pt.plan.value,
  status: 'PROVISIONING',
  provisionedBy: pt.provisionedBy,
  activatedAt: null,
  suspendedAt: null,
  suspensionReason: null,
  archivedAt: null,
  archivedReason: null,
  createdAt: pt.createdAt,
  updatedAt: pt.updatedAt,
  privilegedGrants: [],
});

describe('PrismaPlatformTenantRepository', () => {
  let repo: PrismaPlatformTenantRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaPlatformTenantRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaPlatformTenantRepository>(PrismaPlatformTenantRepository);
  });

  describe('save()', () => {
    it('upserts platform tenant with correct status mapping', async () => {
      const pt = makePlatformTenant();
      await repo.save(pt);

      expect(mockTx.platformTenant.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            status: 'PROVISIONING',
            tenantId: 'tenant-001',
          }),
        }),
      );
    });

    it('does not call privilegedAccessGrant.upsert when no grants', async () => {
      const pt = makePlatformTenant();
      await repo.save(pt);
      expect(mockTx.privilegedAccessGrant.upsert).not.toHaveBeenCalled();
    });
  });

  describe('findById()', () => {
    it('returns null when not found', async () => {
      mockPrismaService.platformTenant.findUnique.mockResolvedValueOnce(null);
      const result = await repo.findById('nonexistent');
      expect(result).toBeNull();
    });

    it('reconstructs PlatformTenant with correct value objects', async () => {
      const pt = makePlatformTenant();
      mockPrismaService.platformTenant.findUnique.mockResolvedValueOnce(prismaTenantRow(pt));

      const result = await repo.findById(pt.id);

      expect(result).not.toBeNull();
      expect(result!.region.value).toBe('me-central');
      expect(result!.plan.value).toBe('starter');
      expect(result!.status.value).toBe('provisioning');
    });
  });

  describe('findByTenantId()', () => {
    it('queries by tenantId field', async () => {
      mockPrismaService.platformTenant.findFirst.mockResolvedValueOnce(null);
      await repo.findByTenantId('tenant-001');

      expect(mockPrismaService.platformTenant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-001' }),
        }),
      );
    });
  });

  describe('list()', () => {
    it('applies status filter', async () => {
      mockPrismaService.platformTenant.findMany.mockResolvedValueOnce([]);
      mockPrismaService.platformTenant.count.mockResolvedValueOnce(0);

      await repo.list({
        status: 'active',
        limit: 10,
        offset: 0,
      });

      expect(mockPrismaService.platformTenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
          take: 10,
          skip: 0,
        }),
      );
    });

    it('applies search filter as case-insensitive substring', async () => {
      mockPrismaService.platformTenant.findMany.mockResolvedValueOnce([]);
      mockPrismaService.platformTenant.count.mockResolvedValueOnce(0);

      await repo.list({ search: 'clinic', limit: 5, offset: 0 });

      expect(mockPrismaService.platformTenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ displayName: expect.objectContaining({ mode: 'insensitive' }) }),
            ]),
          }),
        }),
      );
    });

    it('returns correct pagination metadata', async () => {
      mockPrismaService.platformTenant.findMany.mockResolvedValueOnce([]);
      mockPrismaService.platformTenant.count.mockResolvedValueOnce(42);

      const result = await repo.list({ limit: 10, offset: 20 });

      expect(result.total).toBe(42);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
    });
  });
});
