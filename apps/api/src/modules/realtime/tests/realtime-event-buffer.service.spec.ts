import { RealtimeEventBufferService } from '../application/services/realtime-event-buffer.service';
import { RedisKeyBuilder } from '../../../infrastructure/redis/redis-key.builder';
import { MockRedisService } from '../../../infrastructure/redis/tests/mock-redis.service';
import { RealtimeChannel } from '../domain/realtime.types';

function buildBuffer() {
  const redis = new MockRedisService();
  const keys = new RedisKeyBuilder('app');
  const svc = new RealtimeEventBufferService(redis as any, keys);
  return { redis, svc };
}

describe('RealtimeEventBufferService', () => {
  const TENANT = 'tenant-1';
  const CHANNEL = 'appointments' as RealtimeChannel;

  it('assigns monotonic sequences', async () => {
    const { svc } = buildBuffer();
    const s1 = await svc.nextSequence(TENANT);
    const s2 = await svc.nextSequence(TENANT);
    expect(s2).toBe(s1 + 1);
  });

  it('buffers and replays events since sequence', async () => {
    const { svc } = buildBuffer();

    await svc.append({
      sequence: 1,
      eventId: 'e1',
      channel: CHANNEL,
      type: 'appointment.scheduled',
      tenantId: TENANT,
      branchId: null,
      timestamp: new Date().toISOString(),
      payload: { appointmentId: 'a1' },
    });

    await svc.append({
      sequence: 2,
      eventId: 'e2',
      channel: CHANNEL,
      type: 'appointment.scheduled',
      tenantId: TENANT,
      branchId: null,
      timestamp: new Date().toISOString(),
      payload: { appointmentId: 'a2' },
    });

    const replay = await svc.getSince(TENANT, CHANNEL, 1);
    expect(replay).toHaveLength(1);
    expect(replay[0].sequence).toBe(2);
  });

  it('saves and restores connection state', async () => {
    const { svc } = buildBuffer();
    await svc.saveConnectionState(TENANT, 'user-1', 'sess-1', 42);
    const seq = await svc.getConnectionState(TENANT, 'user-1', 'sess-1');
    expect(seq).toBe(42);
  });
});
