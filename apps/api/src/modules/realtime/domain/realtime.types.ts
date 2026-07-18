/**
 * Realtime channel identifiers.
 * Each channel maps to a permission resource (see realtime-channel.config.ts).
 */
export type RealtimeChannel =
  | 'queue'
  | 'dashboard'
  | 'notifications'
  | 'appointments'
  | 'patients'
  | 'workflows';

export const REALTIME_CHANNELS: RealtimeChannel[] = [
  'queue',
  'dashboard',
  'notifications',
  'appointments',
  'patients',
  'workflows',
];

/** Wire protocol envelope sent to clients. */
export interface RealtimeEnvelope<T = Record<string, unknown>> {
  /** Monotonic per-tenant sequence for reconnection replay. */
  sequence: number;
  /** Original domain event ID when applicable. */
  eventId: string;
  channel: RealtimeChannel;
  /** Dot-namespaced event type, e.g. `appointment.scheduled`. */
  type: string;
  tenantId: string;
  branchId: string | null;
  timestamp: string;
  payload: T;
}

/** Socket.IO event names (server ↔ client). */
export const RealtimeWsEvents = {
  /** Client → server: subscribe to channels */
  SUBSCRIBE: 'subscribe',
  /** Client → server: unsubscribe from channels */
  UNSUBSCRIBE: 'unsubscribe',
  /** Client → server: replay events since sequence */
  RESUME: 'resume',
  /** Client → server / server → client: heartbeat */
  PING: 'ping',
  PONG: 'pong',
  /** Server → client: pushed realtime event */
  EVENT: 'realtime.event',
  /** Server → client: subscription acknowledgement */
  SUBSCRIBED: 'subscribed',
  /** Server → client: replay batch after resume */
  REPLAY: 'replay',
  /** Server → client: error */
  ERROR: 'error',
  /** Server → client: connection established */
  CONNECTED: 'connected',
} as const;

export interface RealtimeSocketUser {
  sub: string;
  tenantId: string;
  branchId: string | null;
  roles: string[];
  sessionId: string;
  jti?: string;
}

export interface SubscribePayload {
  channels: RealtimeChannel[];
}

export interface ResumePayload {
  /** Replay events with sequence > lastSequence for subscribed channels. */
  lastSequence: number;
  channels?: RealtimeChannel[];
}
