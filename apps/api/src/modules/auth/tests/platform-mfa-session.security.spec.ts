import { JwtService } from '@nestjs/jwt';
import { generateSync } from 'otplib';
import { UnauthorizedException } from '@nestjs/common';
import { JwtTokenService, JwtConfig } from '../infrastructure/services/jwt-token.service';
import { PlatformMfaService } from '../infrastructure/services/platform-mfa.service';
import { PlatformSecurityConfig } from '../config/platform-security.config';
import { PlatformUser } from '../domain/entities/platform-user.entity';
import { PlatformRefreshToken } from '../domain/entities/platform-refresh-token.entity';
import { PlatformMfaRecoveryCode } from '../domain/entities/platform-mfa-recovery-code.entity';
import { JwtClaimsVO, PLATFORM_TOKEN_AUDIENCE } from '../domain/value-objects/jwt-claims.vo';

import { PlatformSessionCompletionService } from '../application/services/platform-session-completion.service';
import { PlatformAssuranceService } from '../application/services/platform-assurance.service';
import { PlatformSessionPolicyService } from '../application/services/platform-session-policy.service';
import { PlatformSessionRevocationService } from '../application/services/platform-session-revocation.service';

import { PlatformMfaBeginEnrollmentHandler } from '../application/handlers/platform-mfa-begin-enrollment.handler';
import { PlatformMfaConfirmEnrollmentHandler } from '../application/handlers/platform-mfa-confirm-enrollment.handler';
import { PlatformMfaVerifyChallengeHandler } from '../application/handlers/platform-mfa-verify-challenge.handler';
import { PlatformMfaRegenerateRecoveryCodesHandler } from '../application/handlers/platform-mfa-regenerate-recovery-codes.handler';
import { PlatformRevokeSessionHandler } from '../application/handlers/platform-revoke-session.handler';
import { PlatformStepUpVerifyHandler } from '../application/handlers/platform-step-up-verify.handler';

import { InvalidMfaCodeException } from '../domain/exceptions/mfa.exceptions';
import { TokenInvalidException } from '../domain/exceptions/auth.exceptions';
import { JwtAuthGuard } from '../api/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PlatformLoginHandler } from '../application/handlers/platform-login.handler';
import { PlatformRefreshHandler } from '../application/handlers/platform-refresh.handler';
import { PlatformMeHandler } from '../application/handlers/platform-me.handler';
import { PlatformListSessionsHandler } from '../application/handlers/platform-list-sessions.handler';
import { PlatformStepUpStatusHandler } from '../application/handlers/platform-step-up-status.handler';
import { PlatformActivityHandler } from '../application/handlers/platform-activity.handler';
import { PasswordHasher } from '../../identity/infrastructure/password-hasher';

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
  recoveryCodeCount: 5,
  activityMinIntervalSeconds: 60,
};

function makeUser(overrides: Partial<{
  mfaEnabled: boolean;
  mfaSecretEncrypted: string | null;
  mfaPendingSecretEncrypted: string | null;
  mfaPendingExpiresAt: Date | null;
  failedMfaCount: number;
  lastTotpStep: string | null;
  isActive: boolean;
}> = {}): PlatformUser {
  return PlatformUser.restore({
    id: 'pu-1',
    email: 'ops@example.com',
    passwordHash: 'hash',
    displayName: 'Ops',
    isActive: overrides.isActive ?? true,
    lockedUntil: null,
    failedLoginCount: 0,
    passwordChangedAt: new Date(),
    lastLoginAt: null,
    lastLoginIp: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    mfaEnabled: overrides.mfaEnabled ?? false,
    mfaSecretEncrypted: overrides.mfaSecretEncrypted ?? null,
    mfaKeyVersion: '1',
    mfaPendingSecretEncrypted: overrides.mfaPendingSecretEncrypted ?? null,
    mfaPendingExpiresAt: overrides.mfaPendingExpiresAt ?? null,
    mfaConfirmedAt: overrides.mfaEnabled ? new Date() : null,
    lastTotpStep: overrides.lastTotpStep ?? null,
    failedMfaCount: overrides.failedMfaCount ?? 0,
  });
}

