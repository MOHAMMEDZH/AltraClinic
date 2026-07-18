import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { resolveOfflineQueryFallback } from '@/lib/query-fallback';
import {
  createAppointment,
  createDemoAppointments,
  createDemoAnalytics,
  createDemoMetrics,
  createDemoQueue,
  createWaitlistEntry,
  cancelWaitlistEntry,
  deleteAppointment,
  fetchAppointment,
  fetchAppointments,
  fetchAvailability,
  fetchSchedulingAnalytics,
  fetchSchedulingMetrics,
  fetchSchedulingProviders,
  fetchSchedulingResources,
  fetchResourceDayStatus,
  fetchResourceAvailability,
  createInvoiceFromAppointment,
  fetchAppointmentTemplates,
  createAppointmentTemplate,
  deleteAppointmentTemplate,
  bulkRescheduleAppointments,
  fetchServiceTypes,
  fetchWaitlist,
  fetchWaitingQueue,
  updateAppointment,
  bookWaitlistEntry,
  fetchBranchHours,
  updateBranchHours,
  fetchProviderSchedule,
  updateProviderSchedule,
  fetchSchedulingContext,
  updateQueueStatus,
} from '../api/scheduling-api';
import type {
  CreateAppointmentPayload,
  ListAppointmentsParams,
  ProviderScheduleDay,
  ScheduleDayHours,
  UpdateAppointmentPayload,
} from '../types/scheduling.types';
import { endOfDay, startOfDay } from '../config/scheduling-config';
import { QUEUE_POLL_INTERVAL_MS, SCHEDULING_PAGE_SIZE } from '../config/scheduling-config';
import {
  loadAppointmentListCache,
  saveAppointmentListCache,
} from '../lib/appointment-list-cache';

function authKeys(user: { tenantId: string } | null) {
  return [user?.tenantId ?? 'none'] as const;
}

export function useAppointmentsList(params: ListAppointmentsParams, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();

  return useQuery({
    queryKey: ['scheduling', 'appointments', ...authKeys(user), params],
    enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        const result = await fetchAppointments(token, user.tenantId, {
          limit: SCHEDULING_PAGE_SIZE,
          ...params,
        });
        saveAppointmentListCache({
          savedAt: new Date().toISOString(),
          items: result.items,
          total: result.total,
        });
        return result;
      } catch (err) {
        const cached = loadAppointmentListCache();
        if (cached) return { items: cached.items, total: cached.total };
        return resolveOfflineQueryFallback(err, online, createDemoAppointments);
      }
    },
    staleTime: 20_000,
    placeholderData: (prev) => prev,
  });
}

export function useAppointment(appointmentId: string | undefined) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['scheduling', 'appointment', appointmentId, ...authKeys(user)],
    enabled: Boolean(appointmentId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !appointmentId) throw new Error('Not authenticated');
      return fetchAppointment(token, user.tenantId, appointmentId);
    },
    staleTime: 15_000,
  });
}

export function useSchedulingMetrics(from?: string, to?: string) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();

  return useQuery({
    queryKey: ['scheduling', 'metrics', ...authKeys(user), from, to],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchSchedulingMetrics(token, user.tenantId, from, to);
      } catch (err) {
        return resolveOfflineQueryFallback(err, online, createDemoMetrics);
      }
    },
    staleTime: 30_000,
  });
}

export function useTodayMetrics() {
  const from = startOfDay(new Date()).toISOString();
  const to = endOfDay(new Date()).toISOString();
  return useSchedulingMetrics(from, to);
}

export function useSchedulingAnalytics(from?: string, to?: string) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();

  return useQuery({
    queryKey: ['scheduling', 'analytics', ...authKeys(user), from, to],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchSchedulingAnalytics(token, user.tenantId, from, to);
      } catch (err) {
        return resolveOfflineQueryFallback(err, online, createDemoAnalytics);
      }
    },
    staleTime: 30_000,
  });
}

export function useServiceTypes() {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['scheduling', 'service-types', ...authKeys(user)],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchServiceTypes(token, user.tenantId);
    },
    staleTime: 300_000,
  });
}

export function useSchedulingResources(branchId?: string) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['scheduling', 'resources', ...authKeys(user), branchId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchSchedulingResources(token, user.tenantId, branchId);
      } catch (err) {
        throw err;
      }
    },
    staleTime: 60_000,
  });
}

export function useResourceDayStatus(date: string, branchId?: string) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['scheduling', 'resource-status', ...authKeys(user), date, branchId],
    enabled: Boolean(date),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchResourceDayStatus(token, user.tenantId, date, branchId);
      } catch (err) {
        throw err;
      }
    },
    staleTime: 30_000,
  });
}

export function useAppointmentTemplates() {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['scheduling', 'templates', ...authKeys(user)],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchAppointmentTemplates(token, user.tenantId);
      } catch (err) {
        throw err;
      }
    },
    staleTime: 60_000,
  });
}

export function useCreateAppointmentTemplate() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (payload: {
      name: string;
      serviceType?: string;
      durationMin?: number;
      providerId?: string;
      notes?: string;
      isEmergency?: boolean;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createAppointmentTemplate(token, user.tenantId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['scheduling', 'templates'] });
    },
  });
}

