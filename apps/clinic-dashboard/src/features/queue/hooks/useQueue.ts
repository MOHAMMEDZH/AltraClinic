import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { resolveOfflineQueryFallback } from '@/lib/query-fallback';
import {
  callNextPatient,
  checkInQueue,
  createDemoQueueBoard,
  createDemoQueueMetrics,
  createDemoQueueHistory,
  fetchQueueBoard,
  fetchQueueMetrics,
  fetchQueueHistory,
  assignQueueRoom,
  reorderQueue,
  transferQueueTicket,
  updateQueuePriority,
  updateQueueStatus,
  fetchQueueAnalytics,
  exportQueueCsv,
  walkInQueue,
  removeQueueTicket,
  createDemoQueueAnalytics,
  type QueueStatusUpdate,
} from '../api/queue-api';
import type { QueuePriority } from '../types/queue.types';
import { connectRealtime, type RealtimeConnectionState } from '@/lib/realtime-client';
import { QUEUE_POLL_INTERVAL_MS } from '../config/queue-config';

function authKeys(user: { tenantId: string } | null) {
  return [user?.tenantId ?? 'none'] as const;
}

export function useQueueBoard(branchId?: string | null, providerId?: string) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();

  return useQuery({
    queryKey: ['queue', 'board', ...authKeys(user), branchId, providerId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchQueueBoard(token, user.tenantId, branchId, providerId);
      } catch (err) {
        return resolveOfflineQueryFallback(err, online, createDemoQueueBoard);
      }
    },
    staleTime: 10_000,
    refetchInterval: QUEUE_POLL_INTERVAL_MS,
    placeholderData: (prev) => prev,
  });
}

export function useQueueMetrics(branchId?: string | null) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();

  return useQuery({
    queryKey: ['queue', 'metrics', ...authKeys(user), branchId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchQueueMetrics(token, user.tenantId, branchId);
      } catch (err) {
        return resolveOfflineQueryFallback(err, online, createDemoQueueMetrics);
      }
    },
    staleTime: 15_000,
    refetchInterval: QUEUE_POLL_INTERVAL_MS,
  });
}

export function useQueueRealtime(enabled = true) {
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
          const envelope = event as { channel?: string; type?: string };
          if (envelope.channel === 'queue') {
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

export function useUpdateQueueTicketStatus() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      queueTicketId,
      status,
    }: {
      queueTicketId: string;
      status: QueueStatusUpdate;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateQueueStatus(token, user.tenantId, queueTicketId, status);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['queue'] });
      void qc.invalidateQueries({ queryKey: ['scheduling', 'appointments'] });
      void qc.invalidateQueries({ queryKey: ['scheduling', 'appointment'] });
    },
  });
}

export function useCallNextPatient() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (params?: { branchId?: string; providerId?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return callNextPatient(
        token,
        user.tenantId,
        params?.branchId,
        params?.providerId,
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

export function useCheckInQueue() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return checkInQueue(token, user.tenantId, appointmentId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['queue'] });
      void qc.invalidateQueries({ queryKey: ['scheduling', 'appointments'] });
      void qc.invalidateQueries({ queryKey: ['scheduling', 'appointment'] });
    },
  });
}

export function useReorderQueue() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async ({ ticketIds, branchId }: { ticketIds: string[]; branchId?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return reorderQueue(token, user.tenantId, ticketIds, branchId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

export function useTransferQueueTicket() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      queueTicketId,
      providerId,
      branchId,
    }: {
      queueTicketId: string;
      providerId?: string;
      branchId?: string;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return transferQueueTicket(token, user.tenantId, queueTicketId, { providerId, branchId });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

export function useUpdateQueuePriority() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      queueTicketId,
      priority,
    }: {
      queueTicketId: string;
      priority: QueuePriority;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateQueuePriority(token, user.tenantId, queueTicketId, priority);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

export function useQueueAnalytics(
  branchId?: string | null,
  from?: string,
  to?: string,
) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();

  return useQuery({
    queryKey: ['queue', 'analytics', ...authKeys(user), branchId, from, to],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchQueueAnalytics(token, user.tenantId, branchId, from, to);
      } catch (err) {
        return resolveOfflineQueryFallback(err, online, createDemoQueueAnalytics);
      }
    },
    staleTime: 30_000,
  });
}

export function useQueueHistory(params: {
  branchId?: string | null;
  patientId?: string;
  providerId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 25;

  return useQuery({
    queryKey: [
      'queue',
      'history',
      ...authKeys(user),
      params.branchId,
      params.patientId,
      params.providerId,
      params.from,
      params.to,
      page,
      pageSize,
    ],
    enabled: (params.enabled ?? true) && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchQueueHistory(token, user.tenantId, {
          branchId: params.branchId,
          patientId: params.patientId,
          providerId: params.providerId,
          from: params.from,
          to: params.to,
          page,
          pageSize,
        });
      } catch (err) {
        return resolveOfflineQueryFallback(err, online, () => createDemoQueueHistory(page, pageSize));
      }
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useAssignQueueRoom() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      queueTicketId,
      resourceId,
    }: {
      queueTicketId: string;
      resourceId: string | null;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return assignQueueRoom(token, user.tenantId, queueTicketId, resourceId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

export function useRemoveQueueTicket() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (queueTicketId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return removeQueueTicket(token, user.tenantId, queueTicketId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['queue'] });
      void qc.invalidateQueries({ queryKey: ['scheduling', 'appointments'] });
    },
  });
}

export function useWalkInQueue() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (payload: {
      patientId: string;
      providerId: string;
      branchId?: string;
      priority?: QueuePriority;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return walkInQueue(token, user.tenantId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['queue'] });
      void qc.invalidateQueries({ queryKey: ['scheduling'] });
    },
  });
}

export async function downloadQueueExport(
  getToken: () => Promise<string | null>,
  tenantId: string,
  branchId?: string | null,
): Promise<void> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');
  const csv = await exportQueueCsv(token, tenantId, branchId);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `queue-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
