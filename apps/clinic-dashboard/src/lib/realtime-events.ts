/** Mirror of backend RealtimeWsEvents for client use. */
export const RealtimeWsEvents = {
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  RESUME: 'resume',
  PING: 'ping',
  PONG: 'pong',
  EVENT: 'realtime.event',
  SUBSCRIBED: 'subscribed',
  REPLAY: 'replay',
  ERROR: 'error',
  CONNECTED: 'connected',
} as const;
