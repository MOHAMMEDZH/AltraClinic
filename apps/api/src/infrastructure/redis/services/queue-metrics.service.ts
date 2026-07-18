import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeyBuilder } from '../redis-key.builder';

export interface QueueMetrics {
  queueName: string;
  /** Jobs waiting to be processed (current depth). */
  depth: number;
  /** Jobs completed in the current hour window. */
  processedThisHour: number;
  /** Jobs failed in the current hour window. */
  failedThisHour: number;
  /** Derived: failure rate (0–1). */
  failureRate: number;
}

/**
 * QueueMetricsService
 *
 * Lightweight Redis-backed queue instrumentation.
 * Records enqueue/complete/fail events as Redis INCR counters.
 * Queue depth is tracked as a net counter (enqueue - complete - fail).
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Use BullMQ's built-in metrics instead of rolling our own."
 *   Counter: Generic counters decouple observability from BullMQ internals and
 *   remain useful for non-BullMQ paths (manual drains, future queues).
 *   BullMQ is now used for background jobs — supplement with Bull Board in Phase 2.
 *   Decision: Keep lightweight Redis counters; add BullMQ-native metrics later.
 */
@Injectable()
export class QueueMetricsService {
  private readonly logger = new Logger(QueueMetricsService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly keys: RedisKeyBuilder,
  ) {}

  /** Call when a job is enqueued. Increments the queue depth. */
  async recordEnqueued(queueName: string): Promise<void> {
    if (!this.redis.isAvailable) return;
    await this.redis.incr(this.keys.queueDepth(queueName));
  }

  /** Call when a job is successfully processed. Decrements depth, increments processed counter. */
  async recordCompleted(queueName: string): Promise<void> {
    if (!this.redis.isAvailable) return;
    const depthKey = this.keys.queueDepth(queueName);
    const processedKey = this.keys.queueProcessed(queueName, RedisKeyBuilder.currentHourWindow());

    // Allow depth to go to 0 minimum (never negative)
    const luaScript = `
      local depth = tonumber(redis.call('GET', KEYS[1]) or '0')
      if depth > 0 then redis.call('DECR', KEYS[1]) end
      local count = redis.call('INCR', KEYS[2])
      if count == 1 then redis.call('EXPIRE', KEYS[2], 7200) end
      return count
    `;
    await this.redis.eval(luaScript, [depthKey, processedKey], []);
  }

  /** Call when a job fails. Decrements depth, increments error counter. */
  async recordFailed(queueName: string): Promise<void> {
    if (!this.redis.isAvailable) return;
    const depthKey = this.keys.queueDepth(queueName);
    const errorKey = this.keys.queueErrors(queueName, RedisKeyBuilder.currentHourWindow());

    const luaScript = `
      local depth = tonumber(redis.call('GET', KEYS[1]) or '0')
      if depth > 0 then redis.call('DECR', KEYS[1]) end
      local count = redis.call('INCR', KEYS[2])
      if count == 1 then redis.call('EXPIRE', KEYS[2], 7200) end
      return count
    `;
    await this.redis.eval(luaScript, [depthKey, errorKey], []);
  }

  /** Returns current metrics for a queue. */
  async getMetrics(queueName: string): Promise<QueueMetrics> {
    if (!this.redis.isAvailable) {
      return { queueName, depth: 0, processedThisHour: 0, failedThisHour: 0, failureRate: 0 };
    }

    const windowKey = RedisKeyBuilder.currentHourWindow();
    const depthRaw     = await this.redis.get(this.keys.queueDepth(queueName));
    const processedRaw = await this.redis.get(this.keys.queueProcessed(queueName, windowKey));
    const failedRaw    = await this.redis.get(this.keys.queueErrors(queueName, windowKey));

    const depth     = parseInt(depthRaw ?? '0', 10);
    const processed = parseInt(processedRaw ?? '0', 10);
    const failed    = parseInt(failedRaw ?? '0', 10);
    const total     = processed + failed;

    return {
      queueName,
      depth,
      processedThisHour: processed,
      failedThisHour: failed,
      failureRate: total > 0 ? failed / total : 0,
    };
  }

  /** Reset queue depth (e.g. after manual queue drain). */
  async resetDepth(queueName: string): Promise<void> {
    await this.redis.del(this.keys.queueDepth(queueName));
  }
}