export function useDeleteAppointmentTemplate() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return deleteAppointmentTemplate(token, user.tenantId, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['scheduling', 'templates'] });
    },
  });
}

export function useBulkRescheduleAppointments() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (payload: { appointmentIds: string[]; shiftDays: number }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return bulkRescheduleAppointments(token, user.tenantId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['scheduling'] });
    },
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (payload: CreateAppointmentPayload) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createAppointment(token, user.tenantId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['scheduling'] });
    },
  });
}

export function useUpdateAppointment() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      appointmentId,
      payload,
    }: {
      appointmentId: string;
      payload: UpdateAppointmentPayload;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateAppointment(token, user.tenantId, appointmentId, payload);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['scheduling'] });
      void qc.invalidateQueries({ queryKey: ['scheduling', 'appointment', vars.appointmentId] });
    },
  });
}

export function useDeleteAppointment() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return deleteAppointment(token, user.tenantId, appointmentId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['scheduling'] });
    },
  });
}

export function useSchedulingProviders(branchId?: string) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['scheduling', 'providers', ...authKeys(user), branchId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchSchedulingProviders(token, user.tenantId, branchId);
    },
    staleTime: 60_000,
  });
}

export function useResourceAvailability(
  params: { resourceId: string; date: string; durationMin?: number },
  enabled = true,
) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['scheduling', 'resource-availability', ...authKeys(user), params],
    enabled: enabled && Boolean(params.resourceId && params.date),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchResourceAvailability(token, user.tenantId, params);
    },
    staleTime: 30_000,
  });
}

export function useCreateInvoiceFromAppointment() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createInvoiceFromAppointment(token, user.tenantId, appointmentId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['billing'] });
    },
  });
}

export function useBookWaitlistEntry() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (payload: {
      id: string;
      start: string;
      end: string;
      providerId?: string;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return bookWaitlistEntry(token, user.tenantId, payload.id, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['scheduling', 'waitlist'] });
      void qc.invalidateQueries({ queryKey: ['scheduling', 'appointments'] });
    },
  });
}

export function useProviderSchedule(providerId: string | undefined) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['scheduling', 'provider-schedule', ...authKeys(user), providerId],
    enabled: Boolean(providerId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !providerId) throw new Error('Not authenticated');
      return fetchProviderSchedule(token, user.tenantId, providerId);
    },
    staleTime: 60_000,
  });
}

export function useUpdateProviderSchedule() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (payload: { providerId: string; days: ProviderScheduleDay[] }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateProviderSchedule(token, user.tenantId, payload.providerId, payload.days);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['scheduling', 'provider-schedule', ...authKeys(user), vars.providerId] });
      void qc.invalidateQueries({ queryKey: ['scheduling', 'availability'] });
    },
  });
}

export function useBranchHours(branchId: string | undefined) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['scheduling', 'branch-hours', ...authKeys(user), branchId],
    enabled: Boolean(branchId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !branchId) throw new Error('Not authenticated');
      return fetchBranchHours(token, user.tenantId, branchId);
    },
    staleTime: 60_000,
  });
}

export function useUpdateBranchHours() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (payload: { branchId: string; days: ScheduleDayHours[] }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateBranchHours(token, user.tenantId, payload.branchId, payload.days);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['scheduling', 'branch-hours', ...authKeys(user), vars.branchId] });
    },
  });
}

export function useSchedulingContext() {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['scheduling', 'context', ...authKeys(user)],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchSchedulingContext(token, user.tenantId);
    },
    staleTime: 300_000,
  });
}

export function useAvailability(
  params: { providerId: string; date: string; durationMin?: number; branchId?: string },
  enabled = true,
) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['scheduling', 'availability', ...authKeys(user), params],
    enabled: enabled && Boolean(params.providerId && params.date),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAvailability(token, user.tenantId, params);
    },
    staleTime: 30_000,
  });
}

export function useWaitlist(status?: string) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['scheduling', 'waitlist', ...authKeys(user), status],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchWaitlist(token, user.tenantId, status);
      } catch (err) {
        throw err;
      }
    },
    staleTime: 20_000,
  });
}

export function useCreateWaitlistEntry() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (payload: {
      patientId: string;
      providerId?: string;
      preferredDate?: string;
      durationMin?: number;
      notes?: string;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createWaitlistEntry(token, user.tenantId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['scheduling', 'waitlist'] });
    },
  });
}

export function useCancelWaitlistEntry() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return cancelWaitlistEntry(token, user.tenantId, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['scheduling', 'waitlist'] });
    },
  });
}

export function useWaitingQueue(branchId?: string) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();

  return useQuery({
    queryKey: ['queue', 'waiting', ...authKeys(user), branchId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchWaitingQueue(token, user.tenantId, branchId);
      } catch (err) {
        return resolveOfflineQueryFallback(err, online, createDemoQueue);
      }
    },
    refetchInterval: QUEUE_POLL_INTERVAL_MS,
    staleTime: 5_000,
    placeholderData: (prev) => prev,
  });
}

export function useUpdateQueueStatus() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async ({
      queueTicketId,
      status,
    }: {
      queueTicketId: string;
      status: 'serving' | 'completed' | 'skipped';
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateQueueStatus(token, user.tenantId, queueTicketId, status);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}
