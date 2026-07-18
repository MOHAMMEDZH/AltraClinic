import { Test, TestingModule } from '@nestjs/testing';
import { PrismaUserRepository } from '../infrastructure/prisma-user.repository';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { User, EmploymentStatus } from '../domain/user.entity';

const mockTx = {
  user: { upsert: jest.fn() },
  userRoleAssignment: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
};

const mockPrismaService = {
  $transaction: jest.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
  user: {
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

const TENANT_ID = 'tenant-xyz';
const now = new Date();

function baseUserProps(roles: User['roles'] = ['doctor']): Parameters<typeof User.restore>[0] {
  return {
    id: 'user-001',
    email: 'doc@clinic.com',
    passwordHash: 'hashed_pw',
    roles,
    tenantId: TENANT_ID,
    branchId: 'branch-001',
    firstName: 'John',
    lastName: 'Doe',
    firstNameAr: null,
    lastNameAr: null,
    phone: null,
    jobTitle: null,
    departmentId: null,
    managerId: null,
    startDate: null,
    employmentStatus: 'active' as EmploymentStatus,
    timezone: null,
    languages: [],
    avatarUrl: null,
    notes: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    suspendedAt: null,
    archivedAt: null,
    isActive: true,
    emailVerified: false,
    emailVerifiedAt: null,
    mfaEnabled: false,
    mfaSecret: null,
    lockedUntil: null,
    failedLoginCount: 0,
    passwordChangedAt: now,
    lastLoginAt: null,
    lastLoginIp: null,
    createdAt: now,
    updatedAt: now,
  };
}

function makeUser(roles: User['roles'] = ['doctor']): User {
  return User.restore(baseUserProps(roles));
}

const prismaUserRow = (user: User) => ({
  id: user.id,
  email: user.email,
  passwordHash: user.passwordHash,
  tenantId: user.tenantId,
  branchId: user.branchId,
  firstName: user.firstName,
  lastName: user.lastName,
  firstNameAr: user.firstNameAr,
  lastNameAr: user.lastNameAr,
  phone: user.phone,
  jobTitle: user.jobTitle,
  departmentId: user.departmentId,
  managerId: user.managerId,
  startDate: user.startDate,
  employmentStatus: 'ACTIVE',
  timezone: user.timezone,
  languages: user.languages,
  avatarUrl: user.avatarUrl,
  notes: user.notes,
  emergencyContactName: user.emergencyContactName,
  emergencyContactPhone: user.emergencyContactPhone,
  suspendedAt: user.suspendedAt,
  archivedAt: user.archivedAt,
  isActive: user.isActive,
  emailVerified: user.emailVerified,
  emailVerifiedAt: user.emailVerifiedAt,
  mfaEnabled: user.mfaEnabled,
  mfaSecret: user.mfaSecret,
  lockedUntil: user.lockedUntil,
  failedLoginCount: user.failedLoginCount,
  passwordChangedAt: user.passwordChangedAt,
  lastLoginAt: user.lastLoginAt,
  lastLoginIp: user.lastLoginIp,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  deletedAt: null,
  roles: user.roles.map((r) => ({ role: r.toUpperCase() })),
});

describe('PrismaUserRepository', () => {
  let repo: PrismaUserRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaUserRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaUserRepository>(PrismaUserRepository);
  });

  describe('save()', () => {
    it('upserts user and manages role assignments in a transaction', async () => {
      const user = makeUser(['doctor']);
      await repo.save(user);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockTx.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-001' },
          create: expect.objectContaining({ email: 'doc@clinic.com', tenantId: TENANT_ID }),
        }),
      );
      expect(mockTx.userRoleAssignment.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-001' },
      });
      expect(mockTx.userRoleAssignment.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([expect.objectContaining({ role: 'DOCTOR' })]),
        }),
      );
    });

    it('maps owner domain role to OWNER prisma role', async () => {
      const user = makeUser(['owner']);
      await repo.save(user);

      expect(mockTx.userRoleAssignment.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([expect.objectContaining({ role: 'OWNER' })]),
        }),
      );
    });
  });

  describe('findById()', () => {
    it('returns null when user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValueOnce(null);
      const result = await repo.findById('nonexistent', TENANT_ID);
      expect(result).toBeNull();
    });

    it('returns User domain entity with correct roles', async () => {
      const user = makeUser(['doctor']);
      mockPrismaService.user.findFirst.mockResolvedValueOnce(prismaUserRow(user));

      const result = await repo.findById('user-001', TENANT_ID);
      expect(result).not.toBeNull();
      expect(result!.id).toBe('user-001');
      expect(result!.roles).toContain('doctor');
      expect(result!.tenantId).toBe(TENANT_ID);
    });

    it('enforces tenant isolation', async () => {
      mockPrismaService.user.findFirst.mockResolvedValueOnce(null);
      const result = await repo.findById('user-001', 'other-tenant');
      expect(result).toBeNull();
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'other-tenant', deletedAt: null }),
        }),
      );
    });

    it('defaults to patient role when no role assignments exist', async () => {
      const row = {
        ...prismaUserRow(makeUser(['patient'])),
        id: 'user-003',
        roles: [],
      };
      mockPrismaService.user.findFirst.mockResolvedValueOnce(row);
      const result = await repo.findById('user-003', TENANT_ID);
      expect(result!.roles).toEqual(['patient']);
    });
  });

  describe('findByEmail()', () => {
    it('performs case-insensitive email lookup', async () => {
      mockPrismaService.user.findFirst.mockResolvedValueOnce(null);
      await repo.findByEmail('DOC@CLINIC.COM', TENANT_ID);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ email: 'doc@clinic.com', deletedAt: null }),
        }),
      );
    });

    it('returns null for email in a different tenant', async () => {
      mockPrismaService.user.findFirst.mockResolvedValueOnce(null);
      const result = await repo.findByEmail('doc@clinic.com', 'wrong-tenant');
      expect(result).toBeNull();
    });
  });
});
