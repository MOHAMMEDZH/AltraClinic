import { JobDeduplicationService } from '../application/services/job-deduplication.service';
import { MockRedisService } from '../../../infrastructure/redis/tests/mock-redis.service';
import { RedisKeyBuilder } from '../../../infrastructure/redis/redis-key.builder';

function buildDedup() {
  const redis = new MockRedisService();
  const keys = new RedisKeyBuilder('app');
  const svc = new JobDeduplicationService(redis as any, keys);
  return { redis, svc };
}

describe('JobDeduplicationService', () => {
  it('allows first claim and rejects duplicates', async () => {
    const { svc } = buildDedup();
    expect(await svc.isDuplicate('reminder', 'sub-1', '30d')).toBe(false);
    expect(await svc.isDuplicate('reminder', 'sub-1', '30d')).toBe(true);
  });

  it('treats different buckets as independent', async () => {
    const { svc } = buildDedup();
    expect(await svc.isDuplicate('reminder', 'sub-1', '30d')).toBe(false);
    expect(await svc.isDuplicate('reminder', 'sub-1', '7d')).toBe(false);
  });

  it('allows retry when Redis unavailable', async () => {
    const { redis, svc } = buildDedup();
    redis.available = false;
    expect(await svc.isDuplicate('reminder', 'sub-1', '30d')).toBe(false);
  });
});
