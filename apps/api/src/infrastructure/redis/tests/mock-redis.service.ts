/**
 * MockRedisService
 *
 * In-process Redis simulation for unit and integration tests.
 * Implements the same interface as RedisService without a real Redis connection.
 *
 * Supports: get/set/del/exists/expire/ttl/incr/zadd/zremrangebyscore/zcard/
 *           sadd/smembers/srem/llen/hset/hget/hgetall/setNx/eval(subset).
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Use ioredis-mock instead of rolling your own."
 *   Counter: ioredis-mock hasn't been maintained recently and may not match
 *   our ioredis version. Our mock covers exactly the operations used by our
 *   services, making tests more predictable and the mock simpler to maintain.
 *   Decision: Custom mock.
 */
export class MockRedisService {
  private store = new Map<string, { value: string; expiresAt?: number }>();
  private sets = new Map<string, Set<string>>();
  private zsets = new Map<string, Map<string, number>>(); // member → score
  private hashes = new Map<string, Map<string, string>>();
  available = true;

  get isAvailable(): boolean {
    return this.available;
  }

  private isExpired(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return true;
    }
    return false;
  }

  async get(key: string): Promise<string | null> {
    if (!this.available) return null;
    if (this.isExpired(key)) return null;
    return this.store.get(key)?.value ?? null;
  }

  async set(key: string, value: string, exSeconds?: number): Promise<void> {
    if (!this.available) return;
    this.store.set(key, {
      value,
      expiresAt: exSeconds !== undefined ? Date.now() + exSeconds * 1000 : undefined,
    });
  }

  async setNx(key: string, value: string, ttlMs: number): Promise<boolean> {
    if (!this.available) return false;
    if (this.isExpired(key) || !this.store.has(key)) {
      this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
      return true;
    }
    return false;
  }

  async del(...keys: string[]): Promise<number> {
    if (!this.available) return 0;
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key) || this.sets.delete(key) ||
          this.zsets.delete(key) || this.hashes.delete(key)) {
        count++;
      }
    }
    return count;
  }

  async exists(...keys: string[]): Promise<number> {
    if (!this.available) return 0;
    return keys.filter((k) => {
      if (this.isExpired(k)) return false;
      return this.store.has(k) || this.sets.has(k) || this.zsets.has(k) || this.hashes.has(k);
    }).length;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.available) return 0;
    const entry = this.store.get(key);
    if (entry) {
      entry.expiresAt = Date.now() + seconds * 1000;
      return 1;
    }
    const set = this.sets.get(key);
    if (set) {
      return 1; // simplified: we don't expire sets in mock
    }
    return 0;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return -2;
    if (entry.expiresAt === undefined) return -1;
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async incr(key: string): Promise<number> {
    if (!this.available) return 0;
    const current = parseInt((this.store.get(key)?.value) ?? '0', 10);
    const next = current + 1;
    const entry = this.store.get(key);
    this.store.set(key, { value: String(next), expiresAt: entry?.expiresAt });
    return next;
  }

  async incrby(key: string, increment: number): Promise<number> {
    const current = parseInt((await this.get(key)) ?? '0', 10);
    const next = current + increment;
    const entry = this.store.get(key);
    this.store.set(key, { value: String(next), expiresAt: entry?.expiresAt });
    return next;
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.zsets.has(key)) this.zsets.set(key, new Map());
    const isNew = !this.zsets.get(key)!.has(member);
    this.zsets.get(key)!.set(member, score);
    return isNew ? 1 : 0;
  }

  async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number> {
    const zset = this.zsets.get(key);
    if (!zset) return 0;
    const minN = min === '-inf' ? -Infinity : Number(min);
    const maxN = max === '+inf' ? Infinity : Number(max);
    let removed = 0;
    for (const [member, score] of zset) {
      if (score >= minN && score <= maxN) {
        zset.delete(member);
        removed++;
      }
    }
    return removed;
  }

  async zcard(key: string): Promise<number> {
    return this.zsets.get(key)?.size ?? 0;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.available) return 0;
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    let added = 0;
    for (const m of members) {
      if (!this.sets.get(key)!.has(m)) {
        this.sets.get(key)!.add(m);
        added++;
      }
    }
    return added;
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.available) return [];
    return Array.from(this.sets.get(key) ?? []);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (!this.available) return 0;
    const set = this.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const m of members) {
      if (set.delete(m)) removed++;
    }
    return removed;
  }

  async llen(key: string): Promise<number> {
    if (!this.available) return 0;
    return this.lists.get(key)?.length ?? 0;
  }

  private lists = new Map<string, string[]>();

  async lpush(key: string, ...values: string[]): Promise<number> {
    if (!this.available) return 0;
    if (!this.lists.has(key)) this.lists.set(key, []);
    const list = this.lists.get(key)!;
    list.unshift(...values);
    return list.length;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.available) return [];
    const list = this.lists.get(key) ?? [];
    const end = stop < 0 ? list.length + stop + 1 : stop + 1;
    return list.slice(start, end);
  }

  async ltrim(key: string, start: number, stop: number): Promise<string> {
    if (!this.available) return 'OK';
    const list = this.lists.get(key) ?? [];
    const end = stop < 0 ? list.length + stop + 1 : stop + 1;
    this.lists.set(key, list.slice(start, end));
    return 'OK';
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    const isNew = !this.hashes.get(key)!.has(field);
    this.hashes.get(key)!.set(field, value);
    return isNew ? 1 : 0;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const h = this.hashes.get(key);
    if (!h) return {};
    return Object.fromEntries(h);
  }

  /**
   * Simplified eval: executes only the Lua patterns we use in our services.
   * Order matters: more specific patterns must be checked before general ones.
   */
  async eval(script: string, keys: string[], args: string[]): Promise<unknown> {
    // Queue metrics: DECR + INCR (checked before generic INCR+EXPIRE)
    if (script.includes('DECR') && script.includes('INCR')) {
      const depthKey = keys[0];
      const counterKey = keys[1];
      const depth = parseInt((await this.get(depthKey)) ?? '0', 10);
      if (depth > 0) {
        this.store.set(depthKey, { value: String(depth - 1) });
      }
      return await this.incr(counterKey);
    }

    // Sliding window rate limit (ZREMRANGEBYSCORE + ZADD + EXPIRE + ZCARD)
    if (script.includes('ZREMRANGEBYSCORE') && script.includes('ZADD')) {
      const key = keys[0];
      const nowMs = parseInt(args[0], 10);
      const windowSec = parseInt(args[1], 10);
      await this.zremrangebyscore(key, 0, nowMs - windowSec * 1000);
      await this.zadd(key, nowMs, `${nowMs}-${Math.random()}`);
      return await this.zcard(key);
    }

    // Tag invalidation: SMEMBERS + DEL (CacheService)
    if (script.includes('SMEMBERS') && script.includes('DEL')) {
      const tagKey = keys[0];
      const members = await this.smembers(tagKey);
      if (members.length > 0) await this.del(...members);
      await this.del(tagKey);
      return members.length;
    }

    // Distributed lock release: GET + conditional DEL
    if (script.includes("redis.call('GET'") && script.includes("redis.call('DEL'")) {
      const lockKey = keys[0];
      const token = args[0];
      const stored = await this.get(lockKey);
      if (stored === token) {
        await this.del(lockKey);
        return 1;
      }
      return 0;
    }

    // Generic INCR with conditional EXPIRE (fixed window + incrWithExpire)
    if (script.includes("redis.call('INCR'") && script.includes("redis.call('EXPIRE'")) {
      const key = keys[0];
      const count = await this.incr(key);
      if (count === 1) await this.expire(key, parseInt(args[0], 10));
      const ttl = await this.ttl(key);
      return [count, ttl];
    }

    return null;
  }

  /** Utility: flush all data (call between tests). */
  flush(): void {
    this.store.clear();
    this.sets.clear();
    this.zsets.clear();
    this.hashes.clear();
    this.lists.clear();
  }

  /** Simulate Redis going offline. */
  goOffline(): void { this.available = false; }
  goOnline(): void { this.available = true; }
}
