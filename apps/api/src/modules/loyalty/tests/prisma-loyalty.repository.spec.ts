import { Test, TestingModule } from '@nestjs/testing';
import { LoyaltyRewardStatus } from '@prisma/client';
import { PrismaLoyaltyAccountRepository } from '../infrastructure/prisma-loyalty-account.repository';
import { PrismaLoyaltyRewardRepository } from '../infrastructure/prisma-loyalty-reward.repository';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { LoyaltyAccount } from '../domain/entities/loyalty-account.entity';
import { LoyaltyReward } from '../domain/entities/loyalty-reward.entity';
import { LoyaltyTierService } from '../domain/services/loyalty-tier.service';

const mockTx = {
  loyaltyAccount: { upsert: jest.fn() },
  loyaltyTransaction: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
  },
};

const mockPrismaService = {
  $transaction: jest.fn((cb) => cb(mockTx)),
  loyaltyAccount: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  loyaltyReward: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

const TENANT_ID = 'tenant-001';

function makeLoyaltyAccount(): LoyaltyAccount {
  return LoyaltyAccount.create({
    tenantId: TENANT_ID,
    patientId: 'patient-001',
    clinicId: 'clinic-001',
    tier: LoyaltyTierService.resolveTier(0),
  });
}

const prismaAccountRow = (account: LoyaltyAccount) => ({
  id: account.accountId,
  tenantId: account.tenantId,
  patientId: account.patientId,
  clinicId: account.clinicId,
  pointsBalance: account.points.balance,
  tier: account.tier.name.toUpperCase(),
  enrollmentDate: account.enrollmentDate,
  lastActivityDate: account.lastActivityDate,
  isActive: account.isActive,
  createdAt: account.createdAt,
  updatedAt: account.updatedAt,
  transactions: [],
});

describe('PrismaLoyaltyAccountRepository', () => {
  let repo: PrismaLoyaltyAccountRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaLoyaltyAccountRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaLoyaltyAccountRepository>(PrismaLoyaltyAccountRepository);
  });

  describe('save()', () => {
    it('upserts account with correct fields', async () => {
      const account = makeLoyaltyAccount();
      await repo.save(account);

      expect(mockTx.loyaltyAccount.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            tenantId: TENANT_ID,
            pointsBalance: 0,
            isActive: true,
          }),
        }),
      );
    });

    it('only persists new transactions (append-only)', async () => {
      const account = makeLoyaltyAccount();
      mockTx.loyaltyTransaction.findMany.mockResolvedValueOnce([]);

      // Add a transaction to the account
      account.earnPoints(100, 'ref-001', 'Test earn');

      await repo.save(account);

      expect(mockTx.loyaltyTransaction.create).toHaveBeenCalledTimes(1);
    });

    it('skips transactions already in DB', async () => {
      const account = makeLoyaltyAccount();

      // First, simulate that a transaction was already saved
      const txn = account.earnPoints(100, 'ref-001', 'Already saved');
      const existingId = account.transactions[0].transactionId;

      mockTx.loyaltyTransaction.findMany.mockResolvedValueOnce([{ id: existingId }]);

      await repo.save(account);

      expect(mockTx.loyaltyTransaction.create).not.toHaveBeenCalled();
    });
  });

  describe('findByPatient()', () => {
    it('queries by patientId and tenantId', async () => {
      mockPrismaService.loyaltyAccount.findFirst.mockResolvedValueOnce(null);

      await repo.findByPatient('patient-001', TENANT_ID);

      expect(mockPrismaService.loyaltyAccount.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patientId: 'patient-001', tenantId: TENANT_ID },
        }),
      );
    });

    it('reconstructs account with resolved tier', async () => {
      const account = makeLoyaltyAccount();
      mockPrismaService.loyaltyAccount.findFirst.mockResolvedValueOnce(prismaAccountRow(account));

      const result = await repo.findByPatient('patient-001', TENANT_ID);

      expect(result).not.toBeNull();
      expect(result!.tier.name).toBe('Bronze');
      expect(result!.points.balance).toBe(0);
    });
  });
});

describe('PrismaLoyaltyRewardRepository', () => {
  let repo: PrismaLoyaltyRewardRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaLoyaltyRewardRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaLoyaltyRewardRepository>(PrismaLoyaltyRewardRepository);
  });

  describe('listAvailableByTenant()', () => {
    it('filters by AVAILABLE status and non-expired date', async () => {
      mockPrismaService.loyaltyReward.findMany.mockResolvedValueOnce([]);

      await repo.listAvailableByTenant(TENANT_ID);

      expect(mockPrismaService.loyaltyReward.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: LoyaltyRewardStatus.AVAILABLE,
            OR: expect.arrayContaining([
              { expiryDate: null },
            ]),
          }),
        }),
      );
    });
  });

  describe('save()', () => {
    it('maps domain status to uppercase', async () => {
      const reward = LoyaltyReward.create({
        tenantId: TENANT_ID,
        accountId: 'account-001',
        pointsRequired: 500,
        description: 'Free consultation',
        expiryDate: new Date(Date.now() + 86400000 * 30),
      });

      await repo.save(reward);

      expect(mockPrismaService.loyaltyReward.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: 'AVAILABLE' }),
        }),
      );
    });
  });
});
