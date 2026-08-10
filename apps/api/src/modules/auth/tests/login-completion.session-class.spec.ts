import { BadRequestException } from '@nestjs/common';
import { LoginCompletionService } from '../application/services/login-completion.service';
import { DeviceInfoVO } from '../domain/value-objects/device-info.vo';
import { TokenPairVO } from '../domain/value-objects/token-pair.vo';

/**
 * Clinic login completion must never accept Platform session class.
 * Platform MFA uses PlatformSessionCompletionService exclusively.
 */
describe('LoginCompletionService sessionClass boundary (Step 06/07)', () => {
  const user = {
    id: 'user-1',
    email: 'clinic@example.com',
    tenantId: 'tenant-1',
    branchId: null,
    roles: ['admin'],
    recordSuccessfulLogin: jest.fn(function (this: unknown) {
      return this;
    }),
  };

  function buildService() {
    const userRepo = {
      updateLoginState: jest.fn(async () => undefined),
    };
    const refreshRepo = { save: jest.fn(async () => undefined) };
    const attemptRepo = { save: jest.fn(async () => undefined) };
    const events = { publish: jest.fn(async () => undefined) };
      const jwt = {
      issueTokenPair: jest.fn(
        () =>
          new TokenPairVO({
            accessToken: 'access',
            refreshToken: 'refresh',
            accessExpiresIn: 900,
            sessionId: 'sess-out',
          }),
      ),
      getRefreshExpiresAt: jest.fn(() => new Date(Date.now() + 86_400_000)),
    };
    const svc = new LoginCompletionService(
      userRepo as never,
      refreshRepo as never,
      attemptRepo as never,
      events as never,
      jwt as never,
    );
    return { svc, userRepo, refreshRepo, attemptRepo, events, jwt };
  }

  const device = new DeviceInfoVO({
    ipAddress: '127.0.0.1',
    userAgent: 'test',
    deviceName: 'test-device',
  });

  it('accepts staff and patient session classes for Clinic completion', async () => {
    const { svc, jwt, refreshRepo } = buildService();
    await svc.complete({
      user: user as never,
      email: user.email,
      tenantId: user.tenantId,
      sessionId: 'sess-staff',
      device,
      sessionClass: 'staff',
    });
    expect(jwt.issueTokenPair).toHaveBeenCalledWith(
      expect.objectContaining({ sessionClass: 'staff', tenantId: user.tenantId }),
    );
    expect(refreshRepo.save).toHaveBeenCalled();

    await svc.complete({
      user: user as never,
      email: user.email,
      tenantId: user.tenantId,
      sessionId: 'sess-patient',
      device,
      sessionClass: 'patient',
    });
    expect(jwt.issueTokenPair).toHaveBeenCalledWith(
      expect.objectContaining({ sessionClass: 'patient' }),
    );
  });

  it('rejects platform and unknown session classes', async () => {
    const { svc, jwt } = buildService();
    await expect(
      svc.complete({
        user: user as never,
        email: user.email,
        tenantId: user.tenantId,
        sessionId: 'sess-platform',
        device,
        sessionClass: 'platform' as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(jwt.issueTokenPair).not.toHaveBeenCalled();

    await expect(
      svc.complete({
        user: user as never,
        email: user.email,
        tenantId: user.tenantId,
        sessionId: 'sess-unknown',
        device,
        sessionClass: 'tenant' as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
