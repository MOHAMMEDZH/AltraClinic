import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  connectRealtime,
  type RealtimeChannel,
  type RealtimeConnectionState,
} from '@/lib/realtime-client';

const WORKFLOW_INVALIDATION_TYPES = new Set([
  'workflow.created',
  'workflow.advanced',
  'workflow.canceled',
  'workflow.task.updated',
  'workflow.approval.updated',
]);

export function useWorkflowsRealtime(enabled = true) {
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
        channels: ['workflows'] satisfies RealtimeChannel[],
        onStateChange: setConnectionState,
        onEvent: (event) => {
          const envelope = event as { channel?: string; type?: string };
          if (
            envelope.channel === 'workflows' &&
            envelope.type &&
            WORKFLOW_INVALIDATION_TYPES.has(envelope.type)
          ) {
            void qc.invalidateQueries({ queryKey: ['workflows'] });
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
