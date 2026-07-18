import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, JobsOptions } from 'bullmq';
import { BullMqConnectionService } from './bullmq-connection.service';
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
    const queue = this.getOrCreateQueue(queueName);
    const { skipMetrics, ...jobOptions } = options;

    await queue.add(jobName, data, {
      removeOnComplete: 200,
      removeOnFail: 100,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      ...jobOptions,
    });

    if (!skipMetrics) {
      await this.queueMetrics.recordEnqueued(queueName);
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
