import { DistributedLockService, LockNotAcquiredException } from '../services/distributed-lock.service';
import { RedisKeyBuilder } from '../redis-key.builder';
import { MockRedisService } from './mock-redis.service';

const TENANT = 'tenant-abc';

function buildSvc() {
  const redis = new MockRedisService();
  const kb = new RedisKeyBuilder('app');
  const svc = new DistributedLockService(redis as any, kb);
  return { redis, svc };
}

describe('DistributedLockService', () => {
  describe('acquire', () => {
    it('returns a token on first acquisition', async () => {
      const { svc } = buildSvc();
      const token = await svc.acquire(TENANT, 'subscription', 'create', 5000);
      expect(token).not.toBeNull();
      expect(typeof token).toBe('string');
    });

    it('returns null when lock is already held', async () => {
      const { svc } = buildSvc();
      await svc.acquire(TENANT, 'subscription', 'create', 60000);
      const second = await svc.acquire(TENANT, 'subscription', 'create', 60000);
      expect(second).toBeNull();
    });

    it('returns a token when Redis is unavailable (graceful degradation)', async () => {
      const { svc, redis } = buildSvc();
      redis.goOffline();
      const token = await svc.acquire(TENANT, 'subscription', 'create');
      expect(token).not.toBeNull(); // passes through
    });
  });

  describe('release', () => {
    it('releases a lock successfully', async () => {
      const { svc } = buildSvc();
      const token = await svc.acquire(TENANT, 'subscription', 'create', 5000);
      const released = await svc.release(TENANT, 'subscription', 'create', token!);
      expect(released).toBe(true);
    });

    it('does not release lock owned by another holder', async () => {
      const { svc } = buildSvc();
      await svc.acquire(TENANT, 'subscription', 'create', 60000);
      const released = await svc.release(TENANT, 'subscription', 'create', 'wrong-token');
      expect(released).toBe(false);
    });

    it('after release, lock can be acquired again', async () => {
      const { svc } = buildSvc();
      const token = await svc.acquire(TENANT, 'subscription', 'create', 5000);
      await svc.release(TENANT, 'subscription', 'create', token!);
      const token2 = await svc.acquire(TENANT, 'subscription', 'create', 5000);
      expect(token2).not.toBeNull();
    });
  });

  describe('withLock', () => {
    it('executes the function while holding the lock', async () => {
      const { svc } = buildSvc();
      const result = await svc.withLock(TENANT, 'subscription', 'create_user', async () => {
        return 'success';
      });
      expect(result).toBe('success');
    });

    it('releases the lock even if the function throws', async () => {
      const { svc } = buildSvc();
      await expect(
        svc.withLock(TENANT, 'subscription', 'create_patient', async () => {
          throw new Error('domain error');
        }),
      ).rejects.toThrow('domain error');

      // Lock should be released — can be acquired again
      const token = await svc.acquire(TENANT, 'subscription', 'create_patient');
      expect(token).not.toBeNull();
    });

    it('throws LockNotAcquiredException when lock cannot be acquired', async () => {
      const { svc } = buildSvc();
      // Hold the lock manually
      await svc.acquire(TENANT, 'subscription', 'create', 60000);

      await expect(
        svc.withLock(
          TENANT,
          'subscription',
          'create',
          async () => 'should not run',
          { ttlMs: 100, retries: 0 },
        ),
      ).rejects.toThrow(LockNotAcquiredException);
    });

    it('retries lock acquisition before failing', async () => {
      const { svc } = buildSvc();
      // Hold the lock, then release it after 50ms
      const token = await svc.acquire(TENANT, 'subscription', 'create', 60000);
      setTimeout(() => {
        svc.release(TENANT, 'subscription', 'create', token!);
      }, 50);

      // withLock with 3 retries at 30ms each — should succeed after release
      const result = await svc.withLock(
        TENANT,
        'subscription',
        'create',
        async () => 'acquired after retry',
        { ttlMs: 5000, retries: 5, retryMs: 30 },
      );
      expect(result).toBe('acquired after retry');
    }, 2000);
  });
});
