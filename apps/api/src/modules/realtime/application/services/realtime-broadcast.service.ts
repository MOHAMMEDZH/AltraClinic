import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { RealtimeEnvelope, RealtimeWsEvents, RealtimeChannel } from '../../domain/realtime.types';
import { RealtimeRoomBuilder } from '../../domain/realtime-room.builder';
import { RealtimeEventBufferService } from './realtime-event-buffer.service';

/**
 * Pushes realtime envelopes to Socket.IO rooms and buffers for replay.
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Use Redis Pub/Sub so multiple API instances can broadcast."
 *   Counter: Single-instance is current deployment. For horizontal scale,
 *   Phase 2 adds Redis Pub/Sub adapter (@socket.io/redis-adapter) — this
 *   service's emit calls work unchanged once the adapter is configured.
 */
@Injectable()
export class RealtimeBroadcastService {
  private readonly logger = new Logger(RealtimeBroadcastService.name);
  private server: Server | null = null;

  constructor(private readonly buffer: RealtimeEventBufferService) {}

  setServer(server: Server): void {
    this.server = server;
  }

  get isReady(): boolean {
    return this.server !== null;
  }

  /**
   * Publish an event to appropriate rooms and buffer for replay.
   *
   * @param targetUserId — when set, also emits to user-private room (notifications).
   */
  async publish(
    envelope: Omit<RealtimeEnvelope, 'sequence' | 'timestamp'> & { sequence?: number },
    options: { targetUserId?: string } = {},
  ): Promise<RealtimeEnvelope> {
    const sequence = envelope.sequence ?? await this.buffer.nextSequence(envelope.tenantId);
    const full: RealtimeEnvelope = {
      ...envelope,
      sequence,
      timestamp: new Date().toISOString(),
    };

    await this.buffer.append(full);

    if (!this.server) {
      this.logger.debug(`Broadcast deferred (no server): ${full.type}`);
      return full;
    }

    const channelRoom = RealtimeRoomBuilder.tenantChannel(full.tenantId, full.channel);
    this.server.to(channelRoom).emit(RealtimeWsEvents.EVENT, full);

    if (full.branchId) {
      const branchRoom = RealtimeRoomBuilder.branchChannel(full.tenantId, full.branchId, full.channel);
      this.server.to(branchRoom).emit(RealtimeWsEvents.EVENT, full);
    }

    if (options.targetUserId) {
      const userRoom = RealtimeRoomBuilder.userRoom(full.tenantId, options.targetUserId);
      this.server.to(userRoom).emit(RealtimeWsEvents.EVENT, full);
    }

    this.logger.debug(`Broadcast ${full.type} seq=${full.sequence} channel=${full.channel}`);
    return full;
  }

  /** Emit directly to a user's private room (always allowed after auth). */
  emitToUser(tenantId: string, userId: string, event: string, payload: unknown): void {
    if (!this.server) return;
    const userRoom = RealtimeRoomBuilder.userRoom(tenantId, userId);
    this.server.to(userRoom).emit(event, payload);
  }

  /** Send dashboard snapshot to a specific socket. */
  emitToSocket(socketId: string, event: string, payload: unknown): void {
    if (!this.server) return;
    this.server.to(socketId).emit(event, payload);
  }
}
