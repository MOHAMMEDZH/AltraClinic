import { CacheService } from '../services/cache.service';
import { RedisKeyBuilder } from '../redis-key.builder';
import { MockRedisService } from './mock-redis.service';

const TENANT = 'tenant-abc';

function buildSvc() {
  const redis = new MockRedisService();
  const kb = new RedisKeyBuilder('app');
  const svc = new CacheService(redis as any, kb);
  return { redis, svc, kb };
}

describe('CacheService', () => {
  describe('get / set', () => {
    it('returns null for a cache miss', async () => {
      const { svc } = buildSvc();
      const result = await svc.get(TENANT, 'plan', 'active');
      expect(result).toBeNull();
    });

    it('stores and retrieves a cached value', async () => {
      const { svc } = buildSvc();
      await svc.set(TENANT, 'plan', 'active', { planName: 'pro' }, { ttl: 300 });
      const result = await svc.get<{ planName: string }>(TENANT, 'plan', 'active');
      expect(result).not.toBeNull();
      expect(result!.planName).toBe('pro');
    });

    it('returns null when Redis is unavailable', async () => {
      const { svc, redis } = buildSvc();
      redis.goOffline();
      await svc.set(TENANT, 'plan', 'active', { planName: 'pro' }, { ttl: 300 });
      const result = await svc.get(TENANT, 'plan', 'active');
      expect(result).toBeNull();
    });
  });

  describe('del', () => {
    it('removes a cached entry', async () => {
      const { svc } = buildSvc();
      await svc.set(TENANT, 'plan', 'active', { planName: 'lite' }, { ttl: 300 });
      await svc.del(TENANT, 'plan', 'active');
      const result = await svc.get(TENANT, 'plan', 'active');
      expect(result).toBeNull();
    });
  });

  describe('getOrSet', () => {
    it('calls compute on cache miss and stores result', async () => {
      const { svc } = buildSvc();
      const compute = jest.fn().mockResolvedValue({ planName: 'enterprise' });
      const result = await svc.getOrSet(TENANT, 'plan', 'active', compute, { ttl: 300 });
      expect(result).toEqual({ planName: 'enterprise' });
      expect(compute).toHaveBeenCalledTimes(1);
    });

    it('returns cached value on subsequent calls without invoking compute', async () => {
      const { svc } = buildSvc();
      const compute = jest.fn().mockResolvedValue({ planName: 'enterprise' });
      await svc.getOrSet(TENANT, 'plan', 'active', compute, { ttl: 300 });
      await svc.getOrSet(TENANT, 'plan', 'active', compute, { ttl: 300 });
      expect(compute).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidateTenant', () => {
    it('deletes all cache keys for a tenant', async () => {
      const { svc } = buildSvc();
      await svc.set(TENANT, 'plan', 'active', { planName: 'pro' }, { ttl: 300 });
      await svc.set(TENANT, 'user', 'user-1', { name: 'Alice' }, { ttl: 300 });
      await svc.invalidateTenant(TENANT);
      expect(await svc.get(TENANT, 'plan', 'active')).toBeNull();
      expect(await svc.get(TENANT, 'user', 'user-1')).toBeNull();
    });

    it('does not affect a different tenant\'s cache', async () => {
      const { svc } = buildSvc();
      await svc.set('tenant-a', 'plan', 'active', { planName: 'pro' }, { ttl: 300 });
      await svc.set('tenant-b', 'plan', 'active', { planName: 'lite' }, { ttl: 300 });
      await svc.invalidateTenant('tenant-a');
      expect(await svc.get('tenant-a', 'plan', 'active')).toBeNull();
      expect(await svc.get<{ planName: string }>('tenant-b', 'plan', 'active')).toEqual({ planName: 'lite' });
    });
  });

  describe('invalidateByTag', () => {
    it('removes all keys tagged with a custom tag', async () => {
      const { svc } = buildSvc();
      await svc.set(TENANT, 'plan', 'active', { plan: 'pro' }, { ttl: 300, tags: ['subscription'] });
      await svc.set(TENANT, 'plan', 'trial', { plan: 'lite' }, { ttl: 300, tags: ['subscription'] });
      await svc.invalidateByTag('subscription');
      expect(await svc.get(TENANT, 'plan', 'active')).toBeNull();
      expect(await svc.get(TENANT, 'plan', 'trial')).toBeNull();
    });
  });
});
