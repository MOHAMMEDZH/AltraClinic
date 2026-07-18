import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaCommissionRuleRepository } from '../infrastructure/prisma-commission-rule.repository';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { CommissionRule } from '../domain/entities/commission-rule.entity';
import { CommissionRate } from '../domain/value-objects/commission-rate.vo';

const mockPrismaService = {
  commissionRule: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

const TENANT_ID = 'tenant-001';

function makeRule(type: 'percentage' | 'fixed_amount' = 'percentage'): CommissionRule {
  return CommissionRule.create({
    tenantId: TENANT_ID,
    providerId: 'provider-001',
    serviceType: 'consultation',
    commissionRate: new CommissionRate(type, type === 'percentage' ? 15 : 50, null, null),
    effectiveDate: new Date('2026-01-01'),
    expiryDate: null,
  });
}

const prismaRow = (r: CommissionRule) => ({
  id: r.ruleId,
  tenantId: r.tenantId,
  providerId: r.providerId,
  serviceType: r.serviceType,
  rateType: r.commissionRate.type === 'percentage' ? 'PERCENTAGE' : 'FIXED_AMOUNT',
  rateValue: new Prisma.Decimal(r.commissionRate.value),
  minimumThreshold: null,
  maximumCap: null,
  effectiveDate: r.effectiveDate,
  expiryDate: r.expiryDate,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

describe('PrismaCommissionRuleRepository', () => {
  let repo: PrismaCommissionRuleRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaCommissionRuleRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaCommissionRuleRepository>(PrismaCommissionRuleRepository);
  });

  describe('save()', () => {
    it('upserts percentage rule with PERCENTAGE rateType', async () => {
      const rule = makeRule('percentage');
      await repo.save(rule);

      expect(mockPrismaService.commissionRule.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            tenantId: TENANT_ID,
            rateType: 'PERCENTAGE',
          }),
        }),
      );
    });

    it('upserts fixed-amount rule with FIXED_AMOUNT rateType', async () => {
      const rule = makeRule('fixed_amount');
      await repo.save(rule);

      expect(mockPrismaService.commissionRule.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ rateType: 'FIXED_AMOUNT' }),
        }),
      );
    });

    it('stores rateValue as Prisma.Decimal', async () => {
      const rule = makeRule();
      await repo.save(rule);

      const createArg = mockPrismaService.commissionRule.upsert.mock.calls[0][0].create;
      expect(createArg.rateValue).toBeInstanceOf(Prisma.Decimal);
      expect(createArg.rateValue.toNumber()).toBe(15);
    });
  });

  describe('findById()', () => {
    it('returns null when not found', async () => {
      mockPrismaService.commissionRule.findFirst.mockResolvedValueOnce(null);
      const result = await repo.findById('rule-999', TENANT_ID);
      expect(result).toBeNull();
    });

    it('queries with soft delete guard', async () => {
      mockPrismaService.commissionRule.findFirst.mockResolvedValueOnce(null);
      await repo.findById('rule-001', TENANT_ID);

      expect(mockPrismaService.commissionRule.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });

    it('reconstructs CommissionRule with percentage rate', async () => {
      const rule = makeRule('percentage');
      mockPrismaService.commissionRule.findFirst.mockResolvedValueOnce(prismaRow(rule));

      const result = await repo.findById(rule.ruleId, TENANT_ID);

      expect(result).not.toBeNull();
      expect(result!.commissionRate.type).toBe('percentage');
      expect(result!.commissionRate.value).toBe(15);
    });

    it('maps FIXED_AMOUNT back to fixed_amount', async () => {
      const rule = makeRule('fixed_amount');
      mockPrismaService.commissionRule.findFirst.mockResolvedValueOnce(prismaRow(rule));

      const result = await repo.findById(rule.ruleId, TENANT_ID);
      expect(result!.commissionRate.type).toBe('fixed_amount');
    });
  });

  describe('list()', () => {
    it('filters by tenantId and providerId', async () => {
      mockPrismaService.commissionRule.findMany.mockResolvedValueOnce([]);

      await repo.list({ tenantId: TENANT_ID, providerId: 'provider-001' });

      expect(mockPrismaService.commissionRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: TENANT_ID,
            providerId: 'provider-001',
            deletedAt: null,
          }),
        }),
      );
    });

    it('applies effectiveDate range filter (lte) when provided', async () => {
      mockPrismaService.commissionRule.findMany.mockResolvedValueOnce([]);

      const effectiveDate = new Date('2026-06-01');
      await repo.list({ tenantId: TENANT_ID, effectiveDate });

      expect(mockPrismaService.commissionRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            effectiveDate: { lte: effectiveDate },
            OR: expect.arrayContaining([{ expiryDate: null }]),
          }),
        }),
      );
    });

    it('filters by null providerId (global rules)', async () => {
      mockPrismaService.commissionRule.findMany.mockResolvedValueOnce([]);

      await repo.list({ tenantId: TENANT_ID, providerId: null });

      const callArg = mockPrismaService.commissionRule.findMany.mock.calls[0][0];
      expect(callArg.where.providerId).toBeNull();
    });
  });
});
