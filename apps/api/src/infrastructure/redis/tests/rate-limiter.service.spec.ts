import { RateLimiterService } from '../services/rate-limiter.service';
import { RedisKeyBuilder } from '../redis-key.builder';
import { MockRedisService } from './mock-redis.service';

function buildSvc() {
  const redis = new MockRedisService();
  const kb = new RedisKeyBuilder('app');
  const svc = new RateLimiterService(redis as any, kb);
  return { redis, svc, kb };
}

const TENANT = 'tenant-test';

describe('RateLimiterService', () => {
  describe('checkFixedWindow', () => {
    it('allows first request and returns count=1', async () => {
      const { svc, kb } = buildSvc();
      const key = kb.apiRateLimit(TENANT, RedisKeyBuilder.currentHourWindow());
      const result = await svc.checkFixedWindow(key, 10, 3600);
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(1);
      expect(result.remaining).toBe(9);
    });

    it('allows requests up to the limit', async () => {
      const { svc, kb } = buildSvc();
      const key = kb.apiRateLimit(TENANT, RedisKeyBuilder.currentHourWindow());
      for (let i = 0; i < 5; i++) {
        const r = await svc.checkFixedWindow(key, 5, 3600);
        expect(r.allowed).toBe(i < 5);
      }
    });

    it('denies when limit is exceeded', async () => {
      const { svc, kb } = buildSvc();
      const key = kb.apiRateLimit(TENANT, '2026-06-15T10');
      for (let i = 0; i < 5; i++) {
        await svc.checkFixedWindow(key, 5, 3600);
      }
      const result = await svc.checkFixedWindow(key, 5, 3600);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('passes through (allowed=true) when Redis is unavailable', async () => {
      const { svc, redis, kb } = buildSvc();
      redis.goOffline();
      const key = kb.apiRateLimit(TENANT, RedisKeyBuilder.currentHourWindow());
      const result = await svc.checkFixedWindow(key, 1, 3600);
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkSlidingWindow', () => {
    it('allows requests within the window', async () => {
      const { svc, kb } = buildSvc();
      const key = kb.loginAttempts(TENANT, 'user@test.com');
      const result = await svc.checkSlidingWindow(key, 5, 900);
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(1);
    });

    it('accumulates counts across calls', async () => {
      const { svc, kb } = buildSvc();
      const key = kb.loginAttempts(TENANT, 'user@test.com');
      for (let i = 0; i < 3; i++) {
        await svc.checkSlidingWindow(key, 5, 900);
      }
      const result = await svc.checkSlidingWindow(key, 5, 900);
      expect(result.count).toBe(4);
    });

    it('denies when limit is exceeded', async () => {
      const { svc, kb } = buildSvc();
      const key = kb.loginIpAttempts('192.168.1.1');
      for (let i = 0; i < 30; i++) {
        await svc.checkSlidingWindow(key, 30, 900);
      }
      const result = await svc.checkSlidingWindow(key, 30, 900);
      expect(result.allowed).toBe(false);
    });

    it('passes through when Redis is unavailable', async () => {
      const { svc, redis, kb } = buildSvc();
      redis.goOffline();
      const key = kb.loginAttempts(TENANT, 'user@test.com');
      const result = await svc.checkSlidingWindow(key, 1, 900);
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkApiRateLimit', () => {
    it('uses 1/24th of daily limit per hour', async () => {
      const { svc } = buildSvc();
      const result = await svc.checkApiRateLimit(TENANT, 1000);
      expect(result.limit).toBe(Math.ceil(1000 / 24));
      expect(result.allowed).toBe(true);
    });
  });

  describe('reset', () => {
    it('clears the rate limit counter', async () => {
      const { svc, kb } = buildSvc();
      const key = kb.loginAttempts(TENANT, 'user@test.com');
      for (let i = 0; i < 5; i++) {
        await svc.checkSlidingWindow(key, 5, 900);
      }
      await svc.reset(key);
      const result = await svc.checkSlidingWindow(key, 5, 900);
      expect(result.count).toBe(1);
      expect(result.allowed).toBe(true);
    });

    it('resetLoginAttempts clears email login counter', async () => {
      const { svc, kb } = buildSvc();
      const key = kb.loginAttempts(TENANT, 'alice@example.com');
      await svc.checkSlidingWindow(key, 5, 900);
      await svc.resetLoginAttempts(TENANT, 'alice@example.com');
      const result = await svc.checkSlidingWindow(key, 5, 900);
      expect(result.count).toBe(1);
    });
  });
});
