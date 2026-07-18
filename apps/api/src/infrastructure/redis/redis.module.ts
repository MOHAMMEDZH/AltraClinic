import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisKeyBuilder } from './redis-key.builder';
import { CacheService } from './services/cache.service';
import { RateLimiterService } from './services/rate-limiter.service';
import { SessionCacheService } from './services/session-cache.service';
import { DistributedLockService } from './services/distributed-lock.service';
import { TemporaryTokenService } from './services/temporary-token.service';
import { QueueMetricsService } from './services/queue-metrics.service';
import { AnalyticsAggregationService } from './services/analytics-aggregation.service';
import { loadRedisConfig } from './redis-config';

/**
 * RedisModule
 *
 * @Global() — registered once in InfrastructureModule; all Redis services
 * are available project-wide without importing this module per feature.
 *
 * Key namespace prefix is resolved from REDIS_KEY_PREFIX env var (default: 'app').
 * This allows staging and production to share one Redis instance safely.
 */
@Global()
@Module({
  providers: [
    RedisService,
    {
      provide: RedisKeyBuilder,
      useFactory: () => {
        const config = loadRedisConfig();
        return new RedisKeyBuilder(config.keyPrefix);
      },
    },
    CacheService,
    RateLimiterService,
    SessionCacheService,
    DistributedLockService,
    TemporaryTokenService,
    QueueMetricsService,
    AnalyticsAggregationService,
  ],
  exports: [
    RedisService,
    RedisKeyBuilder,
    CacheService,
    RateLimiterService,
    SessionCacheService,
    DistributedLockService,
    TemporaryTokenService,
    QueueMetricsService,
    AnalyticsAggregationService,
  ],
})
export class RedisModule {}
