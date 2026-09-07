import { LoginHandler } from '../application/handlers/login.handler';
import { TrustedDevice } from '../domain/entities/trusted-device.entity';
import { UserRepository } from '../../identity/domain/user.repository.interface';
import { LoginAttemptRepository } from '../domain/repositories/login-attempt.repository.interface';
import { TrustedDeviceRepository } from '../domain/repositories/trusted-device.repository.interface';
import { JwtTokenService } from '../infrastructure/services/jwt-token.service';
import { EventPublisherInterface } from '../../../infrastructure/event-publisher.interface';
import { PasswordHasher } from '../../identity/infrastructure/password-hasher';
import { User } from '../../identity/domain/user.entity';
import { makeTestUser, mockUserRepository } from '../../../test-support/user-test.factory';
import { TenantPolicyService } from '../../settings/application/services/tenant-policy.service';
import { TokenPairVO } from '../domain/value-objects/token-pair.vo';
import { LoginCompletionService } from '../application/services/login-completion.service';
import {
  InvalidCredentialsException,
  AccountLockedException,
  AccountInactiveException,
  RateLimitExceededException,
} from '../domain/exceptions/auth.exceptions';

const makeUser = (overrides: Partial<{
  isActive: boolean; lockedUntil: Date | null; lastLoginIp: string | null;
  mfaEnabled: boolean; mfaSecret: string | null;
}> = {}) =>
  makeTestUser({
    id: 'user-1',
    email: 'test@example.com',
    tenantId: 'tenant-1',
    firstName: 'John',
    lastName: 'Doe',
    isActive: overrides.isActive ?? true,
    emailVerifiedAt: new Date(),
    mfaEnabled: overrides.mfaEnabled ?? false,
    mfaSecret: overrides.mfaSecret ?? null,
    lockedUntil: overrides.lockedUntil ?? null,
    lastLoginIp: overrides.lastLoginIp ?? null,
  });

