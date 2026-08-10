import { JwtService } from '@nestjs/jwt';
import {
  CLINIC_TOKEN_AUDIENCE,
  JwtClaimsVO,
  PATIENT_PORTAL_TOKEN_AUDIENCE,
  PLATFORM_TOKEN_AUDIENCE,
} from '../domain/value-objects/jwt-claims.vo';
import { JwtTokenService, JwtConfig } from '../infrastructure/services/jwt-token.service';
import { PlatformMfaService } from '../infrastructure/services/platform-mfa.service';
import { PlatformSecurityConfig } from '../config/platform-security.config';
import { PlatformSessionPolicyService } from '../application/services/platform-session-policy.service';
import { PlatformLoginHandler } from '../application/handlers/platform-login.handler';
import { PlatformRefreshHandler } from '../application/handlers/platform-refresh.handler';
import { PlatformLogoutHandler } from '../application/handlers/platform-logout.handler';
import { PlatformMeHandler } from '../application/handlers/platform-me.handler';
import { PlatformUser } from '../domain/entities/platform-user.entity';
import { PlatformRefreshToken } from '../domain/entities/platform-refresh-token.entity';
import { PasswordHasher } from '../../identity/infrastructure/password-hasher';
import {
  InvalidCredentialsException,
  RateLimitExceededException,
  TokenExpiredException,
  TokenInvalidException,
} from '../domain/exceptions/auth.exceptions';
import {
  PlatformLoginFailedEvent,
  PlatformLogoutEvent,
  PlatformPasswordVerifiedEvent,
  PlatformRefreshReuseDetectedEvent,
} from '../domain/events/auth.events';
import { JwtAuthGuard } from '../api/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import {
  assertPlatformCookieCsrf,
  parseCookieHeader,
} from '../api/platform-auth-cookies';
import { PLATFORM_REFRESH_COOKIE_NAME } from '../platform-auth.tokens';

jest.mock('../../identity/infrastructure/password-hasher', () => ({
  PasswordHasher: {
    compare: jest.fn(),
    hash: jest.fn(),
    timingDummyCompare: jest.fn().mockResolvedValue(undefined),
  },
}));

const JWT_CFG: JwtConfig = {
  accessSecret: 'clinic-access-secret-min-32-characters-xx',
  refreshSecret: 'clinic-refresh-secret-min-32-characters-x',
  accessExpiresIn: 900,
  refreshExpiresIn: 604800,
  mfaChallengeExpiresIn: 300,
  platformAccessSecret: 'platform-access-secret-min-32-chars-xx',
  platformRefreshSecret: 'platform-refresh-secret-min-32-chars-x',
  platformIssuer: 'booking-platform',
  platformAccessExpiresIn: 900,
  platformRefreshExpiresIn: 604800,
  platformSecretsSharedWithClinic: false,
};

const MFA_CFG: PlatformSecurityConfig = {
  mfaEncryptionKey: 'test-only-platform-mfa-encryption-key-32b',
  mfaIssuer: 'Booking Platform',
  mfaEnrollmentTtlSeconds: 900,
  mfaChallengeTtlSeconds: 300,
  sessionIdleSeconds: 1800,
  sessionAbsoluteSeconds: 43200,
  stepUpSeconds: 300,
  recoveryCodeCount: 10,
  activityMinIntervalSeconds: 60,
};

function makePlatformUser(overrides: Partial<{
  isActive: boolean;
  lockedUntil: Date | null;
  failedLoginCount: number;
  passwordHash: string;
  mfaEnabled: boolean;
  mfaSecretEncrypted: string | null;
  failedMfaCount: number;
  lastTotpStep: string | null;
}> = {}): PlatformUser {
  return PlatformUser.restore({
    id: 'pu-1',
    email: 'ops@example.com',
    passwordHash: overrides.passwordHash ?? 'hash',
    displayName: 'Ops',
    isActive: overrides.isActive ?? true,
    lockedUntil: overrides.lockedUntil ?? null,
    failedLoginCount: overrides.failedLoginCount ?? 0,
    passwordChangedAt: new Date(),
    lastLoginAt: null,
    lastLoginIp: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    mfaEnabled: overrides.mfaEnabled ?? false,
    mfaSecretEncrypted: overrides.mfaSecretEncrypted ?? null,
    mfaKeyVersion: '1',
    mfaPendingSecretEncrypted: null,
    mfaPendingExpiresAt: null,
    mfaConfirmedAt: overrides.mfaEnabled ? new Date() : null,
    lastTotpStep: overrides.lastTotpStep ?? null,
    failedMfaCount: overrides.failedMfaCount ?? 0,
  });
}

