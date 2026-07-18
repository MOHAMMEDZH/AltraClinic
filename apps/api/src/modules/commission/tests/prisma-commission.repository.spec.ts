import { Test, TestingModule } from '@nestjs/testing';
import { PrismaCommissionRepository } from '../infrastructure/prisma-commission.repository';
import { PrismaCommissionRuleRepository } from '../infrastructure/prisma-commission-rule.repository';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { CommissionCalculation } from '../domain/entities/commission-calculation.entity';
import { CommissionRule } from '../domain/entities/commission-rule.entity';
import { CommissionRate } from '../domain/value-objects/commission-rate.vo';

const mockTx = {
  commissionCalculation: { upsert: jest.fn() },
  commissionLineItem: {
    deleteMany: jest.fn(),
    create: jest.fn(),
  },
};

const mockPrismaService = {
  $transaction: jest.fn((cb) => cb(mockTx)),
  commissionCalculation: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  commissionRule: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

const TENANT_ID = 'tenant-001';

function makeCommission(): CommissionCalculation {
  return CommissionCalculation.create({
    commissionId: 'comm-001',
    tenantId: TENANT_ID,
    branchId: 'branch-001',
    providerId: 'provider-001',
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-01-31'),
    lineItems: [
      {
        serviceDescription: 'Dental Cleaning',
        serviceType: 'dental',
        amount: 10000,
        commissionRateType: 'percentage',
        commissionRateValue: 10,
        date: new Date('2024-01-15'),
      },
    ],
  });
}

function makeRule(): CommissionRule {
  return CommissionRule.create({
    tenantId: TENANT_ID,
    providerId: 'provider-001',
    serviceType: 'dental',
    commissionRate: new CommissionRate('percentage', 10),
    effectiveDate: new Date('2024-01-01'),
  });
}

describe('PrismaCommissionRepository', () => {
  let repo: PrismaCommissionRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaCommissionRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaCommissionRepository>(PrismaCommissionRepository);
  });

  describe('save()', () => {
    it('maps calculated status to CALCULATED', async () => {
      const commission = makeCommission();
      await repo.save(commission);

      expect(mockTx.commissionCalculation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'CALCULATED' }),
        }),
      );
    });

    it('delete-recreates line items for idempotency', async () => {
      const commission = makeCommission();
      await repo.save(commission);

      expect(mockTx.commissionLineItem.deleteMany).toHaveBeenCalledWith({
        where: { commissionId: 'comm-001' },
      });
      expect(mockTx.commissionLineItem.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('list()', () => {
    it('filters by providerId', async () => {
      mockPrismaService.commissionCalculation.findMany.mockResolvedValueOnce([]);

      await repo.list({ tenantId: TENANT_ID, providerId: 'provider-001' });

      expect(mockPrismaService.commissionCalculation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ providerId: 'provider-001' }),
        }),
      );
    });
  });
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
    it('maps percentage rate to PERCENTAGE', async () => {
      const rule = makeRule();
      await repo.save(rule);

      expect(mockPrismaService.commissionRule.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ rateType: 'PERCENTAGE', rateValue: expect.anything() }),
        }),
      );
    });
  });

  describe('list()', () => {
    it('applies effectiveDate range filter', async () => {
      mockPrismaService.commissionRule.findMany.mockResolvedValueOnce([]);
      const refDate = new Date('2024-06-15');

      await repo.list({ tenantId: TENANT_ID, effectiveDate: refDate });

      expect(mockPrismaService.commissionRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            effectiveDate: { lte: refDate },
          }),
        }),
      );
    });
  });
});