describe('LoginHandler', () => {
  let handler: LoginHandler;
  let userRepo: jest.Mocked<UserRepository>;
  let attemptRepo: jest.Mocked<LoginAttemptRepository>;
  let trustedDeviceRepo: jest.Mocked<TrustedDeviceRepository>;
  let jwtService: jest.Mocked<JwtTokenService>;
  let events: jest.Mocked<EventPublisherInterface>;
  let loginCompletion: jest.Mocked<LoginCompletionService>;
  let tenantPolicy: jest.Mocked<TenantPolicyService>;
  let platformTenantFindUnique: jest.Mock;

  beforeEach(() => {
    userRepo = mockUserRepository();
    attemptRepo = {
      save: jest.fn(),
      countRecentFailures: jest.fn().mockResolvedValue(0),
      countRecentFailuresByIp: jest.fn().mockResolvedValue(0),
      listByEmail: jest.fn().mockResolvedValue([]),
    };
    trustedDeviceRepo = {
      save: jest.fn(),
      findValidByTokenHash: jest.fn().mockResolvedValue(null),
      deleteAllForUser: jest.fn(),
    };
    jwtService = {
      issueTokenPair: jest.fn().mockReturnValue(
        new TokenPairVO({ accessToken: 'access', refreshToken: 'refresh', accessExpiresIn: 900, sessionId: 'session-1' }),
      ),
      generateSessionId: jest.fn().mockReturnValue('session-1'),
      issueMfaChallenge: jest.fn().mockReturnValue({ token: 'mfa-challenge', expiresIn: 300 }),
      getRefreshExpiresAt: jest.fn().mockReturnValue(new Date(Date.now() + 7 * 86400 * 1000)),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      verifyMfaChallenge: jest.fn(),
    } as unknown as jest.Mocked<JwtTokenService>;
    events = { publish: jest.fn() };
    loginCompletion = {
      complete: jest.fn().mockResolvedValue(
        new TokenPairVO({ accessToken: 'access', refreshToken: 'refresh', accessExpiresIn: 900, sessionId: 'session-1' }),
      ),
    } as unknown as jest.Mocked<LoginCompletionService>;
    tenantPolicy = {
      getSecurityPolicy: jest.fn().mockResolvedValue({ minPasswordLength: 8, mfaRequired: false }),
      isMaintenanceMode: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<TenantPolicyService>;

    platformTenantFindUnique = jest.fn().mockResolvedValue(null);
    const prisma = {
      platformTenant: {
        findUnique: platformTenantFindUnique,
      },
    };

    handler = new LoginHandler(
      userRepo,
      attemptRepo,
      trustedDeviceRepo,
      events,
      jwtService,
      loginCompletion,
      tenantPolicy,
      prisma as never,
    );
  });

  const baseCmd = {
    email: 'test@example.com',
    password: 'Password1!',
    tenantId: 'tenant-1',
    ipAddress: '1.2.3.4',
    userAgent: 'TestAgent',
    deviceName: 'Test Device',
  };

  it('issues tokens on valid credentials', async () => {
    const user = makeUser();
    userRepo.findByEmail.mockResolvedValue(user);
    jest.spyOn(PasswordHasher, 'compare').mockResolvedValue(true);

    const result = await handler.execute(baseCmd);

    expect(result.kind).toBe('tokens');
    if (result.kind === 'tokens') {
      expect(result.tokens.accessToken).toBe('access');
      expect(result.tokens.refreshToken).toBe('refresh');
    }
    expect(loginCompletion.complete).toHaveBeenCalledTimes(1);
  });

  it('returns MFA challenge when MFA is enabled', async () => {
    const user = makeUser({ mfaEnabled: true, mfaSecret: 'SECRET' });
    userRepo.findByEmail.mockResolvedValue(user);
    jest.spyOn(PasswordHasher, 'compare').mockResolvedValue(true);

    const result = await handler.execute(baseCmd);

    expect(result.kind).toBe('mfa_required');
    if (result.kind === 'mfa_required') {
      expect(result.mfaChallengeToken).toBe('mfa-challenge');
    }
    expect(loginCompletion.complete).not.toHaveBeenCalled();
  });

  it('skips MFA when a trusted device token is valid', async () => {
    const user = makeUser({ mfaEnabled: true, mfaSecret: 'SECRET' });
    userRepo.findByEmail.mockResolvedValue(user);
    jest.spyOn(PasswordHasher, 'compare').mockResolvedValue(true);
    trustedDeviceRepo.findValidByTokenHash.mockResolvedValue(
      TrustedDevice.restore({
        id: 'trusted-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        tokenHash: 'hash',
        deviceName: 'Chrome',
        expiresAt: new Date(Date.now() + 86_400_000),
        lastUsedAt: null,
        createdAt: new Date(),
      }),
    );

    const result = await handler.execute({ ...baseCmd, deviceTrustToken: 'trusted-token' });

    expect(result.kind).toBe('tokens');
    expect(loginCompletion.complete).toHaveBeenCalledTimes(1);
    expect(jwtService.issueMfaChallenge).not.toHaveBeenCalled();
  });

  it('throws InvalidCredentials when user not found', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    jest.spyOn(PasswordHasher, 'compare').mockResolvedValue(false);

    await expect(handler.execute(baseCmd)).rejects.toThrow(InvalidCredentialsException);
    expect(attemptRepo.save).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('throws InvalidCredentials on wrong password', async () => {
    const user = makeUser();
    userRepo.findByEmail.mockResolvedValue(user);
    jest.spyOn(PasswordHasher, 'compare').mockResolvedValue(false);

    await expect(handler.execute(baseCmd)).rejects.toThrow(InvalidCredentialsException);
  });

  it('throws AccountLocked when lockedUntil is in the future', async () => {
    const user = makeUser({ lockedUntil: new Date(Date.now() + 900_000) });
    userRepo.findByEmail.mockResolvedValue(user);

    await expect(handler.execute(baseCmd)).rejects.toThrow(AccountLockedException);
  });

  it('throws AccountInactive when isActive is false', async () => {
    const user = makeUser({ isActive: false });
    userRepo.findByEmail.mockResolvedValue(user);

    await expect(handler.execute(baseCmd)).rejects.toThrow(AccountInactiveException);
  });

  
  it('throws AccountInactive when PlatformTenant status is SUSPENDED', async () => {
    const user = makeUser();
    userRepo.findByEmail.mockResolvedValue(user);
    jest.spyOn(PasswordHasher, 'compare').mockResolvedValue(true);
    platformTenantFindUnique.mockResolvedValue({ status: 'SUSPENDED' });

    await expect(handler.execute(baseCmd)).rejects.toThrow(AccountInactiveException);
  });
it('throws RateLimitExceeded when IP has too many failures', async () => {
    attemptRepo.countRecentFailuresByIp.mockResolvedValue(30);

    await expect(handler.execute(baseCmd)).rejects.toThrow(RateLimitExceededException);
  });

  it('throws RateLimitExceeded when email has too many failures', async () => {
    attemptRepo.countRecentFailuresByIp.mockResolvedValue(0);
    attemptRepo.countRecentFailures.mockResolvedValue(5);

    await expect(handler.execute(baseCmd)).rejects.toThrow(RateLimitExceededException);
  });

  it('publishes SuspiciousLoginEvent on new IP address', async () => {
    const user = makeUser({ lastLoginIp: '9.9.9.9' });
    userRepo.findByEmail.mockResolvedValue(user);
    jest.spyOn(PasswordHasher, 'compare').mockResolvedValue(true);

    await handler.execute({ ...baseCmd, ipAddress: '1.2.3.4' });

    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'new_ip_address' }),
    );
  });
});
