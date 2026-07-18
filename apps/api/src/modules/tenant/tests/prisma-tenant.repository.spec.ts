import { Test, TestingModule } from '@nestjs/testing';
import { PrismaTenantRepository } from '../infrastructure/prisma-tenant.repository';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Tenant } from '../domain/tenant.entity';
import { TenantSettingsVO } from '../domain/tenant-settings.vo';

const mockPrismaService = {
  tenant: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
  },
};

function makeTenant(): Tenant {
  const settings = new TenantSettingsVO('Asia/Dubai', 'ar-AE', 365, { loyalty: true });
  return new Tenant('tenant-001', 'Al-Noor Dental', null, settings, new Date());
}

const prismaRow = (t: Tenant) => ({
  id: t.id,
  name: t.name,
  customDomain: t.domain?.value ?? null,
  timezone: t.settings.timezone,
  locale: t.settings.locale,
  dataRetentionDays: 365,
  features: { loyalty: true },
  createdAt: t.createdAt,
  updatedAt: new Date(),
});

describe('PrismaTenantRepository', () => {
  let repo: PrismaTenantRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaTenantRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaTenantRepository>(PrismaTenantRepository);
  });

  describe('save()', () => {
    it('upserts tenant with name, timezone, and locale', async () => {
      const tenant = makeTenant();
      await repo.save(tenant);

      expect(mockPrismaService.tenant.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            name: 'Al-Noor Dental',
            timezone: 'Asia/Dubai',
            locale: 'ar-AE',
          }),
        }),
      );
    });

    it('sets domain to null when no TenantDomainVO', async () => {
      const tenant = makeTenant();
      await repo.save(tenant);

      const createArg = mockPrismaService.tenant.upsert.mock.calls[0][0].create;
      expect(createArg.customDomain).toBeNull();
    });

    it('persists features as JSON object', async () => {
      const tenant = makeTenant();
      await repo.save(tenant);

      const createArg = mockPrismaService.tenant.upsert.mock.calls[0][0].create;
      expect(typeof createArg.features).toBe('object');
    });
  });

  describe('findById()', () => {
    it('returns null when not found', async () => {
      mockPrismaService.tenant.findFirst.mockResolvedValueOnce(null);
      const result = await repo.findById('t-999');
      expect(result).toBeNull();
    });

    it('queries with soft delete guard', async () => {
      mockPrismaService.tenant.findFirst.mockResolvedValueOnce(null);
      await repo.findById('tenant-001');

      expect(mockPrismaService.tenant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });

    it('reconstructs Tenant with TenantSettingsVO', async () => {
      const tenant = makeTenant();
      mockPrismaService.tenant.findFirst.mockResolvedValueOnce(prismaRow(tenant));

      const result = await repo.findById(tenant.id);

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Al-Noor Dental');
      expect(result!.settings.timezone).toBe('Asia/Dubai');
      expect(result!.settings.locale).toBe('ar-AE');
    });
  });

  describe('findByDomain()', () => {
    it('queries by lowercased, trimmed domain', async () => {
      mockPrismaService.tenant.findFirst.mockResolvedValueOnce(null);

      await repo.findByDomain('  MyClinic.com  ');

      expect(mockPrismaService.tenant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customDomain: 'myclinic.com', deletedAt: null }),
        }),
      );
    });
  });
});
