import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { loadRedisConfig } from '../../../infrastructure/redis/redis-config';

/**
 * Dedicated Redis connection for BullMQ.
 * BullMQ requires maxRetriesPerRequest: null on the ioredis client.
 */
@Injectable()
export class BullMqConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(BullMqConnectionService.name);
  readonly connection: Redis;

  constructor() {
    const config = loadRedisConfig();
    this.connection = new Redis(config.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: config.connectTimeoutMs,
      retryStrategy: config.optional
        ? () => null
        : (times) => Math.min(times * 200, 3_000),
    });
    this.connection.on('error', (err) => {
      this.logger.warn(`BullMQ Redis connection error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.connection.quit();
    } catch {
      this.connection.disconnect();
    }
  }
}
