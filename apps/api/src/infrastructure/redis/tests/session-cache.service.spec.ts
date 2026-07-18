import { SessionCacheService, SessionPayload } from '../services/session-cache.service';
import { RedisKeyBuilder } from '../redis-key.builder';
import { MockRedisService } from './mock-redis.service';

const TENANT = 'tenant-abc';
const USER_ID = 'user-123';
const SESSION_ID = 'session-xyz';

const PAYLOAD: SessionPayload = {
  userId: USER_ID,
  tenantId: TENANT,
  branchId: null,
  roles: ['doctor'],
};

function buildSvc() {
  const redis = new MockRedisService();
  const kb = new RedisKeyBuilder('app');
  const svc = new SessionCacheService(redis as any, kb);
  return { redis, svc };
}

describe('SessionCacheService', () => {
  describe('cacheSession / getSession', () => {
    it('stores and retrieves a session', async () => {
      const { svc } = buildSvc();
      await svc.cacheSession(PAYLOAD, SESSION_ID, 900);
      const result = await svc.getSession(TENANT, SESSION_ID);
      expect(result).not.toBeNull();
      expect(result!.userId).toBe(USER_ID);
      expect(result!.roles).toEqual(['doctor']);
    });

    it('returns null on cache miss', async () => {
      const { svc } = buildSvc();
      const result = await svc.getSession(TENANT, 'nonexistent-session');
      expect(result).toBeNull();
    });

    it('returns null when Redis is unavailable', async () => {
      const { svc, redis } = buildSvc();
      redis.goOffline();
      const result = await svc.getSession(TENANT, SESSION_ID);
      expect(result).toBeNull();
    });

    it('does not throw when caching with Redis offline', async () => {
      const { svc, redis } = buildSvc();
      redis.goOffline();
      await expect(svc.cacheSession(PAYLOAD, SESSION_ID, 900)).resolves.not.toThrow();
    });
  });

  describe('invalidateSession', () => {
    it('removes the session from cache', async () => {
      const { svc } = buildSvc();
      await svc.cacheSession(PAYLOAD, SESSION_ID, 900);
      await svc.invalidateSession(TENANT, SESSION_ID, USER_ID);
      const result = await svc.getSession(TENANT, SESSION_ID);
      expect(result).toBeNull();
    });

    it('does nothing when session does not exist', async () => {
      const { svc } = buildSvc();
      await expect(svc.invalidateSession(TENANT, 'ghost-session')).resolves.not.toThrow();
    });
  });

  describe('invalidateUserSessions', () => {
    it('removes all sessions for a user', async () => {
      const { svc } = buildSvc();
      await svc.cacheSession(PAYLOAD, 'sess-1', 900);
      await svc.cacheSession(PAYLOAD, 'sess-2', 900);
      await svc.cacheSession(PAYLOAD, 'sess-3', 900);
      await svc.invalidateUserSessions(TENANT, USER_ID);
      expect(await svc.getSession(TENANT, 'sess-1')).toBeNull();
      expect(await svc.getSession(TENANT, 'sess-2')).toBeNull();
      expect(await svc.getSession(TENANT, 'sess-3')).toBeNull();
    });

    it('does not affect other users\' sessions', async () => {
      const { svc } = buildSvc();
      const other: SessionPayload = { ...PAYLOAD, userId: 'user-other' };
      await svc.cacheSession(PAYLOAD, 'sess-mine', 900);
      await svc.cacheSession(other, 'sess-other', 900);
      await svc.invalidateUserSessions(TENANT, USER_ID);
      // Own sessions gone
      expect(await svc.getSession(TENANT, 'sess-mine')).toBeNull();
      // Other user's session still present
      expect(await svc.getSession(TENANT, 'sess-other')).not.toBeNull();
    });
  });

  describe('JTI blacklisting', () => {
    it('blacklists a JTI and detects it', async () => {
      const { svc } = buildSvc();
      await svc.blacklistJti('jti-abc', 900);
      expect(await svc.isJtiBlacklisted('jti-abc')).toBe(true);
    });

    it('non-blacklisted JTI returns false', async () => {
      const { svc } = buildSvc();
      expect(await svc.isJtiBlacklisted('jti-clean')).toBe(false);
    });

    it('returns false when Redis is offline (graceful degradation)', async () => {
      const { svc, redis } = buildSvc();
      redis.goOffline();
      expect(await svc.isJtiBlacklisted('jti-whatever')).toBe(false);
    });
  });
});