function makeRefreshToken(overrides: Partial<{
  platformUserId: string;
  sessionId: string;
  familyId: string;
  rawToken: string;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
}> = {}): PlatformRefreshToken {
  return PlatformRefreshToken.create({
    platformUserId: overrides.platformUserId ?? 'pu-1',
    rawToken: overrides.rawToken ?? 'raw-token',
    sessionId: overrides.sessionId ?? 'sess-a',
    familyId: overrides.familyId ?? 'fam-1',
    expiresAt: new Date(Date.now() + 3_600_000),
    ipAddress: '1.1.1.1',
    userAgent: 'ua',
    absoluteExpiresAt: overrides.absoluteExpiresAt ?? new Date(Date.now() + 43_200_000),
  });
}

describe('Phase 47 Step 06/07 — platform authentication + MFA boundary', () => {
  let jwtTokenService: JwtTokenService;
  let mfa: PlatformMfaService;
  let events: { publish: jest.Mock };

  beforeEach(() => {
    jwtTokenService = new JwtTokenService(new JwtService({}), JWT_CFG);
    mfa = new PlatformMfaService(MFA_CFG);
    events = { publish: jest.fn().mockResolvedValue(undefined) };
    jest.clearAllMocks();
  });

  it('issues platform access token with aud, iss, principalType and no tenant/patient/entitlements', () => {
    const pair = jwtTokenService.issuePlatformTokenPair({
      platformUserId: 'pu-1',
      sessionId: 'sess-1',
    });
    const claims = jwtTokenService.verifyAccessToken(pair.accessToken);
    expect(claims).not.toBeNull();
    expect(claims!.aud).toBe(PLATFORM_TOKEN_AUDIENCE);
    expect(claims!.iss).toBe('booking-platform');
    expect(claims!.principalType).toBe('platform');
    expect(claims!.sessionClass).toBe('platform');
    expect(claims!.tenantId).toBeNull();
    expect(claims!.branchId).toBeNull();
    expect(claims!.roles).toEqual([]);
    const plain = claims!.toPlain();
    expect(plain).not.toHaveProperty('tenantId');
    expect(plain).not.toHaveProperty('entitlements');
    expect(plain).not.toHaveProperty('patientId');
  });

  it('rejects platform token verification when issuer is wrong', () => {
    const jwt = new JwtService({});
    const forged = jwt.sign(
      {
        sub: 'pu-1',
        type: 'access',
        sessionClass: 'platform',
        principalType: 'platform',
        aud: PLATFORM_TOKEN_AUDIENCE,
        iss: 'evil-issuer',
        sessionId: 's',
        jti: 'j',
        roles: [],
        branchId: null,
      },
      { secret: JWT_CFG.platformAccessSecret, expiresIn: 900 },
    );
    expect(jwtTokenService.verifyAccessToken(forged)).toBeNull();
  });

  it('clinic tokens keep clinic audience and are not platform', () => {
    const pair = jwtTokenService.issueTokenPair({
      userId: 'u1',
      tenantId: 't1',
      branchId: null,
      roles: ['doctor'] as never,
      sessionId: 's1',
    });
    const claims = jwtTokenService.verifyAccessToken(pair.accessToken)!;
    expect(claims.aud).toBe(CLINIC_TOKEN_AUDIENCE);
    expect(claims.isPlatformSession()).toBe(false);
    expect(claims.tenantId).toBe('t1');
  });

  it('patient tokens keep patient-portal audience', () => {
    const pair = jwtTokenService.issueTokenPair({
      userId: 'u1',
      tenantId: 't1',
      branchId: null,
      roles: ['patient'] as never,
      sessionId: 's1',
      sessionClass: 'patient',
    });
    const claims = jwtTokenService.verifyAccessToken(pair.accessToken)!;
    expect(claims.aud).toBe(PATIENT_PORTAL_TOKEN_AUDIENCE);
  });

  describe('platform preauth tokens (Step 07)', () => {
    it('issues a preauth token that is REJECTED by the access-token verifier and by type checks', () => {
      const preauth = jwtTokenService.issuePlatformPreauthToken({
        platformUserId: 'pu-1',
        purpose: 'mfa_challenge',
        transactionId: 'tx-1',
        expiresInSeconds: 300,
      });
      // Preauth tokens must never be usable as access tokens (JwtStrategy only accepts type==='access').
      expect(jwtTokenService.verifyAccessToken(preauth.token)).toBeNull();
      const verified = jwtTokenService.verifyPlatformPreauthToken(preauth.token, 'mfa_challenge');
      expect(verified?.platformUserId).toBe('pu-1');
      expect(verified?.transactionId).toBe('tx-1');
    });

    it('rejects preauth token when purpose does not match', () => {
      const preauth = jwtTokenService.issuePlatformPreauthToken({
        platformUserId: 'pu-1',
        purpose: 'mfa_enrollment',
        transactionId: 'tx-2',
        expiresInSeconds: 300,
      });
      expect(jwtTokenService.verifyPlatformPreauthToken(preauth.token, 'mfa_challenge')).toBeNull();
    });
  });

  describe('PlatformLoginHandler', () => {
    function buildHandler(user: PlatformUser | null) {
      const platformUsers = {
        findByEmail: jest.fn().mockResolvedValue(user),
        findById: jest.fn(),
        save: jest.fn(),
        updateLoginState: jest.fn().mockResolvedValue(undefined),
        updateMfaState: jest.fn().mockResolvedValue(undefined),
      };
      const attemptRepo = {
        save: jest.fn().mockResolvedValue(undefined),
        countRecentFailures: jest.fn().mockResolvedValue(0),
        countRecentFailuresByIp: jest.fn().mockResolvedValue(0),
        listByEmail: jest.fn(),
      };
      const handler = new PlatformLoginHandler(
        platformUsers as never,
        attemptRepo as never,
        events as never,
        jwtTokenService,
        mfa,
      );
      return { handler, platformUsers, attemptRepo };
    }

    it('never issues tokens on password success — returns mfa_enrollment_required when MFA is not yet enabled', async () => {
      (PasswordHasher.compare as jest.Mock).mockResolvedValue(true);
      const user = makePlatformUser({ mfaEnabled: false });
      const { handler, platformUsers } = buildHandler(user);

      const result = await handler.execute({
        email: 'ops@example.com',
        password: 'correct-horse',
        ipAddress: '1.1.1.1',
        userAgent: 'vitest',
      });

      expect(result.kind).toBe('mfa_enrollment_required');
      expect(result).not.toHaveProperty('accessToken');
      expect(result).not.toHaveProperty('refreshToken');
      if (result.kind === 'mfa_enrollment_required') {
        expect(result.preauthToken).toBeTruthy();
        const verified = jwtTokenService.verifyPlatformPreauthToken(
          result.preauthToken,
          'mfa_enrollment',
        );
        expect(verified?.platformUserId).toBe(user.id);
        // A preauth token must never pass as an access token.
        expect(jwtTokenService.verifyAccessToken(result.preauthToken)).toBeNull();
      }
      // Login state / success attempt are recorded only after MFA completes.
      expect(platformUsers.updateLoginState).not.toHaveBeenCalled();
      const publishedEvent = events.publish.mock.calls
        .map((call) => call[0])
        .find((evt) => evt instanceof PlatformPasswordVerifiedEvent) as
        | PlatformPasswordVerifiedEvent
        | undefined;
      expect(publishedEvent).toBeDefined();
      expect(publishedEvent?.platformUserId).toBe(user.id);
      expect(publishedEvent?.requiresEnrollment).toBe(true);
    });

    it('returns mfa_challenge_required (never enrollment) once MFA is already enabled', async () => {
      (PasswordHasher.compare as jest.Mock).mockResolvedValue(true);
      const user = makePlatformUser({ mfaEnabled: true, mfaSecretEncrypted: 'envelope' });
      const { handler } = buildHandler(user);

      const result = await handler.execute({
        email: 'ops@example.com',
        password: 'correct-horse',
        ipAddress: '1.1.1.1',
        userAgent: 'vitest',
      });

      expect(result.kind).toBe('mfa_challenge_required');
      expect(result).not.toHaveProperty('accessToken');
      if (result.kind === 'mfa_challenge_required') {
        const verified = jwtTokenService.verifyPlatformPreauthToken(
          result.preauthToken,
          'mfa_challenge',
        );
        expect(verified?.platformUserId).toBe(user.id);
      }
    });

    it('returns indistinguishable errors for unknown account and wrong password', async () => {
      (PasswordHasher.compare as jest.Mock).mockResolvedValue(false);
      const unknown = buildHandler(null);
      const wrong = buildHandler(makePlatformUser());

      await expect(
        unknown.handler.execute({
          email: 'missing@example.com',
          password: 'anything1',
          ipAddress: '1.1.1.1',
          userAgent: 'ua',
        }),
      ).rejects.toThrow(InvalidCredentialsException);

      await expect(
        wrong.handler.execute({
          email: 'ops@example.com',
          password: 'bad-password',
          ipAddress: '1.1.1.1',
          userAgent: 'ua',
        }),
      ).rejects.toThrow(InvalidCredentialsException);

      const unknownMsg = (() => {
        try {
          throw new InvalidCredentialsException();
        } catch (e) {
          return (e as Error).message;
        }
      })();
      expect(unknownMsg).toBe('Invalid email or password.');
      expect(events.publish).toHaveBeenCalledWith(expect.any(PlatformLoginFailedEvent));
    });

    it('rejects disabled and locked accounts with the same generic error', async () => {
      (PasswordHasher.compare as jest.Mock).mockResolvedValue(true);
      const disabled = buildHandler(makePlatformUser({ isActive: false }));
      const locked = buildHandler(
        makePlatformUser({ lockedUntil: new Date(Date.now() + 60_000) }),
      );

      await expect(
        disabled.handler.execute({
          email: 'ops@example.com',
          password: 'correct-horse',
          ipAddress: '1.1.1.1',
          userAgent: 'ua',
        }),
      ).rejects.toThrow(InvalidCredentialsException);

      await expect(
        locked.handler.execute({
          email: 'ops@example.com',
          password: 'correct-horse',
          ipAddress: '1.1.1.1',
          userAgent: 'ua',
        }),
      ).rejects.toThrow(InvalidCredentialsException);
    });

    it('rate limits after repeated failures', async () => {
      const { handler, attemptRepo } = buildHandler(null);
      attemptRepo.countRecentFailures.mockResolvedValue(5);
      await expect(
        handler.execute({
          email: 'ops@example.com',
          password: 'x',
          ipAddress: '1.1.1.1',
          userAgent: 'ua',
        }),
      ).rejects.toThrow(RateLimitExceededException);
    });
  });

  describe('PlatformRefreshHandler', () => {
    function buildSessionPolicy(refreshRepo: unknown) {
      return new PlatformSessionPolicyService(refreshRepo as never, events as never, mfa);
    }

    it('rotates refresh tokens and rejects previous token / reuse', async () => {
      const user = makePlatformUser();
      const pair1 = jwtTokenService.issuePlatformTokenPair({
        platformUserId: user.id,
        sessionId: 'sess-a',
      });

      const tokensByHash = new Map<string, PlatformRefreshToken>();
      let stored: PlatformRefreshToken | null = makeRefreshToken({
        platformUserId: user.id,
        rawToken: pair1.refreshToken,
        sessionId: 'sess-a',
        familyId: 'fam-1',
      });
      tokensByHash.set(stored.tokenHash, stored);

      const refreshRepo = {
        save: jest.fn().mockImplementation(async (t: PlatformRefreshToken) => {
          tokensByHash.set(t.tokenHash, t);
          stored = t;
        }),
        findByTokenHash: jest.fn().mockImplementation(async (hash: string) => {
          return tokensByHash.get(hash) ?? null;
        }),
        revokeBySessionId: jest.fn().mockImplementation(async (sessionId: string) => {
          for (const [hash, token] of tokensByHash.entries()) {
            if (token.sessionId === sessionId) {
              const revoked = token.revoke('rotated');
              tokensByHash.set(hash, revoked);
              if (stored?.sessionId === sessionId) stored = revoked;
            }
          }
        }),
        revokeAllByUserId: jest.fn(),
        revokeFamily: jest.fn(),
        findById: jest.fn(),
        findBySessionId: jest.fn(),
        findActiveByUserId: jest.fn(),
        revokeOthersByUserId: jest.fn(),
        touchActivity: jest.fn(),
        markStepUpVerified: jest.fn(),
      };

      const platformUsers = {
        findByEmail: jest.fn(),
        findById: jest.fn().mockResolvedValue(user),
        save: jest.fn(),
        updateLoginState: jest.fn(),
        updateMfaState: jest.fn(),
      };

      const handler = new PlatformRefreshHandler(
        platformUsers as never,
        refreshRepo as never,
        events as never,
        jwtTokenService,
        buildSessionPolicy(refreshRepo),
      );

      const pair2 = await handler.execute(pair1.refreshToken, '1.1.1.1', 'ua');
      expect(pair2.accessToken).toBeTruthy();
      expect(pair2.refreshToken).not.toBe(pair1.refreshToken);

      await expect(handler.execute(pair1.refreshToken, '1.1.1.1', 'ua')).rejects.toThrow(
        TokenInvalidException,
      );
      expect(events.publish).toHaveBeenCalledWith(expect.any(PlatformRefreshReuseDetectedEvent));
    });

    it('rejects clinic refresh tokens', async () => {
      const clinic = jwtTokenService.issueTokenPair({
        userId: 'u1',
        tenantId: 't1',
        branchId: null,
        roles: [],
        sessionId: 's1',
      });
      const refreshRepo = {
        save: jest.fn(),
        findByTokenHash: jest.fn(),
        revokeBySessionId: jest.fn(),
        revokeAllByUserId: jest.fn(),
        revokeFamily: jest.fn(),
        findById: jest.fn(),
        findBySessionId: jest.fn(),
        findActiveByUserId: jest.fn(),
        revokeOthersByUserId: jest.fn(),
        touchActivity: jest.fn(),
        markStepUpVerified: jest.fn(),
      };
      const handler = new PlatformRefreshHandler(
        { findById: jest.fn(), findByEmail: jest.fn(), save: jest.fn(), updateLoginState: jest.fn(), updateMfaState: jest.fn() } as never,
        refreshRepo as never,
        events as never,
        jwtTokenService,
        buildSessionPolicy(refreshRepo),
      );
      await expect(handler.execute(clinic.refreshToken, '1.1.1.1', 'ua')).rejects.toThrow(
        TokenInvalidException,
      );
    });

    it('rejects refresh when the session breached the absolute lifetime', async () => {
      const user = makePlatformUser();
      const pair1 = jwtTokenService.issuePlatformTokenPair({
        platformUserId: user.id,
        sessionId: 'sess-abs',
      });
      const expired = makeRefreshToken({
        platformUserId: user.id,
        rawToken: pair1.refreshToken,
        sessionId: 'sess-abs',
        absoluteExpiresAt: new Date(Date.now() - 1000),
      });
      const refreshRepo = {
        save: jest.fn(),
        findByTokenHash: jest.fn().mockResolvedValue(expired),
        revokeBySessionId: jest.fn().mockResolvedValue(undefined),
        revokeAllByUserId: jest.fn(),
        revokeFamily: jest.fn(),
        findById: jest.fn(),
        findBySessionId: jest.fn(),
        findActiveByUserId: jest.fn(),
        revokeOthersByUserId: jest.fn(),
        touchActivity: jest.fn(),
        markStepUpVerified: jest.fn(),
      };
      const platformUsers = {
        findByEmail: jest.fn(),
        findById: jest.fn().mockResolvedValue(user),
        save: jest.fn(),
        updateLoginState: jest.fn(),
        updateMfaState: jest.fn(),
      };
      const handler = new PlatformRefreshHandler(
        platformUsers as never,
        refreshRepo as never,
        events as never,
        jwtTokenService,
        buildSessionPolicy(refreshRepo),
      );

      await expect(handler.execute(pair1.refreshToken, '1.1.1.1', 'ua')).rejects.toThrow(
        TokenExpiredException,
      );
      expect(refreshRepo.revokeBySessionId).toHaveBeenCalledWith('sess-abs', 'absolute_expired');
    });
  });

  describe('PlatformLogoutHandler + me', () => {
    it('logout revokes session and blacklists jti; me returns safe metadata', async () => {
      const sessionCache = { blacklistJti: jest.fn().mockResolvedValue(undefined) };
      const refreshRepo = {
        revokeBySessionId: jest.fn().mockResolvedValue(undefined),
        save: jest.fn(),
        findByTokenHash: jest.fn(),
        revokeAllByUserId: jest.fn(),
        revokeFamily: jest.fn(),
        findById: jest.fn(),
        findBySessionId: jest.fn().mockResolvedValue(null),
        findActiveByUserId: jest.fn(),
        revokeOthersByUserId: jest.fn(),
        touchActivity: jest.fn(),
        markStepUpVerified: jest.fn(),
      };
      const logout = new PlatformLogoutHandler(
        refreshRepo as never,
        events as never,
        sessionCache as never,
        jwtTokenService,
      );
      await logout.execute({ platformUserId: 'pu-1', sessionId: 'sess-1', accessJti: 'jti-1' });
      expect(refreshRepo.revokeBySessionId).toHaveBeenCalledWith('sess-1');
      expect(sessionCache.blacklistJti).toHaveBeenCalledWith('jti-1', 900);
      expect(events.publish).toHaveBeenCalledWith(expect.any(PlatformLogoutEvent));

      // idempotent second logout
      await logout.execute({ platformUserId: 'pu-1', sessionId: 'sess-1', accessJti: 'jti-1' });

      const sessionPolicy = new PlatformSessionPolicyService(refreshRepo as never, events as never, mfa);
      const me = new PlatformMeHandler(
        {
          findById: jest.fn().mockResolvedValue(makePlatformUser()),
          findByEmail: jest.fn(),
          save: jest.fn(),
          updateLoginState: jest.fn(),
          updateMfaState: jest.fn(),
        } as never,
        refreshRepo as never,
        sessionPolicy,
      );
      const claims = new JwtClaimsVO({
        sub: 'pu-1',
        tenantId: null,
        branchId: null,
        roles: [],
        sessionId: 'sess-1',
        sessionClass: 'platform',
        principalType: 'platform',
        aud: PLATFORM_TOKEN_AUDIENCE,
        iss: 'booking-platform',
      });
      const dto = await me.execute(claims);
      expect(dto.principalType).toBe('platform');
      expect(dto).not.toHaveProperty('passwordHash');
      expect(dto).not.toHaveProperty('tenantId');
    });
  });

  describe('JwtAuthGuard audience boundary', () => {
    function mockContext(isPlatformRoute: boolean, user: JwtClaimsVO | null) {
      const reflector = {
        getAllAndOverride: jest.fn((key: string) => {
          if (key === 'isPublic') return false;
          if (key === 'isPlatformAuthRoute') return isPlatformRoute;
          return undefined;
        }),
      } as unknown as Reflector;
      const guard = new JwtAuthGuard(reflector);
      const ctx = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      } as unknown as ExecutionContext;
      return { guard, ctx };
    }

    it('rejects clinic token on platform route and platform token on tenant route', () => {
      const clinic = new JwtClaimsVO({
        sub: 'u1',
        tenantId: 't1',
        branchId: null,
        roles: ['super_admin'] as never,
        sessionId: 's',
        sessionClass: 'staff',
      });
      const platform = new JwtClaimsVO({
        sub: 'pu-1',
        tenantId: null,
        branchId: null,
        roles: [],
        sessionId: 's',
        sessionClass: 'platform',
        principalType: 'platform',
        aud: PLATFORM_TOKEN_AUDIENCE,
        iss: 'booking-platform',
      });

      const a = mockContext(true, clinic);
      expect(() => a.guard.handleRequest(null, clinic as never, null, a.ctx)).toThrow(
        UnauthorizedException,
      );

      const b = mockContext(false, platform);
      expect(() => b.guard.handleRequest(null, platform as never, null, b.ctx)).toThrow(
        UnauthorizedException,
      );

      const c = mockContext(true, platform);
      expect(c.guard.handleRequest(null, platform as never, null, c.ctx)).toBe(platform);
    });

    it('role name alone does not establish platform principal', () => {
      const superAdminClinic = new JwtClaimsVO({
        sub: 'u1',
        tenantId: 't1',
        branchId: null,
        roles: ['super_admin'] as never,
        sessionId: 's',
      });
      expect(superAdminClinic.isPlatformSession()).toBe(false);
      const { guard, ctx } = mockContext(true, superAdminClinic);
      expect(() => guard.handleRequest(null, superAdminClinic as never, null, ctx)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('cookie / CSRF helpers', () => {
    it('parses cookies and enforces exact origins', () => {
      const cookies = parseCookieHeader(`${PLATFORM_REFRESH_COOKIE_NAME}=abc; sa_platform_csrf=xyz`);
      expect(cookies[PLATFORM_REFRESH_COOKIE_NAME]).toBe('abc');

      expect(() =>
        assertPlatformCookieCsrf({
          origin: 'http://127.0.0.1:5176',
          method: 'POST',
        }),
      ).not.toThrow();

      expect(() =>
        assertPlatformCookieCsrf({
          origin: 'https://evil.example',
          method: 'POST',
        }),
      ).toThrow(/CSRF/);
    });
  });
});
