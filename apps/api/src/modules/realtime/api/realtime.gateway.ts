import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  RealtimeChannel,
  RealtimeSocketUser,
  RealtimeWsEvents,
  SubscribePayload,
  ResumePayload,
} from '../domain/realtime.types';
import { RealtimeRoomBuilder } from '../domain/realtime-room.builder';
import {
  REALTIME_HEARTBEAT_MS,
  REALTIME_STALE_CONNECTION_MS,
} from '../domain/realtime-channel.config';
import { WsJwtAuthService } from '../application/services/ws-jwt-auth.service';
import { RealtimeAuthorizationService } from '../application/services/realtime-authorization.service';
import { RealtimeBroadcastService } from '../application/services/realtime-broadcast.service';
import { RealtimeEventBufferService } from '../application/services/realtime-event-buffer.service';
import { RealtimeDashboardService } from '../application/services/realtime-dashboard.service';

interface AuthenticatedSocket extends Socket {
  data: {
    user: RealtimeSocketUser;
    subscribedChannels: Set<RealtimeChannel>;
    lastSequence: number;
    lastPingAt: number;
  };
}

/**
 * RealtimeGateway — tenant-isolated Socket.IO gateway.
 *
 * Namespace: /realtime
 * Auth: JWT in handshake.auth.token or handshake.query.token
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Use native WebSockets instead of Socket.IO — lighter weight."
 *   Counter: Socket.IO provides rooms, automatic reconnection, and fallback
 *   transports. NestJS first-class support is via @nestjs/platform-socket.io.
 *   Decision: Socket.IO. Native WS adds room management we'd rebuild manually.
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: '*', credentials: true },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly wsAuth: WsJwtAuthService,
    private readonly authorization: RealtimeAuthorizationService,
    private readonly broadcast: RealtimeBroadcastService,
    private readonly buffer: RealtimeEventBufferService,
    private readonly dashboard: RealtimeDashboardService,
  ) {}

  afterInit(server: Server): void {
    this.broadcast.setServer(server);
    this.logger.log('Realtime gateway initialized on namespace /realtime');
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.query?.token as string | undefined);

      const user = await this.wsAuth.authenticate(token);

      const savedSeq = await this.buffer.getConnectionState(
        user.tenantId,
        user.sub,
        user.sessionId,
      );

      client.data = {
        user,
        subscribedChannels: new Set(),
        lastSequence: savedSeq,
        lastPingAt: Date.now(),
      };

      // Always join user-private room (notifications)
      await client.join(RealtimeRoomBuilder.userRoom(user.tenantId, user.sub));

      client.emit(RealtimeWsEvents.CONNECTED, {
        userId: user.sub,
        tenantId: user.tenantId,
        branchId: user.branchId,
        lastSequence: savedSeq,
        heartbeatMs: REALTIME_HEARTBEAT_MS,
        serverTime: new Date().toISOString(),
      });

      this.logger.debug(`WS connected: user=${user.sub} tenant=${user.tenantId}`);
    } catch (err) {
      this.logger.warn(`WS auth failed: ${(err as Error).message}`);
      client.emit(RealtimeWsEvents.ERROR, { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    const user = client.data?.user;
    if (user) {
      await this.buffer.saveConnectionState(
        user.tenantId,
        user.sub,
        user.sessionId,
        client.data.lastSequence,
      );
      this.logger.debug(`WS disconnected: user=${user.sub}`);
    }
  }

  @SubscribeMessage(RealtimeWsEvents.SUBSCRIBE)
  async handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: SubscribePayload,
  ): Promise<void> {
    const user = client.data.user;
    if (!user) return;

    const requested = body.channels ?? [];
    const allowed = await this.authorization.filterAllowedChannels(user, requested);
    const denied = requested.filter((ch) => !allowed.includes(ch));

    for (const channel of allowed) {
      const rooms = RealtimeRoomBuilder.roomsForSubscription(
        user.tenantId,
        user.branchId,
        channel,
      );
      for (const room of rooms) {
        await client.join(room);
      }
      client.data.subscribedChannels.add(channel);

      if (channel === 'dashboard') {
        const snapshot = await this.dashboard.getSnapshot(user.tenantId);
        client.emit(RealtimeWsEvents.EVENT, {
          channel: 'dashboard',
          type: 'dashboard.snapshot',
          tenantId: user.tenantId,
          branchId: user.branchId,
          timestamp: new Date().toISOString(),
          payload: snapshot,
        });
      }
    }

    client.emit(RealtimeWsEvents.SUBSCRIBED, {
      channels: allowed,
      denied,
    });
  }

  @SubscribeMessage(RealtimeWsEvents.UNSUBSCRIBE)
  async handleUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: SubscribePayload,
  ): Promise<void> {
    const user = client.data.user;
    if (!user) return;

    for (const channel of body.channels ?? []) {
      const rooms = RealtimeRoomBuilder.roomsForSubscription(
        user.tenantId,
        user.branchId,
        channel,
      );
      for (const room of rooms) {
        await client.leave(room);
      }
      client.data.subscribedChannels.delete(channel);
    }

    client.emit(RealtimeWsEvents.SUBSCRIBED, {
      channels: Array.from(client.data.subscribedChannels),
      denied: [],
    });
  }

  @SubscribeMessage(RealtimeWsEvents.RESUME)
  async handleResume(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: ResumePayload,
  ): Promise<void> {
    const user = client.data.user;
    if (!user) return;

    const sinceSequence = body.lastSequence ?? 0;
    const channels = body.channels?.length
      ? await this.authorization.filterAllowedChannels(user, body.channels)
      : await this.authorization.filterAllowedChannels(user, Array.from(client.data.subscribedChannels));

    const replay: unknown[] = [];
    for (const channel of channels) {
      const events = await this.buffer.getSince(user.tenantId, channel, sinceSequence);
      replay.push(...events);
    }

    replay.sort((a, b) => (a as { sequence: number }).sequence - (b as { sequence: number }).sequence);

    const maxSeq = replay.reduce(
      (max, e) => Math.max(max, (e as { sequence: number }).sequence),
      sinceSequence,
    );
    client.data.lastSequence = maxSeq;

    client.emit(RealtimeWsEvents.REPLAY, {
      events: replay,
      count: replay.length,
      fromSequence: sinceSequence,
      toSequence: maxSeq,
    });
  }

  @SubscribeMessage(RealtimeWsEvents.PING)
  handlePing(@ConnectedSocket() client: AuthenticatedSocket): void {
    client.data.lastPingAt = Date.now();
    client.emit(RealtimeWsEvents.PONG, {
      serverTime: new Date().toISOString(),
      staleThresholdMs: REALTIME_STALE_CONNECTION_MS,
    });
  }
}
