import { Injectable } from '@nestjs/common';
import { RateLimiterService } from '../../../../infrastructure/redis/services/rate-limiter.service';
import { RateLimiterPort } from '../rate-limiter.port';

/**
 * Redis-backed rate limiter for auth flows (forgot password, verification, etc.).
 */
@Injectable()
export class RedisRateLimiter implements RateLimiterPort {
  constructor(private readonly rateLimiter: RateLimiterService) {}

  async increment(key: string, windowSeconds: number): Promise<number> {
    const result = await this.rateLimiter.checkSlidingWindow(key, 10_000, windowSeconds);
    return result.count;
  }

  async getCount(key: string): Promise<number> {
    const result = await this.rateLimiter.checkSlidingWindow(key, 10_000, 60);
    return result.count;
  }

  async reset(key: string): Promise<void> {
    await this.rateLimiter.reset(key);
  }
}