function makeSession(overrides: Partial<{
  platformUserId: string;
  sessionId: string;
  stepUpVerifiedAt: Date | null;
  absoluteExpiresAt: Date;
  lastActivityAt: Date;
  userAgent: string | null;
  deviceLabel: string | null;
}> = {}): PlatformRefreshToken {
  const base = PlatformRefreshToken.create({
    platformUserId: overrides.platformUserId ?? 'pu-1',
    rawToken: 'raw',
    sessionId: overrides.sessionId ?? 'sess-1',
    familyId: 'fam-1',
    expiresAt: new Date(Date.now() + 3_600_000),
    ipAddress: '1.1.1.1',
    userAgent: overrides.userAgent ?? 'ua',
    absoluteExpiresAt: overrides.absoluteExpiresAt ?? new Date(Date.now() + 43_200_000),
    lastActivityAt: overrides.lastActivityAt,
    deviceLabel: overrides.deviceLabel,
  });
  return PlatformRefreshToken.restore({
    id: base.id,
    platformUserId: base.platformUserId,
    tokenHash: base.tokenHash,
    sessionId: base.sessionId,
    familyId: base.familyId,
    expiresAt: base.expiresAt,
    revokedAt: base.revokedAt,
    ipAddress: base.ipAddress,
    userAgent: base.userAgent,
    createdAt: base.createdAt,
    lastActivityAt: overrides.lastActivityAt ?? base.lastActivityAt,
    absoluteExpiresAt: base.absoluteExpiresAt,
    mfaCompletedAt: base.mfaCompletedAt,
    assuranceLevel: base.assuranceLevel,
    stepUpVerifiedAt: overrides.stepUpVerifiedAt ?? base.stepUpVerifiedAt,
    deviceLabel: base.deviceLabel,
    authMethod: base.authMethod,
    revocationReason: base.revocationReason,
  });
}

function platformClaims(sessionId = 'sess-1', sub = 'pu-1'): JwtClaimsVO {
  return new JwtClaimsVO({
    sub,
    tenantId: null,
    branchId: null,
    roles: [],
    sessionId,
    sessionClass: 'platform',
    principalType: 'platform',
    aud: PLATFORM_TOKEN_AUDIENCE,
    iss: 'booking-platform',
  });
}

function mockPlatformUsers(user: PlatformUser | null) {
  return {
    findByEmail: jest.fn().mockResolvedValue(user),
    findById: jest.fn().mockResolvedValue(user),
    save: jest.fn().mockResolvedValue(undefined),
    updateLoginState: jest.fn().mockResolvedValue(undefined),
    updateMfaState: jest.fn().mockResolvedValue(undefined),
  };
}

function mockRefreshRepo(session: PlatformRefreshToken | null = null) {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findByTokenHash: jest.fn(),
    findById: jest.fn(),
    findBySessionId: jest.fn().mockResolvedValue(session),
    findActiveByUserId: jest.fn().mockResolvedValue(session ? [session] : []),
    revokeBySessionId: jest.fn().mockResolvedValue(undefined),
    revokeBySessionIdForUser: jest.fn().mockResolvedValue(1),
    revokeAllByUserId: jest.fn().mockResolvedValue(0),
    revokeOthersByUserId: jest.fn().mockResolvedValue(0),
    revokeFamily: jest.fn().mockResolvedValue(undefined),
    touchActivity: jest.fn().mockResolvedValue(undefined),
    markStepUpVerified: jest.fn().mockResolvedValue(undefined),
  };
}

function mockAttemptRepo() {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    countRecentFailures: jest.fn().mockResolvedValue(0),
    countRecentFailuresByIp: jest.fn().mockResolvedValue(0),
    listByEmail: jest.fn(),
  };
}

function mockRecoveryCodes() {
  return {
    saveMany: jest.fn().mockResolvedValue(undefined),
    findByCodeHash: jest.fn().mockResolvedValue(null),
    markUsed: jest.fn().mockResolvedValue(undefined),
    deleteAllForUser: jest.fn().mockResolvedValue(undefined),
    countUnused: jest.fn().mockResolvedValue(0),
  };
}

