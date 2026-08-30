import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, JobsOptions } from 'bullmq';
import { BullMqConnectionService } from './bullmq-connection.service';
import { loadRedisConfig } from '../../../infrastructure/redis/redis-config';
import { QueueMetricsService } from '../../../infrastructure/redis/services/queue-metrics.service';
import {
  BACKGROUND_QUEUES,
  BackgroundQueueName,
} from '../config/queue-names';

export interface EnqueueOptions extends JobsOptions {
  /** Skip queue metrics increment (for scheduler re-enqueue dedup). */
  skipMetrics?: boolean;
}

@Injectable()
export class JobQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(JobQueueService.name);
  private readonly queues = new Map<BackgroundQueueName, Queue>();
  /** When REDIS_OPTIONAL and Redis cannot connect, skip Queue creation to avoid handle leaks. */
  private optionalRedisUnavailable = false;

  constructor(
    private readonly bullMq: BullMqConnectionService,
    private readonly queueMetrics: QueueMetricsService,
  ) {}

  async enqueue(
    queueName: BackgroundQueueName,
    jobName: string,
    data: Record<string, unknown> = {},
    options: EnqueueOptions = {},
  ): Promise<void> {
    const redisConfig = loadRedisConfig();
    if (redisConfig.optional && this.optionalRedisUnavailable) {
      this.logger.warn(
        `Queue enqueue skipped (${queueName}/${jobName}, REDIS_OPTIONAL=true, redis unavailable)`,
      );
      return;
    }

    if (redisConfig.optional && !(await this.ensureOptionalRedisReady())) {
      this.optionalRedisUnavailable = true;
      this.logger.warn(
        `Queue enqueue skipped (${queueName}/${jobName}, REDIS_OPTIONAL=true): redis not ready`,
      );
      return;
    }

    const queue = this.getOrCreateQueue(queueName);
    const { skipMetrics, ...jobOptions } = options;
    const enqueueTimeoutMs = redisConfig.connectTimeoutMs + 500;

    try {
      await Promise.race([
        queue.add(jobName, data, {
          removeOnComplete: 200,
          removeOnFail: 100,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          ...jobOptions,
        }),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Redis enqueue timed out after ${enqueueTimeoutMs}ms`)),
            enqueueTimeoutMs,
          );
        }),
      ]);
    } catch (error) {
      if (redisConfig.optional) {
        this.optionalRedisUnavailable = true;
        this.logger.warn(
          `Queue enqueue skipped (${queueName}/${jobName}, REDIS_OPTIONAL=true): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return;
      }
      throw error;
    }

    if (!skipMetrics) {
      try {
        await this.queueMetrics.recordEnqueued(queueName);
      } catch (error) {
        if (!redisConfig.optional) throw error;
        this.logger.warn(`Queue metrics skipped (REDIS_OPTIONAL=true): ${String(error)}`);
      }
    }
  }

  /**
   * Probe the dedicated BullMQ Redis once before constructing Queue clients.
   * Avoids per-cron ConnectionClosedError spam when CI pins an unreachable REDIS_URL.
   */
  private async ensureOptionalRedisReady(): Promise<boolean> {
    const status = this.bullMq.connection.status;
    if (status === 'ready') return true;
    try {
      if (status === 'wait' || status === 'end' || status === 'close') {
        await this.bullMq.connection.connect();
      } else if (status === 'connecting') {
        await new Promise<void>((resolve, reject) => {
          const onReady = () => {
            cleanup();
            resolve();
          };
          const onError = (err: Error) => {
            cleanup();
            reject(err);
          };
          const cleanup = () => {
            this.bullMq.connection.off('ready', onReady);
            this.bullMq.connection.off('error', onError);
          };
          this.bullMq.connection.once('ready', onReady);
          this.bullMq.connection.once('error', onError);
        });
      }
      return this.bullMq.connection.status === 'ready';
    } catch {
      return false;
    }
  }

  getOrCreateQueue(queueName: BackgroundQueueName): Queue {
    let queue = this.queues.get(queueName);
    if (!queue) {
      // Dual-package ioredis (root vs bullmq nested) requires a cast for ConnectionOptions.
      queue = new Queue(queueName, { connection: this.bullMq.connection as never });
      this.queues.set(queueName, queue);
    }
    return queue;
  }

  async onModuleDestroy(): Promise<void> {
    for (const [name, queue] of this.queues) {
      try {
        await queue.close();
      } catch (error) {
        this.logger.warn(`Failed to close queue ${name}: ${String(error)}`);
      }
    }
  }

  /** All registered queue names for worker bootstrap. */
  static allQueueNames(): BackgroundQueueName[] {
    return Object.values(BACKGROUND_QUEUES);
  }
}
