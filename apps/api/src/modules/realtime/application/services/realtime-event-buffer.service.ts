import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../../infrastructure/redis/redis.service';
import { RedisKeyBuilder } from '../../../../infrastructure/redis/redis-key.builder';
import { RealtimeEnvelope } from '../../domain/realtime.types';
import { REALTIME_BUFFER_MAX, REALTIME_BUFFER_TTL_SECONDS } from '../../domain/realtime-channel.config';

/**
 * Redis-backed capped event buffer for reconnection replay.
 *
 * Each tenant+channel maintains a list of serialized RealtimeEnvelope JSON.
 * LPUSH + LTRIM keeps the most recent REALTIME_BUFFER_MAX events.
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Use Redis Streams with consumer groups for replay."
 *   Counter: Streams add XREAD complexity; capped lists are sufficient for
 *   200-event replay window. Phase 2: migrate to Streams if replay window > 1000.
 */
@Injectable()
export class RealtimeEventBufferService {
  private readonly logger = new Logger(RealtimeEventBufferService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly keys: RedisKeyBuilder,
  ) {}

  /** Allocate next monotonic sequence number for a tenant. */
  async nextSequence(tenantId: string): Promise<number> {
    if (!this.redis.isAvailable) return Date.now();
    const key = this.keys.realtimeSequence(tenantId);
    return this.redis.incr(key);
  }

  /** Store event in tenant+channel buffer. Returns assigned sequence. */
  async append(envelope: RealtimeEnvelope): Promise<number> {
    const sequence = envelope.sequence || await this.nextSequence(envelope.tenantId);
    const stored: RealtimeEnvelope = { ...envelope, sequence };

    if (!this.redis.isAvailable) return sequence;

    const bufferKey = this.keys.realtimeBuffer(envelope.tenantId, envelope.channel);
    await this.redis.lpush(bufferKey, JSON.stringify(stored));
    await this.redis.ltrim(bufferKey, 0, REALTIME_BUFFER_MAX - 1);
    await this.redis.expire(bufferKey, REALTIME_BUFFER_TTL_SECONDS);

    return sequence;
  }

  /** Fetch events with sequence > sinceSequence for replay on reconnect. */
  async getSince(
    tenantId: string,
    channel: RealtimeEnvelope['channel'],
    sinceSequence: number,
  ): Promise<RealtimeEnvelope[]> {
    if (!this.redis.isAvailable) return [];

    const bufferKey = this.keys.realtimeBuffer(tenantId, channel);
    const raw = await this.redis.lrange(bufferKey, 0, REALTIME_BUFFER_MAX - 1);

    const events: RealtimeEnvelope[] = [];
    for (const item of raw) {
      try {
        const parsed = JSON.parse(item) as RealtimeEnvelope;
        if (parsed.sequence > sinceSequence) {
          events.push(parsed);
        }
      } catch {
        this.logger.warn(`Failed to parse buffered realtime event for ${tenantId}/${channel}`);
      }
    }

    return events.sort((a, b) => a.sequence - b.sequence);
  }

  /** Persist last acknowledged sequence for a connection (resume checkpoint). */
  async saveConnectionState(
    tenantId: string,
    userId: string,
    sessionId: string,
    lastSequence: number,
  ): Promise<void> {
    if (!this.redis.isAvailable) return;
    const key = this.keys.realtimeConnectionState(tenantId, userId, sessionId);
    await this.redis.set(key, String(lastSequence), 3600);
  }

  async getConnectionState(
    tenantId: string,
    userId: string,
    sessionId: string,
  ): Promise<number> {
    if (!this.redis.isAvailable) return 0;
    const key = this.keys.realtimeConnectionState(tenantId, userId, sessionId);
    const raw = await this.redis.get(key);
    return raw ? parseInt(raw, 10) : 0;
  }
}
