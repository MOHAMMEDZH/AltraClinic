import { Injectable, Logger } from '@nestjs/common';
import { AnalyticsAggregationService } from '../../../../infrastructure/redis/services/analytics-aggregation.service';
import { QueueMetricsService } from '../../../../infrastructure/redis/services/queue-metrics.service';
import { RedisKeyBuilder } from '../../../../infrastructure/redis/redis-key.builder';
export interface DashboardSnapshot {
  date: string;
  appointments: number;
  newPatients: number;
  activeUsers: number;
  queue: {
    depth: number;
    processedThisHour: number;
    failedThisHour: number;
    failureRate: number;
  };
}

/**
 * Builds live dashboard metric snapshots from Redis aggregation counters.
 * Authoritative reporting still comes from DB — this is hot-path live data.
 */
@Injectable()
export class RealtimeDashboardService {
  private readonly logger = new Logger(RealtimeDashboardService.name);

  constructor(
    private readonly analytics: AnalyticsAggregationService,
    private readonly queueMetrics: QueueMetricsService,
  ) {}

  async getSnapshot(tenantId: string): Promise<DashboardSnapshot> {
    const date = RedisKeyBuilder.todayUtc();
    const emptyQueue = {
      depth: 0,
      processedThisHour: 0,
      failedThisHour: 0,
      failureRate: 0,
    };

    try {
      const [daily, activeUsers, queue] = await Promise.all([
        this.analytics.getDailyStats(tenantId, date),
        this.analytics.getActiveUserCount(tenantId),
        this.queueMetrics.getMetrics('outbox'),
      ]);

      return {
        date: daily.date,
        appointments: daily.appointments,
        newPatients: daily.newPatients,
        activeUsers,
        queue: {
          depth: queue.depth,
          processedThisHour: queue.processedThisHour,
          failedThisHour: queue.failedThisHour,
          failureRate: queue.failureRate,
        },
      };
    } catch (err) {
      this.logger.warn(
        `Live dashboard snapshot degraded for tenant ${tenantId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return {
        date,
        appointments: 0,
        newPatients: 0,
        activeUsers: 0,
        queue: emptyQueue,
      };
    }
  }
}