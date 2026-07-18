import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../redis.service';
import { RedisKeyBuilder } from '../redis-key.builder';

export class LockNotAcquiredException extends Error {
  constructor(public readonly lockKey: string) {
    super(`Could not acquire distributed lock: ${lockKey}`);
    this.name = 'LockNotAcquiredException';
  }
}

/**
 * DistributedLockService
 *
 * Prevents race conditions on shared resources across multiple app instances.
 *
 * ALGORITHM — SET NX (single-node):
 *   SET key token NX PX ttl
 *   - NX: only set if Not eXists
 *   - PX: TTL in milliseconds (auto-release even if the lock holder crashes)
 *   - token: a unique value per lock acquisition, used to verify ownership on release
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Use Redlock (multi-node consensus) instead of SET NX."
 *   Counter: Redlock requires N independent Redis instances (typically 5).
 *   We are on single-node Redis. Redlock on a single node is mathematically
 *   equivalent to SET NX but adds library overhead and complexity.
 *   When we move to Redis Cluster (Phase 2), we will replace this with
 *   Redlock using the `redlock` npm package against N master nodes.
 *   Decision: SET NX now, Redlock in Phase 2. The abstraction layer here
 *   (withLock, acquire, release) makes the swap transparent to callers.
 *
 *   Challenger: "Fencing tokens (monotonic counters) are needed for true
 *   distributed lock safety against clock skew."
 *   Counter: Fencing tokens require storage middleware support. Our use cases
 *   (subscription limit TOCTOU, token generation) do not involve external
 *   storage writes that need fencing. If they did, we'd add fencing.
 *   Decision: Not needed for current use cases. Documented as a known limitation.
 *
 * USE CASES:
 *   - Subscription limit enforcement (prevent TOCTOU: two simultaneous creates
 *     both passing the count check before either commits).
 *   - Token generation (ensure one password-reset token per user at a time).
 *   - Outbox processing (prevent duplicate event delivery).
 */
@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly keys: RedisKeyBuilder,
  ) {}

  /**
   * Try to acquire a lock. Returns a lockToken string if acquired, null if not.
   *
   * @param tenantId  Tenant namespace for the lock.
   * @param resource  Domain resource being locked (e.g. 'subscription').
   * @param action    Specific action (e.g. 'create_user').
   * @param ttlMs     Lock TTL in milliseconds. Auto-released after this duration.
   */
  async acquire(
    tenantId: string,
    resource: string,
    action: string,
    ttlMs: number = 5000,
  ): Promise<string | null> {
    if (!this.redis.isAvailable) {
      // When Redis is down, we cannot guarantee lock safety.
      // Return a dummy token so callers can proceed (acceptable in dev; never in prod).
      this.logger.warn(`DistributedLock: Redis unavailable, proceeding without lock for ${resource}:${action}`);
      return `no-redis-${randomUUID()}`;
    }

    const lockKey = this.keys.lock(tenantId, resource, action);
    const token = randomUUID();
    const acquired = await this.redis.setNx(lockKey, token, ttlMs);

    if (acquired) {
      this.logger.debug(`Lock acquired: ${lockKey} (ttl=${ttlMs}ms)`);
      return token;
    }

    return null;
  }

  /**
   * Release a lock. Only releases if the calling instance owns the lock (token matches).
   * Uses a Lua script to guarantee atomic check-and-delete.
   *
   * Returns true if the lock was released, false if it was already expired or owned by someone else.
   */
  async release(
    tenantId: string,
    resource: string,
    action: string,
    lockToken: string,
  ): Promise<boolean> {
    if (!this.redis.isAvailable) return true;

    const lockKey = this.keys.lock(tenantId, resource, action);

    // Atomic: only delete the key if its value matches our token
    const luaScript = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = (await this.redis.eval(luaScript, [lockKey], [lockToken])) as number;
      const released = result === 1;
      if (released) {
        this.logger.debug(`Lock released: ${lockKey}`);
      } else {
        this.logger.warn(`Lock release failed (expired or stolen): ${lockKey}`);
      }
      return released;
    } catch (err) {
      this.logger.error(`Lock release error for ${lockKey}: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Execute a function with an exclusive lock.
   * Acquires the lock, runs `fn`, then releases regardless of outcome.
   *
   * @param retries   Number of times to retry lock acquisition (default: 0).
   * @param retryMs   Wait between retries in ms (default: 100).
   *
   * @throws LockNotAcquiredException if the lock cannot be acquired after all retries.
   */
  async withLock<T>(
    tenantId: string,
    resource: string,
    action: string,
    fn: () => Promise<T>,
    options: { ttlMs?: number; retries?: number; retryMs?: number } = {},
  ): Promise<T> {
    const { ttlMs = 5000, retries = 2, retryMs = 100 } = options;
    const lockKey = this.keys.lock(tenantId, resource, action);

    let token: string | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      token = await this.acquire(tenantId, resource, action, ttlMs);
      if (token) break;
      if (attempt < retries) {
        await sleep(retryMs);
      }
    }

    if (!token) {
      throw new LockNotAcquiredException(lockKey);
    }

    try {
      return await fn();
    } finally {
      await this.release(tenantId, resource, action, token);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
