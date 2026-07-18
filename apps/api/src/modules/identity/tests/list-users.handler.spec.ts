import { ListUsersHandler } from '../application/handlers/user-management.handlers';
import { User } from '../domain/user.entity';

describe('ListUsersHandler', () => {
  const tenantContext = {
    resolve: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
  };

  function makeUser(id: string): User {
    return User.restore({
      id,
      email: `${id}@demo.clinic`,
      passwordHash: 'hash',
      roles: ['receptionist'],
      tenantId: 'tenant-1',
      branchId: null,
      firstName: 'A',
      lastName: 'B',
      firstNameAr: null,
      lastNameAr: null,
      phone: null,
      jobTitle: null,
      departmentId: null,
      managerId: null,
      startDate: null,
      employmentStatus: 'active',
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
      passwordChangedAt: new Date(),
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  it('returns cursor pagination metadata from repository', async () => {
    const repo = {
      list: jest.fn().mockResolvedValue({
        items: [makeUser('u1'), makeUser('u2')],
        total: 100,
        page: 1,
        limit: 50,
        nextCursor: 'u2',
      }),
    };
    const handler = new ListUsersHandler(repo as never, tenantContext as never);
    const result = await handler.execute({ limit: 50, cursor: 'u0' });
    expect(result.nextCursor).toBe('u2');
    expect(result.items).toHaveLength(2);
    expect(repo.list).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', cursor: 'u0', limit: 50 }),
    );
  });
});
