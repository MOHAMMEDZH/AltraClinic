import { io, Socket } from 'socket.io-client';
import { RealtimeWsEvents } from './realtime-events';

const REALTIME_BASE =
  import.meta.env.VITE_REALTIME_URL ??
  (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin);

export type RealtimeConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';
export type RealtimeChannel = 'queue' | 'dashboard' | 'notifications' | 'appointments' | 'patients' | 'workflows';

export interface RealtimeClientOptions {
  token: string;
  channels?: RealtimeChannel[];
  onEvent: (event: unknown) => void;
  onStateChange?: (state: RealtimeConnectionState) => void;
}

let sharedSocket: Socket | null = null;

function subscribeChannels(socket: Socket, channels: RealtimeChannel[]): void {
  if (channels.length > 0) {
    socket.emit(RealtimeWsEvents.SUBSCRIBE, { channels });
  }
}

export function connectRealtime(options: RealtimeClientOptions): () => void {
  const channels = options.channels ?? ['queue'];
  options.onStateChange?.('connecting');

  if (sharedSocket?.connected) {
    sharedSocket.disconnect();
  }

  const socket = io(`${REALTIME_BASE}/realtime`, {
    transports: ['websocket', 'polling'],
    auth: { token: options.token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });

  sharedSocket = socket;

  socket.on('connect', () => {
    options.onStateChange?.('connected');
    subscribeChannels(socket, channels);
  });

  socket.on('disconnect', () => {
    options.onStateChange?.('disconnected');
  });

  socket.on('connect_error', () => {
    options.onStateChange?.('error');
  });

  socket.on(RealtimeWsEvents.EVENT, (event: unknown) => {
    options.onEvent(event);
  });

  socket.on(RealtimeWsEvents.CONNECTED, () => {
    subscribeChannels(socket, channels);
  });

  return () => {
    socket.off();
    socket.disconnect();
    if (sharedSocket === socket) sharedSocket = null;
  };
}

export function disconnectRealtime(): void {
  sharedSocket?.disconnect();
  sharedSocket = null;
}
