import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  connectRealtime,
  type RealtimeChannel,
  type RealtimeConnectionState,
} from '@/lib/realtime-client';

export function useDashboardRealtime(enabled = true) {
  const { getValidAccessToken } = useAuth();
  const qc = useQueryClient();
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>('disconnected');

  useEffect(() => {
    if (!enabled) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const token = await getValidAccessToken();
      if (!token || cancelled) return;

      cleanup = connectRealtime({
        token,
        channels: ['dashboard'] satisfies RealtimeChannel[],
        onStateChange: setConnectionState,
        onEvent: (event) => {
          const envelope = event as { channel?: string; type?: string };
          if (
            envelope.channel === 'dashboard' &&
            (envelope.type === 'dashboard.metrics_updated' ||
              envelope.type === 'dashboard.snapshot')
          ) {
            void qc.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
          }
        },
      });
    })();

    return () => {
      cancelled = true;
      cleanup?.();
      setConnectionState('disconnected');
    };
  }, [enabled, getValidAccessToken, qc]);

  return { connectionState };
}
