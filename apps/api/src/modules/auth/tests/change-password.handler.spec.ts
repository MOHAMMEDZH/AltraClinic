import { Test, TestingModule } from '@nestjs/testing';
import { ChangePasswordHandler } from '../application/handlers/change-password.handler';
import { PasswordHasher } from '../../identity/infrastructure/password-hasher';
import { User } from '../../identity/domain/user.entity';
import {
  USER_REPOSITORY,
  EVENT_PUBLISHER,
  REFRESH_TOKEN_REPOSITORY,
  TRUSTED_DEVICE_REPOSITORY,
} from '../../../infrastructure/provider.tokens';
import { TenantPolicyService } from '../../settings/application/services/tenant-policy.service';

jest.mock('../../identity/infrastructure/password-hasher', () => ({
  PasswordHasher: {
    compare: jest.fn(),
    hash: jest.fn(),
  },
}));

describe('ChangePasswordHandler', () => {
  let handler: ChangePasswordHandler;
  const userRepo = { findById: jest.fn(), save: jest.fn() };
  const refreshRepo = {
    findActiveByUserId: jest.fn(),
    revokeBySessionId: jest.fn(),
    revokeAllByUserId: jest.fn(),
  };
  const trustedDeviceRepo = { deleteAllForUser: jest.fn() };
  const tenantPolicy = {
    getPasswordPolicy: jest.fn().mockResolvedValue({
      validate: jest.fn().mockReturnValue([]),
    }),
  };
  const events = { publish: jest.fn() };

  const baseUser = User.create({
    email: 'a@b.com',
    passwordHash: 'hash',
    roles: ['owner'],
    tenantId: 't1',
    firstName: 'Test',
    lastName: 'User',
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangePasswordHandler,
        { provide: USER_REPOSITORY, useValue: userRepo },
        { provide: REFRESH_TOKEN_REPOSITORY, useValue: refreshRepo },
        { provide: TRUSTED_DEVICE_REPOSITORY, useValue: trustedDeviceRepo },
        { provide: EVENT_PUBLISHER, useValue: events },
        { provide: TenantPolicyService, useValue: tenantPolicy },
      ],
    }).compile();

    handler = module.get(ChangePasswordHandler);
    userRepo.findById.mockResolvedValue(baseUser);
    (PasswordHasher.compare as jest.Mock).mockResolvedValue(true);
    (PasswordHasher.hash as jest.Mock).mockResolvedValue('new-hash');
    refreshRepo.findActiveByUserId.mockResolvedValue([
      { sessionId: 's-current' },
      { sessionId: 's-other' },
    ]);
  });

  it('changes password and revokes other sessions', async () => {
    const result = await handler.execute({
      userId: 'u1',
      tenantId: 't1',
      currentPassword: 'OldPass1!',
      newPassword: 'NewPass1!',
      currentSessionId: 's-current',
    });

    expect(result.revokedOtherSessions).toBe(1);
    expect(userRepo.save).toHaveBeenCalled();
    expect(refreshRepo.revokeBySessionId).toHaveBeenCalledWith('s-other');
    expect(events.publish).toHaveBeenCalled();
  });
});
