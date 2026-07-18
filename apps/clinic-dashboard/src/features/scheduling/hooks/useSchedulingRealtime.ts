import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import { connectRealtime, type RealtimeConnectionState } from '@/lib/realtime-client';

export function useSchedulingRealtime(enabled = true) {
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
        onStateChange: setConnectionState,
        onEvent: (event) => {
          const envelope = event as { channel?: string };
          if (envelope.channel === 'appointments' || envelope.channel === 'queue') {
            void qc.invalidateQueries({ queryKey: ['scheduling'] });
            void qc.invalidateQueries({ queryKey: ['queue'] });
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
