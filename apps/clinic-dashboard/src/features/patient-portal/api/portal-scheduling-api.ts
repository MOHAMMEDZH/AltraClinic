import { apiRequest } from '@/lib/api-client';
import type {
  AppointmentListResponse,
  AvailabilitySlot,
  SchedulingProvider,
} from '@/features/scheduling/types/scheduling.types';

export async function fetchMyAppointments(
  token: string,
  tenantId: string,
  params?: { from?: string; to?: string },
): Promise<AppointmentListResponse> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  const query = qs.toString();
  return apiRequest(`/patient-portal/me/appointments${query ? `?${query}` : ''}`, { token, tenantId });
}

export async function bookMyAppointment(
  token: string,
  tenantId: string,
  payload: { providerId: string; start: string; end: string; notes?: string; serviceType?: string },
) {
  return apiRequest('/patient-portal/me/appointments', {
    token,
    tenantId,
    method: 'POST',
    body: payload,
  });
}

export async function cancelMyAppointment(
  token: string,
  tenantId: string,
  appointmentId: string,
  cancellationReason?: string,
) {
  return apiRequest(`/patient-portal/me/appointments/${encodeURIComponent(appointmentId)}`, {
    token,
    tenantId,
    method: 'PATCH',
    body: { action: 'cancel', cancellationReason: cancellationReason ?? null },
  });
}

export async function rescheduleMyAppointment(
  token: string,
  tenantId: string,
  appointmentId: string,
  start: string,
  end: string,
) {
  return apiRequest(`/patient-portal/me/appointments/${encodeURIComponent(appointmentId)}`, {
    token,
    tenantId,
    method: 'PATCH',
    body: { start, end },
  });
}

export async function fetchMyProviders(
  token: string,
  tenantId: string,
): Promise<{ items: SchedulingProvider[] }> {
  return apiRequest('/patient-portal/me/providers', { token, tenantId });
}

export async function fetchMyAvailability(
  token: string,
  tenantId: string,
  params: { providerId: string; date: string; durationMin?: number },
): Promise<{ slots: AvailabilitySlot[] }> {
  const qs = new URLSearchParams({
    providerId: params.providerId,
    date: params.date,
  });
  if (params.durationMin) qs.set('durationMin', String(params.durationMin));
  return apiRequest(`/patient-portal/me/availability?${qs}`, { token, tenantId });
}
