import { AnalyticsAggregationService } from '../services/analytics-aggregation.service';
import { RedisKeyBuilder } from '../redis-key.builder';
import { MockRedisService } from './mock-redis.service';

const TENANT = 'tenant-clinic';
const DATE = '2026-06-15';
const MONTH = '2026-06';

function buildSvc() {
  const redis = new MockRedisService();
  const kb = new RedisKeyBuilder('app');
  // Patch pfadd/pfcount for HyperLogLog (not in MockRedisService)
  (redis as any).raw = {
    pfadd: jest.fn().mockResolvedValue(1),
    pfcount: jest.fn().mockResolvedValue(42),
  };
  const svc = new AnalyticsAggregationService(redis as any, kb);
  return { redis, svc };
}

describe('AnalyticsAggregationService', () => {
  describe('Appointment counters', () => {
    it('increments daily appointment count', async () => {
      const { svc } = buildSvc();
      await svc.incrementAppointments(TENANT, DATE);
      await svc.incrementAppointments(TENANT, DATE);
      const count = await svc.getDailyAppointmentCount(TENANT, DATE);
      expect(count).toBe(2);
    });

    it('increments monthly appointment count', async () => {
      const { svc } = buildSvc();
      await svc.incrementAppointments(TENANT, DATE);
      await svc.incrementAppointments(TENANT, DATE);
      await svc.incrementAppointments(TENANT, DATE);
      const monthly = await svc.getMonthlyAppointmentCount(TENANT, MONTH);
      expect(monthly).toBe(3);
    });

    it('returns 0 when no appointments recorded', async () => {
      const { svc } = buildSvc();
      expect(await svc.getDailyAppointmentCount(TENANT, DATE)).toBe(0);
    });

    it('counters are tenant-scoped', async () => {
      const { svc } = buildSvc();
      await svc.incrementAppointments('tenant-a', DATE);
      await svc.incrementAppointments('tenant-a', DATE);
      await svc.incrementAppointments('tenant-b', DATE);
      expect(await svc.getDailyAppointmentCount('tenant-a', DATE)).toBe(2);
      expect(await svc.getDailyAppointmentCount('tenant-b', DATE)).toBe(1);
    });

    it('counters are date-scoped', async () => {
      const { svc } = buildSvc();
      await svc.incrementAppointments(TENANT, '2026-06-15');
      await svc.incrementAppointments(TENANT, '2026-06-16');
      expect(await svc.getDailyAppointmentCount(TENANT, '2026-06-15')).toBe(1);
      expect(await svc.getDailyAppointmentCount(TENANT, '2026-06-16')).toBe(1);
    });
  });

  describe('Patient counters', () => {
    it('increments new patient count', async () => {
      const { svc } = buildSvc();
      await svc.incrementNewPatients(TENANT, DATE);
      await svc.incrementNewPatients(TENANT, DATE);
      const count = await svc.getDailyNewPatientCount(TENANT, DATE);
      expect(count).toBe(2);
    });

    it('returns 0 for day with no new patients', async () => {
      const { svc } = buildSvc();
      expect(await svc.getDailyNewPatientCount(TENANT, '2026-01-01')).toBe(0);
    });
  });

  describe('getDailyStats snapshot', () => {
    it('returns combined daily stats', async () => {
      const { svc } = buildSvc();
      await svc.incrementAppointments(TENANT, DATE);
      await svc.incrementNewPatients(TENANT, DATE);
      const stats = await svc.getDailyStats(TENANT, DATE);
      expect(stats.date).toBe(DATE);
      expect(stats.appointments).toBe(1);
      expect(stats.newPatients).toBe(1);
    });
  });

  describe('Active user tracking (HyperLogLog)', () => {
    it('records active users via pfadd', async () => {
      const { svc, redis } = buildSvc();
      await svc.trackActiveUser(TENANT, 'user-1');
      expect((redis as any).raw.pfadd).toHaveBeenCalled();
    });

    it('returns pfcount result for active users', async () => {
      const { svc } = buildSvc();
      const count = await svc.getActiveUserCount(TENANT);
      expect(count).toBe(42);
    });
  });

  describe('Redis unavailable', () => {
    it('returns 0 when Redis is offline', async () => {
      const { svc, redis } = buildSvc();
      redis.goOffline();
      await svc.incrementAppointments(TENANT, DATE);
      expect(await svc.getDailyAppointmentCount(TENANT, DATE)).toBe(0);
    });
  });
});