describe('Phase 47 Step 07 — platform MFA + session security', () => {
  let jwtTokenService: JwtTokenService;
  let mfa: PlatformMfaService;
  let events: { publish: jest.Mock };

  beforeEach(() => {
    jwtTokenService = new JwtTokenService(new JwtService({}), JWT_CFG);
    mfa = new PlatformMfaService(MFA_CFG);
    events = { publish: jest.fn().mockResolvedValue(undefined) };
  });

  describe('login state machine', () => {
    it('never returns an access token when MFA is not enabled', async () => {
      (PasswordHasher.compare as jest.Mock).mockResolvedValue(true);

      const user = makeUser({ mfaEnabled: false });
      const handler = new PlatformLoginHandler(
        mockPlatformUsers(user) as never,
        mockAttemptRepo() as never,
        events as never,
        jwtTokenService,
        mfa,
      );

      const result = await handler.execute({
        email: user.email,
        password: 'anything',
        ipAddress: '1.1.1.1',
        userAgent: 'ua',
      });

      expect(result.kind).toBe('mfa_enrollment_required');
      expect(JSON.stringify(result)).not.toMatch(/accessToken/);
      if (result.kind === 'mfa_enrollment_required') {
        expect(jwtTokenService.verifyAccessToken(result.preauthToken)).toBeNull();
      }
    });
  });

  describe('preauth vs access token boundary', () => {
    it('a challenge preauth token cannot verify as an access token or hit /me', () => {
      const preauth = jwtTokenService.issuePlatformPreauthToken({
        platformUserId: 'pu-1',
        purpose: 'mfa_challenge',
        transactionId: 'tx-1',
        expiresInSeconds: 300,
      });

      expect(jwtTokenService.verifyAccessToken(preauth.token)).toBeNull();

      // Simulate JwtStrategy.validate: decoded payload type must be 'access'.
      const decoded = new JwtService({}).decode(preauth.token) as Record<string, unknown>;
      expect(decoded['type']).toBe('platform_preauth');
      expect(decoded['type']).not.toBe('access');
    });
  });

  describe('encryption at rest', () => {
    it('never stores the plaintext TOTP secret — only an AES-GCM envelope', () => {
      const plaintextSecret = mfa.generateSecret();
      const encrypted = mfa.encrypt(plaintextSecret);

      expect(encrypted).not.toContain(plaintextSecret);
      expect(encrypted).not.toEqual(plaintextSecret);
      // Envelope is base64 of {headerLen}{header}{ciphertext} — decrypting must round-trip.
      expect(mfa.decrypt(encrypted)).toBe(plaintextSecret);
    });
  });

  describe('MFA enrollment', () => {
    it('confirm enrollment activates MFA and issues a session only after a valid code', async () => {
      const user = makeUser({ mfaEnabled: false });
      const platformUsers = mockPlatformUsers(user);
      const preauth = jwtTokenService.issuePlatformPreauthToken({
        platformUserId: user.id,
        purpose: 'mfa_enrollment',
        transactionId: 'tx-1',
        expiresInSeconds: 900,
      });

      const beginHandler = new PlatformMfaBeginEnrollmentHandler(
        platformUsers as never,
        jwtTokenService,
        mfa,
        events as never,
      );
      const begin = await beginHandler.execute(preauth.token);
      expect(begin.secret).toBeTruthy();
      expect(platformUsers.updateMfaState).toHaveBeenCalled();

      // Simulate persisted pending secret from beginHandler's updateMfaState call.
      const pendingEncrypted = (platformUsers.updateMfaState as jest.Mock).mock.calls[0][0]
        .mfaPendingSecretEncrypted as string;
      const userWithPending = makeUser({
        mfaEnabled: false,
        mfaPendingSecretEncrypted: pendingEncrypted,
        mfaPendingExpiresAt: new Date(Date.now() + 900_000),
      });
      platformUsers.findById.mockResolvedValue(userWithPending);

      const validCode = generateSync({ secret: begin.secret });

      const refreshRepo = mockRefreshRepo();
      const sessionCompletion = new PlatformSessionCompletionService(
        refreshRepo as never,
        jwtTokenService,
        mfa,
      );
      const recoveryCodes = mockRecoveryCodes();
      const attemptRepo = mockAttemptRepo();

      const confirmHandler = new PlatformMfaConfirmEnrollmentHandler(
        platformUsers as never,
        recoveryCodes as never,
        attemptRepo as never,
        events as never,
        jwtTokenService,
        mfa,
        sessionCompletion,
      );

      const result = await confirmHandler.execute({
        preauthToken: preauth.token,
        code: validCode,
        ipAddress: '1.1.1.1',
        userAgent: 'ua',
      });

      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.recoveryCodes).toHaveLength(MFA_CFG.recoveryCodeCount);
      expect(refreshRepo.save).toHaveBeenCalled();
      const confirmedUser = (platformUsers.updateMfaState as jest.Mock).mock.calls.at(-1)?.[0] as PlatformUser;
      expect(confirmedUser.mfaEnabled).toBe(true);
      expect(confirmedUser.mfaSecretEncrypted).not.toContain(begin.secret);
    });
  });

  describe('MFA challenge', () => {
    it('challenge success (valid TOTP) issues a session with authMethod=totp', async () => {
      const secret = mfa.generateSecret();
      const encrypted = mfa.encrypt(secret);
      const user = makeUser({ mfaEnabled: true, mfaSecretEncrypted: encrypted });
      const platformUsers = mockPlatformUsers(user);
      const refreshRepo = mockRefreshRepo();
      const recoveryCodes = mockRecoveryCodes();
      const attemptRepo = mockAttemptRepo();
      const sessionCompletion = new PlatformSessionCompletionService(
        refreshRepo as never,
        jwtTokenService,
        mfa,
      );

      const preauth = jwtTokenService.issuePlatformPreauthToken({
        platformUserId: user.id,
        purpose: 'mfa_challenge',
        transactionId: 'tx-2',
        expiresInSeconds: 300,
      });

      const handler = new PlatformMfaVerifyChallengeHandler(
        platformUsers as never,
        recoveryCodes as never,
        attemptRepo as never,
        events as never,
        jwtTokenService,
        mfa,
        sessionCompletion,
      );

      const validCode = generateSync({ secret });
      const tokens = await handler.execute({
        preauthToken: preauth.token,
        code: validCode,
        ipAddress: '1.1.1.1',
        userAgent: 'ua',
      });

      expect(tokens.accessToken).toBeTruthy();
      expect(refreshRepo.save).toHaveBeenCalled();
      const savedToken = (refreshRepo.save as jest.Mock).mock.calls[0][0] as PlatformRefreshToken;
      expect(savedToken.authMethod).toBe('totp');
    });

    it('rejects an invalid TOTP code and increments failedMfaCount', async () => {
      const secret = mfa.generateSecret();
      const encrypted = mfa.encrypt(secret);
      const user = makeUser({ mfaEnabled: true, mfaSecretEncrypted: encrypted });
      const platformUsers = mockPlatformUsers(user);
      const refreshRepo = mockRefreshRepo();
      const recoveryCodes = mockRecoveryCodes();
      const attemptRepo = mockAttemptRepo();
      const sessionCompletion = new PlatformSessionCompletionService(
        refreshRepo as never,
        jwtTokenService,
        mfa,
      );
      const preauth = jwtTokenService.issuePlatformPreauthToken({
        platformUserId: user.id,
        purpose: 'mfa_challenge',
        transactionId: 'tx-3',
        expiresInSeconds: 300,
      });
      const handler = new PlatformMfaVerifyChallengeHandler(
        platformUsers as never,
        recoveryCodes as never,
        attemptRepo as never,
        events as never,
        jwtTokenService,
        mfa,
        sessionCompletion,
      );

      await expect(
        handler.execute({
          preauthToken: preauth.token,
          code: '000000',
          ipAddress: '1.1.1.1',
          userAgent: 'ua',
        }),
      ).rejects.toThrow(InvalidMfaCodeException);

      const failed = (platformUsers.updateMfaState as jest.Mock).mock.calls[0][0] as PlatformUser;
      expect(failed.failedMfaCount).toBe(1);
    });

    it('recovery codes are one-time use — the second attempt with the same code fails', async () => {
      const user = makeUser({ mfaEnabled: true, mfaSecretEncrypted: mfa.encrypt(mfa.generateSecret()) });
      const [entities, rawCodes] = PlatformMfaRecoveryCode.generateBatch({
        platformUserId: user.id,
        count: 1,
      });
      const rawCode = rawCodes[0]!;
      const codeHash = PlatformMfaRecoveryCode.hashRaw(rawCode);
      expect(codeHash).toBe(entities[0]!.codeHash);

      const platformUsers = mockPlatformUsers(user);
      const refreshRepo = mockRefreshRepo();
      const recoveryCodes = mockRecoveryCodes();
      // First call: code is unused. Second call: already consumed (findByCodeHash returns null
      // because the repository only returns usedAt: null rows).
      recoveryCodes.findByCodeHash
        .mockResolvedValueOnce(entities[0]!)
        .mockResolvedValueOnce(null);
      const attemptRepo = mockAttemptRepo();
      const sessionCompletion = new PlatformSessionCompletionService(
        refreshRepo as never,
        jwtTokenService,
        mfa,
      );
      const handler = new PlatformMfaVerifyChallengeHandler(
        platformUsers as never,
        recoveryCodes as never,
        attemptRepo as never,
        events as never,
        jwtTokenService,
        mfa,
        sessionCompletion,
      );

      const issuePreauth = () =>
        jwtTokenService.issuePlatformPreauthToken({
          platformUserId: user.id,
          purpose: 'mfa_challenge',
          transactionId: 'tx-recovery',
          expiresInSeconds: 300,
        }).token;

      const first = await handler.execute({
        preauthToken: issuePreauth(),
        code: rawCode,
        ipAddress: '1.1.1.1',
        userAgent: 'ua',
      });
      expect(first.accessToken).toBeTruthy();
      expect(recoveryCodes.markUsed).toHaveBeenCalledWith(entities[0]!.id);

      await expect(
        handler.execute({
          preauthToken: issuePreauth(),
          code: rawCode,
          ipAddress: '1.1.1.1',
          userAgent: 'ua',
        }),
      ).rejects.toThrow(InvalidMfaCodeException);
    });
  });

  describe('step-up requirement for sensitive operations', () => {
    it('regenerating recovery codes requires a fresh step-up on the current session', async () => {
      const user = makeUser({ mfaEnabled: true, mfaSecretEncrypted: mfa.encrypt(mfa.generateSecret()) });
      const platformUsers = mockPlatformUsers(user);
      const staleSession = makeSession({ platformUserId: user.id, stepUpVerifiedAt: null });
      const refreshRepo = mockRefreshRepo(staleSession);
      const recoveryCodes = mockRecoveryCodes();
      const assurance = new PlatformAssuranceService(mfa);

      const handler = new PlatformMfaRegenerateRecoveryCodesHandler(
        platformUsers as never,
        recoveryCodes as never,
        refreshRepo as never,
        mfa,
        assurance,
        events as never,
      );

      const claims = new JwtClaimsVO({
        sub: user.id,
        tenantId: null,
        branchId: null,
        roles: [],
        sessionId: staleSession.sessionId,
        sessionClass: 'platform',
        principalType: 'platform',
        aud: PLATFORM_TOKEN_AUDIENCE,
        iss: 'booking-platform',
      });

      await expect(handler.execute(claims)).rejects.toThrow(ForbiddenException);

      // Now simulate a freshly step-up-verified session — must succeed.
      const freshSession = makeSession({
        platformUserId: user.id,
        sessionId: staleSession.sessionId,
        stepUpVerifiedAt: new Date(),
      });
      refreshRepo.findBySessionId.mockResolvedValue(freshSession);

      const result = await handler.execute(claims);
      expect(result.recoveryCodes).toHaveLength(MFA_CFG.recoveryCodeCount);
    });

    it('step-up verify binds freshness to the CURRENT session only', async () => {
      const secret = mfa.generateSecret();
      const user = makeUser({ mfaEnabled: true, mfaSecretEncrypted: mfa.encrypt(secret) });
      const platformUsers = mockPlatformUsers(user);
      const session = makeSession({ platformUserId: user.id, sessionId: 'sess-current' });
      const refreshRepo = mockRefreshRepo(session);
      const recoveryCodes = mockRecoveryCodes();
      const assurance = new PlatformAssuranceService(mfa);

      const handler = new PlatformStepUpVerifyHandler(
        platformUsers as never,
        refreshRepo as never,
        recoveryCodes as never,
        mfa,
        assurance,
        events as never,
      );

      const claims = new JwtClaimsVO({
        sub: user.id,
        tenantId: null,
        branchId: null,
        roles: [],
        sessionId: 'sess-current',
        sessionClass: 'platform',
        principalType: 'platform',
        aud: PLATFORM_TOKEN_AUDIENCE,
        iss: 'booking-platform',
      });

      const validCode = generateSync({ secret });
      const result = await handler.execute(claims, validCode);
      expect(result.stepUpVerifiedUntil.getTime()).toBeGreaterThan(Date.now());
      expect(refreshRepo.markStepUpVerified).toHaveBeenCalledWith('sess-current', expect.any(Date));
    });
  });

  describe('idle / absolute session expiry helpers', () => {
    it('flags a session idle-expired once lastActivityAt exceeds the idle window', () => {
      const stale = makeSession({
        lastActivityAt: new Date(Date.now() - (MFA_CFG.sessionIdleSeconds + 60) * 1000),
      });
      expect(stale.isIdleExpired(MFA_CFG.sessionIdleSeconds)).toBe(true);

      const fresh = makeSession({ lastActivityAt: new Date() });
      expect(fresh.isIdleExpired(MFA_CFG.sessionIdleSeconds)).toBe(false);
    });

    it('flags a session absolute-expired once past absoluteExpiresAt, regardless of activity', () => {
      const expired = makeSession({ absoluteExpiresAt: new Date(Date.now() - 1000) });
      expect(expired.isAbsoluteExpired()).toBe(true);

      const alive = makeSession({ absoluteExpiresAt: new Date(Date.now() + 1000) });
      expect(alive.isAbsoluteExpired()).toBe(false);
    });

    it('PlatformSessionPolicyService rejects and revokes idle/absolute-expired sessions', async () => {
      const refreshRepo = mockRefreshRepo();
      const policy = new PlatformSessionPolicyService(refreshRepo as never, events as never, mfa);

      const idleExpired = makeSession({
        lastActivityAt: new Date(Date.now() - (MFA_CFG.sessionIdleSeconds + 60) * 1000),
      });
      await expect(policy.assertSessionAlive(idleExpired)).rejects.toThrow();
      expect(refreshRepo.revokeBySessionId).toHaveBeenCalledWith(idleExpired.sessionId, 'idle_expired');

      const absoluteExpired = makeSession({ absoluteExpiresAt: new Date(Date.now() - 1000) });
      await expect(policy.assertSessionAlive(absoluteExpired)).rejects.toThrow();
      expect(refreshRepo.revokeBySessionId).toHaveBeenCalledWith(
        absoluteExpired.sessionId,
        'absolute_expired',
      );
    });
  });

  describe('idle timeout integrity — passive paths must not extend interactive activity', () => {
    const fixedActivity = () => new Date(Date.now() - 60_000); // 1 minute ago — still within idle window
    const fixedAbsolute = () => new Date(Date.now() + 43_200_000);

    it('repeated refresh does not update interactive activity or absolute expiry', async () => {
      const user = makeUser({ mfaEnabled: true, mfaSecretEncrypted: mfa.encrypt(mfa.generateSecret()) });
      const pair = jwtTokenService.issuePlatformTokenPair({
        platformUserId: user.id,
        sessionId: 'sess-refresh',
      });
      const activityAt = fixedActivity();
      const absoluteAt = fixedAbsolute();
      const stored = PlatformRefreshToken.create({
        platformUserId: user.id,
        rawToken: pair.refreshToken,
        sessionId: 'sess-refresh',
        familyId: 'fam-refresh',
        expiresAt: new Date(Date.now() + 3_600_000),
        ipAddress: '1.1.1.1',
        userAgent: 'ua',
        absoluteExpiresAt: absoluteAt,
        lastActivityAt: activityAt,
      });
      const tokensByHash = new Map([[stored.tokenHash, stored]]);
      const refreshRepo = {
        ...mockRefreshRepo(stored),
        findByTokenHash: jest.fn().mockImplementation(async (hash: string) => tokensByHash.get(hash) ?? null),
        save: jest.fn().mockImplementation(async (t: PlatformRefreshToken) => {
          tokensByHash.set(t.tokenHash, t);
        }),
        revokeBySessionId: jest.fn().mockResolvedValue(undefined),
      };
      const policy = new PlatformSessionPolicyService(refreshRepo as never, events as never, mfa);
      const handler = new PlatformRefreshHandler(
        mockPlatformUsers(user) as never,
        refreshRepo as never,
        events as never,
        jwtTokenService,
        policy,
      );

      const rotated = await handler.execute(pair.refreshToken, '1.1.1.1', 'ua');
      expect(rotated.refreshToken).toBeTruthy();
      const saved = (refreshRepo.save as jest.Mock).mock.calls[0][0] as PlatformRefreshToken;
      expect(saved.lastActivityAt.toISOString()).toBe(activityAt.toISOString());
      expect(saved.absoluteExpiresAt.toISOString()).toBe(absoluteAt.toISOString());
      expect(refreshRepo.touchActivity).not.toHaveBeenCalled();
    });

    it('repeated /me calls do not update interactive activity', async () => {
      const user = makeUser({ mfaEnabled: true });
      const session = makeSession({
        lastActivityAt: fixedActivity(),
        absoluteExpiresAt: fixedAbsolute(),
      });
      const refreshRepo = mockRefreshRepo(session);
      const policy = new PlatformSessionPolicyService(refreshRepo as never, events as never, mfa);
      const handler = new PlatformMeHandler(
        mockPlatformUsers(user) as never,
        refreshRepo as never,
        policy,
      );

      await handler.execute(platformClaims(session.sessionId));
      await handler.execute(platformClaims(session.sessionId));
      expect(refreshRepo.touchActivity).not.toHaveBeenCalled();
    });

    it('session-list and step-up-status polling do not extend idle activity', async () => {
      const activityAt = fixedActivity();
      const session = makeSession({
        lastActivityAt: activityAt,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        deviceLabel: 'Ops laptop',
      });
      const refreshRepo = mockRefreshRepo(session);
      const assurance = new PlatformAssuranceService(mfa);
      const policy = new PlatformSessionPolicyService(refreshRepo as never, events as never, mfa);
      const list = new PlatformListSessionsHandler(refreshRepo as never, assurance, policy);
      const status = new PlatformStepUpStatusHandler(refreshRepo as never, assurance);

      const listed = await list.execute(platformClaims(session.sessionId));
      await list.execute(platformClaims(session.sessionId));
      await status.execute(platformClaims(session.sessionId));
      await status.execute(platformClaims(session.sessionId));

      expect(refreshRepo.touchActivity).not.toHaveBeenCalled();
      expect(listed[0]!.deviceSummary).toBe('Chrome on Windows');
      expect(listed[0]).not.toHaveProperty('userAgent');
      expect(listed[0]).not.toHaveProperty('ipAddress');
      expect(listed[0]!.lastInteractiveActivityAt.toISOString()).toBe(activityAt.toISOString());
    });

    it('verified interactive activity extends idle expiry for the current session only', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-07-21T12:00:00.000Z'));
      try {
        const absoluteAt = new Date('2026-07-21T22:00:00.000Z');
        const session = makeSession({
          sessionId: 'sess-current',
          lastActivityAt: new Date('2026-07-21T11:45:00.000Z'),
          absoluteExpiresAt: absoluteAt,
        });
        const other = makeSession({
          sessionId: 'sess-other',
          lastActivityAt: new Date('2026-07-21T11:45:00.000Z'),
          absoluteExpiresAt: absoluteAt,
        });
        const refreshRepo = mockRefreshRepo(session);
        refreshRepo.findBySessionId.mockImplementation(async (id: string) =>
          id === 'sess-current' ? session : id === 'sess-other' ? other : null,
        );
        const policy = new PlatformSessionPolicyService(refreshRepo as never, events as never, mfa);
        const activity = new PlatformActivityHandler(refreshRepo as never, policy);

        const result = await activity.execute(platformClaims('sess-current'));
        expect(result.updated).toBe(true);
        expect(result.absoluteExpiresAt).toBe(absoluteAt.toISOString());
        expect(refreshRepo.touchActivity).toHaveBeenCalledWith(
          'sess-current',
          expect.any(Date),
        );
        expect(refreshRepo.touchActivity).not.toHaveBeenCalledWith(
          'sess-other',
          expect.anything(),
        );

        // Throttle: immediate second signal does not write again.
        refreshRepo.touchActivity.mockClear();
        const touched = makeSession({
          sessionId: 'sess-current',
          lastActivityAt: new Date('2026-07-21T12:00:00.000Z'),
          absoluteExpiresAt: absoluteAt,
        });
        refreshRepo.findBySessionId.mockResolvedValue(touched);
        const throttled = await activity.execute(platformClaims('sess-current'));
        expect(throttled.updated).toBe(false);
        expect(refreshRepo.touchActivity).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    it('activity cannot update another user session and rejects tenant/patient principals', async () => {
      const foreign = makeSession({ platformUserId: 'pu-OTHER', sessionId: 'sess-foreign' });
      const refreshRepo = mockRefreshRepo(foreign);
      const policy = new PlatformSessionPolicyService(refreshRepo as never, events as never, mfa);
      const activity = new PlatformActivityHandler(refreshRepo as never, policy);

      await expect(activity.execute(platformClaims('sess-foreign', 'pu-1'))).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshRepo.touchActivity).not.toHaveBeenCalled();

      const tenantClaims = new JwtClaimsVO({
        sub: 'u1',
        tenantId: 't1',
        branchId: null,
        roles: [],
        sessionId: 'sess-1',
        sessionClass: 'staff',
        principalType: 'staff',
        aud: 'clinic',
      });
      await expect(activity.execute(tenantClaims)).rejects.toThrow(UnauthorizedException);

      const patientClaims = new JwtClaimsVO({
        sub: 'p1',
        tenantId: 't1',
        branchId: null,
        roles: [],
        sessionId: 'sess-1',
        sessionClass: 'patient',
        principalType: 'patient',
        aud: 'patient-portal',
      });
      await expect(activity.execute(patientClaims)).rejects.toThrow(UnauthorizedException);
    });

    it('activity after idle or absolute expiry is rejected and never changes absolute expiry', async () => {
      const absoluteAt = fixedAbsolute();
      const idleExpired = makeSession({
        lastActivityAt: new Date(Date.now() - (MFA_CFG.sessionIdleSeconds + 60) * 1000),
        absoluteExpiresAt: absoluteAt,
      });
      const refreshRepo = mockRefreshRepo(idleExpired);
      const policy = new PlatformSessionPolicyService(refreshRepo as never, events as never, mfa);
      const activity = new PlatformActivityHandler(refreshRepo as never, policy);

      await expect(activity.execute(platformClaims(idleExpired.sessionId))).rejects.toThrow();
      expect(refreshRepo.touchActivity).not.toHaveBeenCalled();

      const absoluteExpired = makeSession({
        absoluteExpiresAt: new Date(Date.now() - 1000),
        lastActivityAt: new Date(),
      });
      refreshRepo.findBySessionId.mockResolvedValue(absoluteExpired);
      await expect(activity.execute(platformClaims(absoluteExpired.sessionId))).rejects.toThrow();
      expect(refreshRepo.touchActivity).not.toHaveBeenCalled();
    });
  });

  describe('revoke-one IDOR protection', () => {
    it('cannot revoke a session belonging to another platform user (returns 404, not the session)', async () => {
      const otherUsersSession = makeSession({ platformUserId: 'pu-OTHER', sessionId: 'sess-other' });
      const refreshRepo = mockRefreshRepo(otherUsersSession);
      const revocationService = new PlatformSessionRevocationService(refreshRepo as never, events as never);
      const handler = new PlatformRevokeSessionHandler(refreshRepo as never, revocationService);

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

      await expect(handler.execute(claims, 'sess-other')).rejects.toThrow(NotFoundException);
      expect(refreshRepo.revokeBySessionId).not.toHaveBeenCalled();
      expect(refreshRepo.revokeBySessionIdForUser).not.toHaveBeenCalled();
    });

    it('can revoke its own session', async () => {
      const ownSession = makeSession({ platformUserId: 'pu-1', sessionId: 'sess-own' });
      const refreshRepo = mockRefreshRepo(ownSession);
      const revocationService = new PlatformSessionRevocationService(refreshRepo as never, events as never);
      const handler = new PlatformRevokeSessionHandler(refreshRepo as never, revocationService);

      const claims = new JwtClaimsVO({
        sub: 'pu-1',
        tenantId: null,
        branchId: null,
        roles: [],
        sessionId: 'sess-active',
        sessionClass: 'platform',
        principalType: 'platform',
        aud: PLATFORM_TOKEN_AUDIENCE,
        iss: 'booking-platform',
      });

      await handler.execute(claims, 'sess-own');
      expect(refreshRepo.revokeBySessionIdForUser).toHaveBeenCalledWith('pu-1', 'sess-own', 'user_requested');
    });
  });

  describe('role/audience boundary cannot be bypassed', () => {
    it('a super_admin CLINIC token is still rejected on platform routes (role name alone is insufficient)', () => {
      const reflector = {
        getAllAndOverride: jest.fn((key: string) => {
          if (key === 'isPublic') return false;
          if (key === 'isPlatformAuthRoute') return true;
          return undefined;
        }),
      } as unknown as Reflector;
      const guard = new JwtAuthGuard(reflector);
      const superAdminClinicClaims = new JwtClaimsVO({
        sub: 'u1',
        tenantId: 't1',
        branchId: null,
        roles: ['super_admin'] as never,
        sessionId: 's',
        sessionClass: 'staff',
      });
      expect(superAdminClinicClaims.isPlatformSession()).toBe(false);

      const ctx = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => ({ user: superAdminClinicClaims }) }),
      } as unknown as ExecutionContext;

      expect(() =>
        guard.handleRequest(null, superAdminClinicClaims as never, null, ctx),
      ).toThrow(UnauthorizedException);
    });

    it('a preauth token cannot be used to authenticate any @PlatformAuthRoute (never type=access)', () => {
      const preauth = jwtTokenService.issuePlatformPreauthToken({
        platformUserId: 'pu-1',
        purpose: 'mfa_enrollment',
        transactionId: 'tx-9',
        expiresInSeconds: 900,
      });
      const decoded = new JwtService({}).decode(preauth.token) as Record<string, unknown>;
      // JwtStrategy.validate() throws UnauthorizedException whenever type !== 'access'.
      expect(decoded['type']).not.toBe('access');
      expect(jwtTokenService.claimsFromPayload(decoded)).toBeNull();
    });
  });

  describe('preauth expiry / invalid rejection', () => {
    it('rejects an expired or tampered preauth token', () => {
      const jwt = new JwtService({});
      const forged = jwt.sign(
        {
          type: 'platform_preauth',
          sub: 'pu-1',
          purpose: 'mfa_challenge',
          transactionId: 'tx',
          sessionClass: 'platform',
          principalType: 'platform',
          aud: 'platform-preauth',
          iss: 'wrong-issuer',
        },
        { secret: JWT_CFG.platformAccessSecret, expiresIn: 300 },
      );
      expect(jwtTokenService.verifyPlatformPreauthToken(forged, 'mfa_challenge')).toBeNull();
    });

    it('throws TokenInvalidException semantics when the enrollment handler receives a bad preauth token', async () => {
      const platformUsers = mockPlatformUsers(makeUser());
      const handler = new PlatformMfaBeginEnrollmentHandler(
        platformUsers as never,
        jwtTokenService,
        mfa,
        events as never,
      );
      await expect(handler.execute('not-a-real-token')).rejects.toThrow(TokenInvalidException);
    });
  });
});
