import { RealtimeChannel } from './realtime.types';

/**
 * Builds Socket.IO room names with mandatory tenant prefix.
 *
 * ROOM FORMAT:
 *   tenant:{tenantId}:channel:{channel}           — tenant-wide channel
 *   tenant:{tenantId}:branch:{branchId}:channel:{channel} — branch-scoped
 *   tenant:{tenantId}:user:{userId}               — user-private (notifications)
 *
 * SECURITY:
 *   tenantId is always the second segment. Cross-tenant joins require knowing
 *   another tenant's UUID AND passing JWT auth for that tenant — structurally
 *   prevented by WsJwtAuthService validating token tenant matches room tenant.
 */
export class RealtimeRoomBuilder {
  static tenantChannel(tenantId: string, channel: RealtimeChannel): string {
    return `tenant:${sanitize(tenantId)}:channel:${channel}`;
  }

  static branchChannel(tenantId: string, branchId: string, channel: RealtimeChannel): string {
    return `tenant:${sanitize(tenantId)}:branch:${sanitize(branchId)}:channel:${channel}`;
  }

  static userRoom(tenantId: string, userId: string): string {
    return `tenant:${sanitize(tenantId)}:user:${sanitize(userId)}`;
  }

  /** Rooms a socket should join for a channel subscription. */
  static roomsForSubscription(
    tenantId: string,
    branchId: string | null,
    channel: RealtimeChannel,
  ): string[] {
    const rooms = [RealtimeRoomBuilder.tenantChannel(tenantId, channel)];
    if (branchId) {
      rooms.push(RealtimeRoomBuilder.branchChannel(tenantId, branchId, channel));
    }
    return rooms;
  }
}

function sanitize(value: string): string {
  return String(value ?? '').replace(/:/g, '_');
}
