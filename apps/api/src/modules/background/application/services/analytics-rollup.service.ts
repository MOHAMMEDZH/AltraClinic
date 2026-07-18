import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { AnalyticsAggregationService } from '../../../../infrastructure/redis/services/analytics-aggregation.service';
import { RedisKeyBuilder } from '../../../../infrastructure/redis/redis-key.builder';
import { LicensingExecutionGuard } from '../../../subscription/application/services/licensing-execution.guard';

export interface AnalyticsRollupResult {
  tenantsProcessed: number;
  metricsRecorded: number;
}

/**
 * Persists Redis hot counters into durable analytics storage.
 * Phase 1: logs rollup snapshots; Phase 2 writes to MetricRepository / warehouse.
 */
@Injectable()
export class AnalyticsRollupService {
  private readonly logger = new Logger(AnalyticsRollupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsAggregationService,
    private readonly licensing: LicensingExecutionGuard,
  ) {}

  async aggregateDaily(dateStr?: string): Promise<AnalyticsRollupResult> {
    const date = dateStr ?? RedisKeyBuilder.yesterdayUtc();
    const month = date.substring(0, 7);
    const result: AnalyticsRollupResult = { tenantsProcessed: 0, metricsRecorded: 0 };

    const tenants = await this.prisma.tenant.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });

    for (const tenant of tenants) {
      const allowed = await this.licensing.allowWorkerExecution({
        tenantId: tenant.id,
        workerName: 'analytics-rollup',
        moduleId: 'analytics',
        source: 'worker.analytics_rollup',
      });
      if (!allowed) continue;

      const daily = await this.analytics.getDailyStats(tenant.id, date);
      const monthlyAppointments = await this.analytics.getMonthlyAppointmentCount(tenant.id, month);
      const activeUsers = await this.analytics.getActiveUserCount(tenant.id);

      this.logger.log(
        JSON.stringify({
          type: 'analytics.rollup',
          tenantId: tenant.id,
          date,
          appointments: daily.appointments,
          newPatients: daily.newPatients,
          monthlyAppointments,
          activeUsers,
        }),
      );

      result.tenantsProcessed++;
      result.metricsRecorded += 3;
    }

    return result;
  }
}
