import { EmploymentStatus, User, UserRole } from '../modules/identity/domain/user.entity';

const now = new Date();

export function baseUserProps(
  overrides: Partial<Parameters<typeof User.restore>[0]> = {},
): Parameters<typeof User.restore>[0] {
  return {
    id: 'user-001',
    email: 'test@example.com',
    passwordHash: '$2a$10$test',
    roles: ['doctor'] as UserRole[],
    tenantId: 'tenant-1',
    branchId: null,
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
    emailVerified: true,
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
    ...overrides,
  };
}

export function makeTestUser(overrides: Partial<Parameters<typeof User.restore>[0]> = {}): User {
  return User.restore(baseUserProps(overrides));
}

export function mockUserRepository(): {
  findById: jest.Mock;
  findByEmail: jest.Mock;
  save: jest.Mock;
  updateLoginState: jest.Mock;
  list: jest.Mock;
  getOverviewStats: jest.Mock;
  softDelete: jest.Mock;
  countPendingInvitations: jest.Mock;
} {
  return {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    save: jest.fn(),
    updateLoginState: jest.fn(),
    list: jest.fn(),
    getOverviewStats: jest.fn(),
    softDelete: jest.fn(),
    countPendingInvitations: jest.fn(),
  };
}
