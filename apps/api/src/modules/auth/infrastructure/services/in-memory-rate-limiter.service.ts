import { Injectable } from '@nestjs/common';
import { RateLimiterPort } from './rate-limiter.port';

interface Bucket {
  count: number;
  expiresAt: number; // unix ms
}

/**
 * In-memory sliding-window rate limiter for development and testing.
 * NOT suitable for multi-instance production deployments (no shared state).
 * Replace with RedisRateLimiter when deploying behind a load balancer.
 */
@Injectable()
export class InMemoryRateLimiter implements RateLimiterPort {
  private readonly store = new Map<string, Bucket>();

  async increment(key: string, windowSeconds: number): Promise<number> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (!existing || existing.expiresAt <= now) {
      this.store.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
      return 1;
    }

    existing.count++;
    return existing.count;
  }

  async getCount(key: string): Promise<number> {
    const now = Date.now();
    const existing = this.store.get(key);
    if (!existing || existing.expiresAt <= now) return 0;
    return existing.count;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }
}
