import { TemporaryTokenService, TOKEN_TTL } from '../services/temporary-token.service';
import { RedisKeyBuilder } from '../redis-key.builder';
import { MockRedisService } from './mock-redis.service';

const TENANT = 'tenant-abc';
const USER_ID = 'user-123';
const HASH = 'sha256hashoftoken';

function buildSvc() {
  const redis = new MockRedisService();
  const kb = new RedisKeyBuilder('app');
  const svc = new TemporaryTokenService(redis as any, kb);
  return { redis, svc };
}

describe('TemporaryTokenService', () => {
  describe('Password Reset Tokens', () => {
    it('stores and retrieves a password reset token', async () => {
      const { svc } = buildSvc();
      await svc.storePasswordResetToken(TENANT, USER_ID, HASH);
      const stored = await svc.findPasswordResetToken(HASH);
      expect(stored).not.toBeNull();
      expect(stored!.userId).toBe(USER_ID);
      expect(stored!.tenantId).toBe(TENANT);
    });

    it('returns null for an unknown token hash', async () => {
      const { svc } = buildSvc();
      const result = await svc.findPasswordResetToken('unknown-hash');
      expect(result).toBeNull();
    });

    it('invalidates a password reset token', async () => {
      const { svc } = buildSvc();
      await svc.storePasswordResetToken(TENANT, USER_ID, HASH);
      await svc.invalidatePasswordResetToken(HASH);
      const result = await svc.findPasswordResetToken(HASH);
      expect(result).toBeNull();
    });

    it('default TTL matches TOKEN_TTL.PASSWORD_RESET', () => {
      expect(TOKEN_TTL.PASSWORD_RESET).toBe(3600);
    });

    it('returns null when Redis is offline', async () => {
      const { svc, redis } = buildSvc();
      redis.goOffline();
      const result = await svc.findPasswordResetToken(HASH);
      expect(result).toBeNull();
    });

    it('does not throw when storing with Redis offline', async () => {
      const { svc, redis } = buildSvc();
      redis.goOffline();
      await expect(svc.storePasswordResetToken(TENANT, USER_ID, HASH)).resolves.not.toThrow();
    });
  });

  describe('Email Verification Tokens', () => {
    it('stores and retrieves an email verification token', async () => {
      const { svc } = buildSvc();
      await svc.storeEmailVerifyToken(TENANT, USER_ID, HASH);
      const stored = await svc.findEmailVerifyToken(HASH);
      expect(stored).not.toBeNull();
      expect(stored!.userId).toBe(USER_ID);
    });

    it('invalidates an email verification token', async () => {
      const { svc } = buildSvc();
      await svc.storeEmailVerifyToken(TENANT, USER_ID, HASH);
      await svc.invalidateEmailVerifyToken(HASH);
      expect(await svc.findEmailVerifyToken(HASH)).toBeNull();
    });

    it('default TTL matches TOKEN_TTL.EMAIL_VERIFICATION (24h)', () => {
      expect(TOKEN_TTL.EMAIL_VERIFICATION).toBe(60 * 60 * 24);
    });
  });

  describe('MFA Challenge Tokens', () => {
    it('stores and retrieves an MFA challenge token', async () => {
      const { svc } = buildSvc();
      await svc.storeMfaChallengeToken(TENANT, USER_ID, 'challenge-id-1');
      const stored = await svc.findMfaChallengeToken('challenge-id-1');
      expect(stored).not.toBeNull();
      expect(stored!.userId).toBe(USER_ID);
    });

    it('invalidates an MFA challenge token', async () => {
      const { svc } = buildSvc();
      await svc.storeMfaChallengeToken(TENANT, USER_ID, 'challenge-id-2');
      await svc.invalidateMfaChallengeToken('challenge-id-2');
      expect(await svc.findMfaChallengeToken('challenge-id-2')).toBeNull();
    });

    it('MFA TTL matches TOKEN_TTL.MFA_CHALLENGE (5 min)', () => {
      expect(TOKEN_TTL.MFA_CHALLENGE).toBe(300);
    });
  });

  describe('Isolation between token types', () => {
    it('password reset and email verify tokens with same hash are stored separately', async () => {
      const { svc } = buildSvc();
      const sameHash = 'same-hash-value';
      await svc.storePasswordResetToken(TENANT, 'user-reset', sameHash);
      await svc.storeEmailVerifyToken(TENANT, 'user-verify', sameHash);

      const resetResult = await svc.findPasswordResetToken(sameHash);
      const verifyResult = await svc.findEmailVerifyToken(sameHash);

      expect(resetResult!.userId).toBe('user-reset');
      expect(verifyResult!.userId).toBe('user-verify');
    });
  });
});
