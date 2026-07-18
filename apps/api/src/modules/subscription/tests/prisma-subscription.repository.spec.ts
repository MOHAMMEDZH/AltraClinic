import { Test, TestingModule } from '@nestjs/testing';
import { PrismaSubscriptionRepository } from '../infrastructure/prisma-subscription.repository';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Subscription } from '../domain/entities/subscription.entity';
import { SubscriptionPlanVO } from '../domain/value-objects/subscription-plan.vo';

const mockPrismaService = {
  clinicSubscription: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const TENANT_ID = 'tenant-001';

function makeSubscription(): Subscription {
  return Subscription.create({
    tenantId: TENANT_ID,
    branchId: null,
    customerId: 'customer-001',
    plan: new SubscriptionPlanVO('standard'),
    startDate: new Date('2026-01-01'),
    endDate: new Date('2027-01-01'),
    autoRenew: true,
    currency: 'USD',
    createdBy: 'admin-001',
  });
}

const prismaRow = (sub: Subscription) => ({
  id: sub.id,
  tenantId: sub.tenantId,
  branchId: sub.branchId,
  customerId: sub.customerId,
  plan: 'standard',
  status: 'TRIAL' as const,
  startDate: sub.startDate,
  endDate: sub.endDate,
  autoRenew: sub.autoRenew,
  currency: sub.currency,
  createdBy: sub.createdBy,
  createdAt: sub.createdAt,
  updatedAt: sub.updatedAt,
});

describe('PrismaSubscriptionRepository', () => {
  let repo: PrismaSubscriptionRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaSubscriptionRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaSubscriptionRepository>(PrismaSubscriptionRepository);
  });

  describe('save()', () => {
    it('upserts with correct plan and status mappings', async () => {
      const sub = makeSubscription();
      await repo.save(sub);

      // 'standard' normalises to 'pro' via SubscriptionPlanVO aliases
      expect(mockPrismaService.clinicSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            tenantId: TENANT_ID,
            plan: 'pro',
            autoRenew: true,
          }),
        }),
      );
    });

    it('stores plan as lowercase string', async () => {
      const sub = Subscription.create({
        tenantId: TENANT_ID,
        branchId: null,
        customerId: 'c-001',
        plan: new SubscriptionPlanVO('basic'),
        startDate: new Date(),
        endDate: null,
        autoRenew: false,
        currency: 'USD',
        createdBy: 'admin',
      });

      await repo.save(sub);

      // 'basic' normalises to 'lite' via SubscriptionPlanVO aliases
      expect(mockPrismaService.clinicSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ plan: 'lite' }),
        }),
      );
    });
  });

  describe('findById()', () => {
    it('returns null when not found', async () => {
      mockPrismaService.clinicSubscription.findFirst.mockResolvedValueOnce(null);
      const result = await repo.findById('sub-999', TENANT_ID);
      expect(result).toBeNull();
    });

    it('reconstructs Subscription with correct value objects', async () => {
      const sub = makeSubscription();
      mockPrismaService.clinicSubscription.findFirst.mockResolvedValueOnce(prismaRow(sub));

      const result = await repo.findById(sub.id, TENANT_ID);

      expect(result).not.toBeNull();
      // 'standard' from DB is normalised to canonical 'pro' by the VO
      expect(result!.plan.value).toBe('pro');
      expect(result!.status.value).toBe('trial');
    });

    it('maps SUSPENDED back to past_due', async () => {
      const sub = makeSubscription();
      const row = { ...prismaRow(sub), status: 'SUSPENDED' as const };
      mockPrismaService.clinicSubscription.findFirst.mockResolvedValueOnce(row);

      const result = await repo.findById(sub.id, TENANT_ID);
      expect(result!.status.value).toBe('past_due');
    });
  });

  describe('list()', () => {
    it('applies status and plan filters', async () => {
      mockPrismaService.clinicSubscription.findMany.mockResolvedValueOnce([]);

      await repo.list({ tenantId: TENANT_ID, status: 'active', plan: 'premium' });

      expect(mockPrismaService.clinicSubscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE', plan: 'premium' }),
        }),
      );
    });

    it('respects pagination offset/limit', async () => {
      mockPrismaService.clinicSubscription.findMany.mockResolvedValueOnce([]);

      await repo.list({ tenantId: TENANT_ID, offset: 20, limit: 5 });

      expect(mockPrismaService.clinicSubscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 5 }),
      );
    });
  });

  describe('existsByCustomerId()', () => {
    it('returns true when active subscription exists', async () => {
      mockPrismaService.clinicSubscription.count.mockResolvedValueOnce(1);
      const result = await repo.existsByCustomerId('c-001', TENANT_ID);
      expect(result).toBe(true);
    });

    it('returns false when no active subscription', async () => {
      mockPrismaService.clinicSubscription.count.mockResolvedValueOnce(0);
      const result = await repo.existsByCustomerId('c-999', TENANT_ID);
      expect(result).toBe(false);
    });
  });
});
