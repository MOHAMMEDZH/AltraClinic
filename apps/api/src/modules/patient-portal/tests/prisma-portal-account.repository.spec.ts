import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPortalAccountRepository } from '../infrastructure/prisma-portal-account.repository';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PortalAccount } from '../domain/entities/portal-account.entity';

const mockTx = {
  portalAccount: { upsert: jest.fn() },
  caregiverAccessGrant: { upsert: jest.fn() },
};

const mockPrismaService = {
  $transaction: jest.fn((cb) => cb(mockTx)),
  portalAccount: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const TENANT_ID = 'tenant-001';

function makePortalAccount(): PortalAccount {
  return PortalAccount.invite({
    tenantId: TENANT_ID,
    branchId: null,
    patientId: 'patient-001',
    invitedBy: 'admin-001',
    locale: 'en',
  });
}

const prismaRow = (a: PortalAccount) => ({
  id: a.id,
  tenantId: a.tenantId,
  branchId: a.branchId,
  patientId: a.patientId,
  userId: null,
  status: 'INVITED' as const,
  locale: 'en',
  notifyEmail: true,
  notifySms: false,
  notifyPush: false,
  invitedBy: a.invitedBy,
  activatedAt: null,
  suspendedAt: null,
  suspensionReason: null,
  deactivatedAt: null,
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
  caregiverGrants: [],
});

describe('PrismaPortalAccountRepository', () => {
  let repo: PrismaPortalAccountRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaPortalAccountRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaPortalAccountRepository>(PrismaPortalAccountRepository);
  });

  describe('save()', () => {
    it('upserts portal account with INVITED status', async () => {
      const account = makePortalAccount();
      await repo.save(account);

      expect(mockTx.portalAccount.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            tenantId: TENANT_ID,
            patientId: 'patient-001',
            status: 'INVITED',
          }),
        }),
      );
    });

    it('does not call caregiverAccessGrant.upsert when no grants', async () => {
      const account = makePortalAccount();
      await repo.save(account);
      expect(mockTx.caregiverAccessGrant.upsert).not.toHaveBeenCalled();
    });
  });

  describe('findByPatientId()', () => {
    it('returns null when not found', async () => {
      mockPrismaService.portalAccount.findFirst.mockResolvedValueOnce(null);
      const result = await repo.findByPatientId('patient-999', TENANT_ID);
      expect(result).toBeNull();
    });

    it('queries by patientId and tenantId', async () => {
      mockPrismaService.portalAccount.findFirst.mockResolvedValueOnce(null);

      await repo.findByPatientId('patient-001', TENANT_ID);

      expect(mockPrismaService.portalAccount.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patientId: 'patient-001', tenantId: TENANT_ID },
        }),
      );
    });

    it('reconstructs PortalAccount with notification preferences', async () => {
      const account = makePortalAccount();
      mockPrismaService.portalAccount.findFirst.mockResolvedValueOnce(prismaRow(account));

      const result = await repo.findByPatientId('patient-001', TENANT_ID);

      expect(result).not.toBeNull();
      expect(result!.preferences.locale).toBe('en');
      expect(result!.preferences.channels.email).toBe(true);
      expect(result!.preferences.channels.sms).toBe(false);
      expect(result!.status.value).toBe('invited');
    });
  });

  describe('list()', () => {
    it('applies tenantId filter and returns pagination metadata', async () => {
      mockPrismaService.portalAccount.findMany.mockResolvedValueOnce([]);
      mockPrismaService.portalAccount.count.mockResolvedValueOnce(10);

      const result = await repo.list({ tenantId: TENANT_ID, limit: 5, offset: 0 });

      expect(result.total).toBe(10);
      expect(result.limit).toBe(5);
      expect(result.offset).toBe(0);
    });

    it('applies status filter', async () => {
      mockPrismaService.portalAccount.findMany.mockResolvedValueOnce([]);
      mockPrismaService.portalAccount.count.mockResolvedValueOnce(0);

      await repo.list({ tenantId: TENANT_ID, status: 'active', limit: 10, offset: 0 });

      expect(mockPrismaService.portalAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });
  });
});
