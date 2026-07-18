import { PermissionAction } from '../../../common/authorization/permission-matrix.validation';
import { RealtimeChannel } from './realtime.types';

export interface ChannelPermission {
  resource: string;
  action: PermissionAction;
}

/**
 * Maps each realtime channel to the RBAC resource/action required to subscribe.
 * Fail-closed: unknown channels are denied by RealtimeAuthorizationService.
 */
export const REALTIME_CHANNEL_PERMISSIONS: Record<RealtimeChannel, ChannelPermission> = {
  queue:         { resource: 'api.queue',         action: 'view' },
  dashboard:     { resource: 'api.analytics',     action: 'view' },
  notifications: { resource: 'api.notifications', action: 'view' },
  appointments:  { resource: 'api.scheduling',    action: 'view' },
  patients:      { resource: 'api.patients',      action: 'view' },
  workflows:     { resource: 'api.workflow',      action: 'view' },
};

/** Max events retained per tenant+channel for reconnection replay. */
export const REALTIME_BUFFER_MAX = 200;

/** Buffer TTL in seconds (2 hours). */
export const REALTIME_BUFFER_TTL_SECONDS = 7200;

/** Heartbeat interval recommendation sent to clients (ms). */
export const REALTIME_HEARTBEAT_MS = 25_000;

/** Server-side stale connection threshold (ms). */
export const REALTIME_STALE_CONNECTION_MS = 90_000;
