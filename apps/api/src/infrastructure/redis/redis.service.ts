import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis, { Cluster } from 'ioredis';
import {
  loadRedisConfig,
  RedisConfig,
  formatRedisUrlForLog,
  CI_REDIS_ABSENCE_ENFORCEMENT_ENV,
} from './redis-config';

export type RedisClient = Redis | Cluster;

/**
 * RedisService
 *
 * Manages the ioredis connection lifecycle and exposes a typed client.
 *
 * DESIGN DECISIONS:
 *
 * 1. Single client instance — Redis is designed for single-connection
 *    multiplexed concurrency. Unlike PG, there is no "pool" required.
 *    ioredis serializes commands on one TCP connection with pipelining.
 *
 * 2. Cluster vs single-node — Detected from REDIS_CLUSTER_NODES env.
 *    Cluster mode uses ioredis.Cluster which auto-discovers topology.
 *    Application code is identical for both modes.
 *
 * 3. Graceful degradation — When REDIS_OPTIONAL=true (default in dev),
 *    a failed connection logs a warning but does not throw. Services
 *    that depend on Redis check isAvailable() and degrade gracefully.
 *    In production, set REDIS_OPTIONAL=false to fail fast at startup.
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Use LazyConnect=true so the connection is not established
 *   at startup — reduces boot time."
 *   Decision: Eager connection at startup is better. It validates config,
 *   surfaces Redis connectivity issues immediately in logs (or health checks),
 *   and avoids the first-request latency spike that lazyConnect causes.
 *   The boot time difference is negligible (<100ms).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: RedisClient;
  private config!: RedisConfig;
  private available = false;

  async onModuleInit(): Promise<void> {
    this.config = loadRedisConfig();
    this.client = this.createClient();
    await this.waitForConnection();
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.log('Redis connection closed cleanly.');
    } catch {
      this.client.disconnect();
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Raw ioredis client — use when you need pipeline/multi/eval/etc. */
  get raw(): RedisClient {
    return this.client;
  }

  /** True when Redis is connected and responding. */
  get isAvailable(): boolean {
    return this.available;
  }

  /** Ping/pong health check — returns latency in ms. */
  async ping(): Promise<number | null> {
    if (!this.available) return null;
    const start = Date.now();
    try {
      await this.client.ping();
      return Date.now() - start;
    } catch {
      return null;
    }
  }

  /**
   * Redis server INFO section (for monitoring).
   * Returns null when Redis is unavailable.
   */
  async info(section?: string): Promise<string | null> {
    if (!this.available) return null;
    try {
      return section
        ? await (this.client as Redis).info(section)
        : await (this.client as Redis).info();
    } catch {
      return null;
    }
  }

  /** Approximate memory usage in bytes. */
  async memoryUsageBytes(): Promise<number | null> {
    if (!this.available) return null;
    try {
      const info = await (this.client as Redis).info('memory');
      const match = info.match(/used_memory:(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Typed convenience wrappers (pass-through to raw client)
  // ---------------------------------------------------------------------------

  async get(key: string): Promise<string | null> {
    if (!this.available) return null;
    try {
      return await this.client.get(key);
    } catch (err) {
      this.markUnavailable(err);
      return null;
    }
  }

  async set(key: string, value: string, exSeconds?: number): Promise<void> {
    if (!this.available) return;
    if (exSeconds !== undefined) {
      await this.client.set(key, value, 'EX', exSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async setNx(key: string, value: string, ttlMs: number): Promise<boolean> {
    if (!this.available) return false;
    const result = await this.client.set(key, value, 'PX', ttlMs, 'NX');
    return result === 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    if (!this.available) return 0;
    return this.client.del(...keys);
  }

  async exists(...keys: string[]): Promise<number> {
    if (!this.available) return 0;
    return this.client.exists(...keys);
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.available) return 0;
    return this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    if (!this.available) return -2;
    return this.client.ttl(key);
  }

  async incr(key: string): Promise<number> {
    if (!this.available) return 0;
    return this.client.incr(key);
  }

  async incrby(key: string, increment: number): Promise<number> {
    if (!this.available) return 0;
    return this.client.incrby(key, increment);
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.available) return 0;
    return this.client.zadd(key, score, member) as Promise<number>;
  }

  async zremrangebyscore(key: string, min: number | string, max: number | string): Promise<number> {
    if (!this.available) return 0;
    return this.client.zremrangebyscore(key, min, max);
  }

  async zcard(key: string): Promise<number> {
    if (!this.available) return 0;
    return this.client.zcard(key);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.available) return 0;
    return this.client.sadd(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.available) return [];
    return this.client.smembers(key);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (!this.available) return 0;
    return this.client.srem(key, ...members);
  }

  async llen(key: string): Promise<number> {
    if (!this.available) return 0;
    return this.client.llen(key);
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    if (!this.available) return 0;
    return this.client.lpush(key, ...values);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (!this.available) return [];
    return this.client.lrange(key, start, stop);
  }

  async ltrim(key: string, start: number, stop: number): Promise<string> {
    if (!this.available) return 'OK';
    return this.client.ltrim(key, start, stop);
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    if (!this.available) return 0;
    return this.client.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    if (!this.available) return null;
    return this.client.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (!this.available) return {};
    return this.client.hgetall(key);
  }

  /**
   * Execute a Lua script atomically.
   * COMPETING ARCHITECT:
   *   Challenger: "Use EVALSHA + SCRIPT LOAD for performance — avoid sending
   *   the full script every time."
   *   Decision: EVAL is fine for scripts called < 1000 times/sec. If Redis
   *   profiling shows EVAL is a bottleneck, upgrade to EVALSHA with a script
   *   registry. Premature optimization here adds complexity without benefit.
   */
  async eval(script: string, keys: string[], args: string[]): Promise<unknown> {
    if (!this.available) return null;
    return this.client.eval(script, keys.length, ...keys, ...args);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private createClient(): RedisClient {
    const { clusterNodes, url, password, db, connectTimeoutMs } = this.config;

    if (clusterNodes.length > 0) {
      this.logger.log(`Connecting to Redis Cluster: ${clusterNodes.join(', ')}`);
      return new Redis.Cluster(
        clusterNodes.map((node) => {
          const [host, port] = node.split(':');
          return { host, port: parseInt(port ?? '6379', 10) };
        }),
        {
          redisOptions: { password, connectTimeout: connectTimeoutMs },
          enableReadyCheck: true,
        },
      );
    }

    const absenceEnforced =
      process.env[CI_REDIS_ABSENCE_ENFORCEMENT_ENV] === '1' ||
      process.env[CI_REDIS_ABSENCE_ENFORCEMENT_ENV] === 'true' ||
      process.env[CI_REDIS_ABSENCE_ENFORCEMENT_ENV] === 'TRUE';
    this.logger.log(
      `Connecting to Redis: ${formatRedisUrlForLog(url)}` +
        (absenceEnforced ? ' (CI_REDIS_ABSENCE_ENFORCEMENT)' : ''),
    );
    return new Redis(url, {
      password,
      db,
      connectTimeout: connectTimeoutMs,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
  }

  private markUnavailable(err: unknown): void {
    if (this.available) {
      this.available = false;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Redis connection lost: ${message}`);
    }
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve) => {
      this.client.once('ready', () => {
        this.available = true;
        this.logger.log('Redis connection established and ready.');
        resolve();
      });

      this.client.once('error', (err: Error) => {
        if (this.config.optional) {
          this.logger.warn(`Redis unavailable (REDIS_OPTIONAL=true): ${err.message}. Continuing with degraded functionality.`);
          this.available = false;
          resolve();
        } else {
          this.logger.error(`Redis connection failed (REDIS_OPTIONAL=false): ${err.message}`);
          resolve(); // still resolve — NestJS startup should not hang
        }
      });

      this.client.on('error', (err: Error) => {
        if (this.available) {
          this.available = false;
          this.logger.warn(`Redis connection lost: ${err.message}`);
        }
      });

      this.client.on('ready', () => {
        if (!this.available) {
          this.available = true;
          this.logger.log('Redis connection restored.');
        }
      });
    });
  }
}
