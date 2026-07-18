import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Dedicated Redis connection for BullMQ.
 * BullMQ requires maxRetriesPerRequest: null on the ioredis client.
 */
@Injectable()
export class BullMqConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(BullMqConnectionService.name);
  readonly connection: Redis;

  constructor() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.connection = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
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
