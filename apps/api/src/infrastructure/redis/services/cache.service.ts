import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeyBuilder } from '../redis-key.builder';

export interface CacheSetOptions {
  /** TTL in seconds. Required. */
  ttl: number;
  /**
   * Optional tag names for grouped invalidation.
   * The key will be registered under each tag's set so it can be
   * bulk-deleted via invalidateByTag(tag).
   */
  tags?: string[];
}

/**
 * CacheService
 *
 * Generic tenant-scoped caching with TTL and tag-based invalidation.
 *
 * INVALIDATION STRATEGY — Tag-based:
 *
 *   Every cached value can be associated with one or more "tags".
 *   A tag is stored as a Redis Set: cache:tags:{tag} → { key1, key2, ... }.
 *   When you invalidate a tag, all keys in that set are deleted atomically
 *   via a Lua script, then the tag set itself is deleted.
 *
 *   Common tags:
 *     - tenant:{tenantId}   → invalidate everything for a tenant
 *     - user:{userId}       → invalidate user-specific cache entries
 *     - plan:{tenantId}     → invalidate plan/subscription cache
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Tag-based invalidation is error-prone. Use cache versioning
 *   (increment a 'version' counter for the tenant; include version in every key)."
 *   Counter: Cache versioning requires a DB/Redis read to fetch the current version
 *   on every cache write AND read. Tag-based invalidation only requires extra work
 *   on writes (add to tag set). The Lua script guarantees atomicity. Error surface
 *   is similar — both require discipline to tag/version correctly.
 *   Decision: Tag-based gives finer granularity (invalidate plan cache without
 *   touching patient cache). Stick with tags.
 *
 *   Challenger: "Use Redis keyspace notifications to auto-expire tag entries."
 *   Counter: Keyspace notifications require server-side config (notify-keyspace-events)
 *   and add event-loop overhead. TTL on tag sets (2× the max item TTL) achieves
 *   self-cleanup without server config changes.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly keys: RedisKeyBuilder,
  ) {}

  // ---------------------------------------------------------------------------
  // Core operations
  // ---------------------------------------------------------------------------

  async get<T = unknown>(tenantId: string, category: string, id: string): Promise<T | null> {
    const key = this.keys.cache(tenantId, category, id);
    const raw = await this.redis.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn(`Cache deserialization failed for key ${key}`);
      return null;
    }
  }

  async set<T = unknown>(
    tenantId: string,
    category: string,
    id: string,
    value: T,
    options: CacheSetOptions,
  ): Promise<void> {
    const key = this.keys.cache(tenantId, category, id);
    const serialized = JSON.stringify(value);
    await this.redis.set(key, serialized, options.ttl);

    // Register key under the tenant tag (always)
    await this.registerTag(this.keys.cacheTagTenant(tenantId), key, options.ttl);

    // Register key under any extra tags
    if (options.tags?.length) {
      for (const tag of options.tags) {
        await this.registerTag(this.keys.cacheTag(tag), key, options.ttl);
      }
    }
  }

  async del(tenantId: string, category: string, id: string): Promise<void> {
    const key = this.keys.cache(tenantId, category, id);
    await this.redis.del(key);
  }

  /**
   * Get or compute a cached value (cache-aside pattern).
   * If the key is not in cache, calls `compute()`, stores the result, and returns it.
   */
  async getOrSet<T = unknown>(
    tenantId: string,
    category: string,
    id: string,
    compute: () => Promise<T>,
    options: CacheSetOptions,
  ): Promise<T> {
    const cached = await this.get<T>(tenantId, category, id);
    if (cached !== null) return cached;
    const value = await compute();
    await this.set(tenantId, category, id, value, options);
    return value;
  }

  // ---------------------------------------------------------------------------
  // Invalidation
  // ---------------------------------------------------------------------------

  /** Delete all cache keys tagged for this tenant. */
  async invalidateTenant(tenantId: string): Promise<void> {
    await this.invalidateTag(this.keys.cacheTagTenant(tenantId));
  }

  /** Delete all cache keys associated with a custom tag. */
  async invalidateByTag(tag: string): Promise<void> {
    await this.invalidateTag(this.keys.cacheTag(tag));
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Adds `key` to the tag set and sets the tag set TTL to 2× the item TTL.
   * This prevents stale tag entries from accumulating after items expire.
   */
  private async registerTag(tagKey: string, itemKey: string, itemTtl: number): Promise<void> {
    await this.redis.sadd(tagKey, itemKey);
    await this.redis.expire(tagKey, itemTtl * 2);
  }

  /**
   * Atomically fetches all keys under a tag and deletes them + the tag set.
   *
   * Lua script guarantees no keys are added between SMEMBERS and DEL.
   *
   * COMPETING ARCHITECT:
   *   Challenger: "SMEMBERS + DEL is O(N) — slow for large tag sets."
   *   Counter: For SaaS tenants, cache key counts per tenant rarely exceed
   *   hundreds. At that scale, O(N) Lua is faster than multi-round-trip SCAN.
   *   Phase 2: Add a SCAN-based batch invalidation for tag sets > 1000 keys.
   */
  private async invalidateTag(tagKey: string): Promise<void> {
    const luaScript = `
      local keys = redis.call('SMEMBERS', KEYS[1])
      if #keys > 0 then
        redis.call('DEL', unpack(keys))
      end
      redis.call('DEL', KEYS[1])
      return #keys
    `;
    try {
      const deleted = await this.redis.eval(luaScript, [tagKey], []);
      this.logger.debug(`invalidateTag(${tagKey}): deleted ${deleted} keys`);
    } catch (err) {
      this.logger.warn(`invalidateTag(${tagKey}) failed: ${(err as Error).message}`);
    }
  }
}
