import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeyBuilder } from '../redis-key.builder';

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  /** Unix timestamp (seconds) when the window resets. */
  resetAt: number;
}

/**
 * RateLimiterService
 *
 * Implements two algorithms:
 *
 * 1. FIXED WINDOW (for API rate limits, tenant-scoped)
 *    - Buckets: per-hour window. Key expires automatically at window end.
 *    - Pros: O(1) space, O(1) time per check.
 *    - Cons: Burst at window boundary (up to 2× limit in the worst case).
 *    - Use for: subscription API limits (less sensitive to boundary bursts).
 *
 * 2. SLIDING WINDOW (for auth brute-force protection)
 *    - Sorted set: each attempt is scored by timestamp. Stale entries pruned
 *      on every check. Count = ZCARD after pruning.
 *    - Pros: No boundary burst. Accurate sliding count.
 *    - Cons: O(log N) space and time per attempt. Fine for auth (low volume).
 *    - Use for: login attempts, password reset, email verification.
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Use token bucket instead of sliding window — it smooths
 *   bursts better and is O(1)."
 *   Counter: Token bucket requires two Redis fields (tokens, last_refill) and
 *   an atomic Lua script to avoid race conditions. Sliding window with ZADD +
 *   ZRANGEBYSCORE is equally atomic and conceptually cleaner for auditing
 *   (every attempt is stored with its timestamp, enabling forensic review).
 *   Decision: Sliding window for auth (security-sensitive), fixed window for
 *   API limits (high-volume, less security-sensitive).
 *
 *   Challenger: "Fixed window has the burst problem. Use sliding window everywhere."
 *   Counter: Sliding window for API rate limits (potentially 10k req/day)
 *   means 10k sorted set entries per tenant per day. At 50 tenants × 100 requests
 *   that's 5M sorted set members. Fixed window uses a single INCR — 50 keys total.
 *   For subscription enforcement where ±10% burst is acceptable, fixed window wins.
 *
 * GRACEFUL DEGRADATION:
 *   When Redis is unavailable, rate limiting falls back to PASS-THROUGH.
 *   In production (REDIS_OPTIONAL=false), startup fails if Redis is down,
 *   so this fallback is only relevant in development.
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly keys: RedisKeyBuilder,
  ) {}

  // ---------------------------------------------------------------------------
  // Fixed window
  // ---------------------------------------------------------------------------

  /**
   * Check (and increment) a fixed-window rate limit.
   * The window is defined by `windowKey` (e.g. current hour from RedisKeyBuilder.currentHourWindow()).
   *
   * @param limitKey  Full Redis key (use RedisKeyBuilder methods to construct).
   * @param limit     Maximum allowed count per window.
   * @param windowSeconds  Window duration in seconds (used to set EXPIRE on first call).
   */
  async checkFixedWindow(limitKey: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    if (!this.redis.isAvailable) {
      return this.passThrough(limit);
    }

    // Atomic INCR + conditional EXPIRE using Lua to prevent race conditions
    const luaScript = `
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      local ttl = redis.call('TTL', KEYS[1])
      return {count, ttl}
    `;

    try {
      const result = (await this.redis.eval(luaScript, [limitKey], [String(windowSeconds)])) as [number, number];
      const count = result[0];
      const ttlSeconds = result[1] > 0 ? result[1] : windowSeconds;
      const resetAt = Math.floor(Date.now() / 1000) + ttlSeconds;

      return {
        allowed: count <= limit,
        count,
        limit,
        remaining: Math.max(0, limit - count),
        resetAt,
      };
    } catch (err) {
      this.logger.warn(`Fixed window rate limit check failed: ${(err as Error).message}`);
      return this.passThrough(limit);
    }
  }

  /**
   * Sliding window rate limit check using a sorted set.
   * Each call adds the current timestamp as both score and member.
   * Expired entries (outside the window) are pruned before counting.
   *
   * @param limitKey      Full Redis key.
   * @param limit         Maximum allowed count in window.
   * @param windowSeconds Window duration in seconds.
   */
  async checkSlidingWindow(limitKey: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    if (!this.redis.isAvailable) {
      return this.passThrough(limit);
    }

    // Atomic Lua script:
    //   1. Remove members older than windowSeconds
    //   2. Add current timestamp
    //   3. Set expiry on the key
    //   4. Count remaining members
    const luaScript = `
      local now = tonumber(ARGV[1])
      local window = tonumber(ARGV[2])
      local limit = tonumber(ARGV[3])
      local cutoff = now - window * 1000

      redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, cutoff)
      redis.call('ZADD', KEYS[1], now, tostring(now) .. '-' .. math.random(1000000))
      redis.call('EXPIRE', KEYS[1], window + 1)

      local count = redis.call('ZCARD', KEYS[1])
      return count
    `;

    try {
      const nowMs = Date.now();
      const count = (await this.redis.eval(
        luaScript,
        [limitKey],
        [String(nowMs), String(windowSeconds), String(limit)],
      )) as number;

      const resetAt = Math.floor(nowMs / 1000) + windowSeconds;

      return {
        allowed: count <= limit,
        count,
        limit,
        remaining: Math.max(0, limit - count),
        resetAt,
      };
    } catch (err) {
      this.logger.warn(`Sliding window rate limit check failed: ${(err as Error).message}`);
      return this.passThrough(limit);
    }
  }

  // ---------------------------------------------------------------------------
  // Domain-specific convenience methods
  // ---------------------------------------------------------------------------

  /**
   * Tenant API rate limit — fixed window per hour.
   * Uses the subscription plan's maxApiRequestsPerDay converted to per-hour.
   */
  async checkApiRateLimit(tenantId: string, limitPerDay: number): Promise<RateLimitResult> {
    const windowKey = RedisKeyBuilder.currentHourWindow();
    const key = this.keys.apiRateLimit(tenantId, windowKey);
    // Divide daily limit evenly across 24 hours (simple approximation)
    const hourlyLimit = Math.ceil(limitPerDay / 24);
    return this.checkFixedWindow(key, hourlyLimit, 3600);
  }

  /**
   * Login attempts by email — sliding window.
   * Used as a fast Redis-backed replacement for the DB-based LoginAttemptRepository.
   */
  async checkLoginAttempts(tenantId: string, email: string, windowSeconds: number): Promise<RateLimitResult> {
    const key = this.keys.loginAttempts(tenantId, email);
    return this.checkSlidingWindow(key, 999_999, windowSeconds); // count-only, caller decides threshold
  }

  /**
   * IP-based login rate limiting — sliding window across all tenants.
   */
  async checkIpLoginAttempts(ip: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const key = this.keys.loginIpAttempts(ip);
    return this.checkSlidingWindow(key, limit, windowSeconds);
  }

  /** Reset a rate limit key (used after successful login to clear brute-force counter). */
  async reset(limitKey: string): Promise<void> {
    await this.redis.del(limitKey);
  }

  /** Reset login attempts for an email (after successful login). */
  async resetLoginAttempts(tenantId: string, email: string): Promise<void> {
    await this.redis.del(this.keys.loginAttempts(tenantId, email));
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private passThrough(limit: number): RateLimitResult {
    return { allowed: true, count: 0, limit, remaining: limit, resetAt: 0 };
  }
}
