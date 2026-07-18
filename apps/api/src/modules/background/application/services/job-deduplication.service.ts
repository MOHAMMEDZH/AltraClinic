import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { RedisKeyBuilder } from '../../../../infrastructure/redis/redis-key.builder';

/**
 * Redis-backed idempotency for scheduled reminder/alert jobs.
 * Prevents duplicate notifications when cron and worker overlap.
 */
@Injectable()
export class JobDeduplicationService {
  constructor(
    private readonly redis: RedisService,
    private readonly keys: RedisKeyBuilder,
  ) {}

  /**
   * Returns true if this job bucket was already claimed (duplicate).
   * TTL defaults to 48h — long enough to cover timezone edge cases.
   */
  async isDuplicate(jobType: string, entityId: string, bucket: string): Promise<boolean> {
    if (!this.redis.isAvailable) return false;

    const key = this.keys.jobDedup(jobType, entityId, bucket);
    const claimed = await this.redis.setNx(key, '1', 48 * 3_600_000);
    return !claimed;
  }

  /** Test helper — reset dedup state. */
  async clear(jobType: string, entityId: string, bucket: string): Promise<void> {
    await this.redis.del(this.keys.jobDedup(jobType, entityId, bucket));
  }
}
