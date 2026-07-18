import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { RedisKeyBuilder } from '../redis-key.builder';

export interface DailyStats {
  date: string;
  appointments: number;
  newPatients: number;
}

export interface MonthlyStats {
  month: string;
  appointments: number;
}

/**
 * AnalyticsAggregationService
 *
 * Real-time analytics counters using Redis INCR.
 *
 * PURPOSE:
 *   Maintain fast-access aggregated counters for dashboards and real-time
 *   metrics WITHOUT hitting PostgreSQL on every request. These counters
 *   complement (not replace) the authoritative DB data.
 *
 * PATTERNS USED:
 *   - INCR: O(1) atomic increment for daily/monthly counters.
 *   - PFADD (HyperLogLog): O(1) space-efficient unique user counting.
 *     Accuracy: ~0.81% standard error. Acceptable for analytics.
 *   - Counters auto-expire after their natural window + buffer.
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Redis counters can drift from the DB if Redis is restarted.
 *   These are analytics, not billing — but drift still misleads dashboards."
 *   Counter: The counters are supplementary ("hot data") — the authoritative
 *   source for reporting is always the DB. When Redis is empty (cold start
 *   or restart), counters return 0 and fall back to a DB query for the
 *   dashboard. This is documented in the Analytics module.
 *   Decision: Redis for live counters, DB for historical accuracy.
 *
 *   Challenger: "Use Redis Streams + consumer groups for event-driven aggregation."
 *   Counter: Streams are excellent for event-driven pipelines but require
 *   consumer group management and persistent message handling. INCR counters
 *   are simpler, faster, and sufficient for the current analytics requirements.
 *   Phase 3: Migrate to Streams when we need replay, backfill, or fan-out.
 */
@Injectable()
export class AnalyticsAggregationService {
  private readonly logger = new Logger(AnalyticsAggregationService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly keys: RedisKeyBuilder,
  ) {}

  // ---------------------------------------------------------------------------
  // Appointment counters
  // ---------------------------------------------------------------------------

  async incrementAppointments(tenantId: string, dateStr?: string): Promise<void> {
    if (!this.redis.isAvailable) return;
    const date = dateStr ?? RedisKeyBuilder.todayUtc();
    const month = date.substring(0, 7); // YYYY-MM

    const daily = this.keys.dailyAppointments(tenantId, date);
    const monthly = this.keys.monthlyAppointments(tenantId, month);

    // Expire daily counter after 8 days, monthly after 35 days
    await this.incrWithExpire(daily, 8 * 86400);
    await this.incrWithExpire(monthly, 35 * 86400);
  }

  async getDailyAppointmentCount(tenantId: string, dateStr: string): Promise<number> {
    if (!this.redis.isAvailable) return 0;
    const raw = await this.redis.get(this.keys.dailyAppointments(tenantId, dateStr));
    return parseInt(raw ?? '0', 10);
  }

  async getMonthlyAppointmentCount(tenantId: string, monthStr: string): Promise<number> {
    if (!this.redis.isAvailable) return 0;
    const raw = await this.redis.get(this.keys.monthlyAppointments(tenantId, monthStr));
    return parseInt(raw ?? '0', 10);
  }

  // ---------------------------------------------------------------------------
  // Patient counters
  // ---------------------------------------------------------------------------

  async incrementNewPatients(tenantId: string, dateStr?: string): Promise<void> {
    if (!this.redis.isAvailable) return;
    const date = dateStr ?? RedisKeyBuilder.todayUtc();
    const key = this.keys.dailyNewPatients(tenantId, date);
    await this.incrWithExpire(key, 8 * 86400);
  }

  async getDailyNewPatientCount(tenantId: string, dateStr: string): Promise<number> {
    if (!this.redis.isAvailable) return 0;
    const raw = await this.redis.get(this.keys.dailyNewPatients(tenantId, dateStr));
    return parseInt(raw ?? '0', 10);
  }

  // ---------------------------------------------------------------------------
  // Active user tracking (HyperLogLog)
  // ---------------------------------------------------------------------------

  /**
   * Record a user as active in the current hour window.
   * Uses HyperLogLog for space-efficient unique counting (< 1% error).
   */
  async trackActiveUser(tenantId: string, userId: string): Promise<void> {
    if (!this.redis.isAvailable) return;
    const windowKey = RedisKeyBuilder.currentHourWindow();
    const key = this.keys.activeUsers(tenantId, windowKey);
    await (this.redis.raw as import('ioredis').default).pfadd(key, userId);
    await this.redis.expire(key, 3 * 3600); // keep for 3 hours
  }

  /**
   * Approximate unique active users in the current hour.
   */
  async getActiveUserCount(tenantId: string): Promise<number> {
    if (!this.redis.isAvailable) return 0;
    const windowKey = RedisKeyBuilder.currentHourWindow();
    const key = this.keys.activeUsers(tenantId, windowKey);
    try {
      return await (this.redis.raw as import('ioredis').default).pfcount(key);
    } catch {
      return 0;
    }
  }

  // ---------------------------------------------------------------------------
  // Dashboard snapshot (multi-key read)
  // ---------------------------------------------------------------------------

  async getDailyStats(tenantId: string, dateStr?: string): Promise<DailyStats> {
    const date = dateStr ?? RedisKeyBuilder.todayUtc();
    return {
      date,
      appointments: await this.getDailyAppointmentCount(tenantId, date),
      newPatients: await this.getDailyNewPatientCount(tenantId, date),
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async incrWithExpire(key: string, ttlSeconds: number): Promise<void> {
    const luaScript = `
      local count = redis.call('INCR', KEYS[1])
      if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
      return count
    `;
    await this.redis.eval(luaScript, [key], [String(ttlSeconds)]);
  }
}
