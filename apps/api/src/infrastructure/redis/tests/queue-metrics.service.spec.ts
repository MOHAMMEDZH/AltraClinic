import { QueueMetricsService } from '../services/queue-metrics.service';
import { RedisKeyBuilder } from '../redis-key.builder';
import { MockRedisService } from './mock-redis.service';

function buildSvc() {
  const redis = new MockRedisService();
  const kb = new RedisKeyBuilder('app');
  const svc = new QueueMetricsService(redis as any, kb);
  return { redis, svc };
}

describe('QueueMetricsService', () => {
  const QUEUE = 'outbox';

  describe('recordEnqueued / getMetrics', () => {
    it('increments queue depth on enqueue', async () => {
      const { svc } = buildSvc();
      await svc.recordEnqueued(QUEUE);
      await svc.recordEnqueued(QUEUE);
      const metrics = await svc.getMetrics(QUEUE);
      expect(metrics.depth).toBe(2);
    });

    it('returns zero metrics when no events recorded', async () => {
      const { svc } = buildSvc();
      const metrics = await svc.getMetrics(QUEUE);
      expect(metrics.depth).toBe(0);
      expect(metrics.processedThisHour).toBe(0);
      expect(metrics.failedThisHour).toBe(0);
      expect(metrics.failureRate).toBe(0);
    });
  });

  describe('recordCompleted', () => {
    it('decrements depth and increments processed counter', async () => {
      const { svc } = buildSvc();
      await svc.recordEnqueued(QUEUE);
      await svc.recordEnqueued(QUEUE);
      await svc.recordCompleted(QUEUE);
      const metrics = await svc.getMetrics(QUEUE);
      expect(metrics.depth).toBe(1);
      expect(metrics.processedThisHour).toBe(1);
    });

    it('depth does not go below 0', async () => {
      const { svc } = buildSvc();
      await svc.recordCompleted(QUEUE); // call without prior enqueue
      const metrics = await svc.getMetrics(QUEUE);
      expect(metrics.depth).toBe(0);
    });
  });

  describe('recordFailed', () => {
    it('decrements depth and increments error counter', async () => {
      const { svc } = buildSvc();
      await svc.recordEnqueued(QUEUE);
      await svc.recordFailed(QUEUE);
      const metrics = await svc.getMetrics(QUEUE);
      expect(metrics.depth).toBe(0);
      expect(metrics.failedThisHour).toBe(1);
    });
  });

  describe('failure rate', () => {
    it('calculates failure rate correctly', async () => {
      const { svc } = buildSvc();
      for (let i = 0; i < 3; i++) await svc.recordEnqueued(QUEUE);
      await svc.recordCompleted(QUEUE);
      await svc.recordCompleted(QUEUE);
      await svc.recordFailed(QUEUE);
      const metrics = await svc.getMetrics(QUEUE);
      // 1 failed out of 3 total = 0.333...
      expect(metrics.failureRate).toBeCloseTo(1 / 3, 2);
    });
  });

  describe('resetDepth', () => {
    it('resets queue depth to 0', async () => {
      const { svc } = buildSvc();
      await svc.recordEnqueued(QUEUE);
      await svc.recordEnqueued(QUEUE);
      await svc.resetDepth(QUEUE);
      const metrics = await svc.getMetrics(QUEUE);
      expect(metrics.depth).toBe(0);
    });
  });

  describe('multiple queues', () => {
    it('tracks metrics independently per queue', async () => {
      const { svc } = buildSvc();
      await svc.recordEnqueued('queue-a');
      await svc.recordEnqueued('queue-a');
      await svc.recordEnqueued('queue-b');
      const a = await svc.getMetrics('queue-a');
      const b = await svc.getMetrics('queue-b');
      expect(a.depth).toBe(2);
      expect(b.depth).toBe(1);
    });
  });

  describe('Redis unavailable', () => {
    it('returns zero metrics when Redis is offline', async () => {
      const { svc, redis } = buildSvc();
      redis.goOffline();
      await svc.recordEnqueued(QUEUE);
      const metrics = await svc.getMetrics(QUEUE);
      expect(metrics.depth).toBe(0);
    });
  });
});
