/**
 * Phase 46c — patient portal scheduling API client (Scheduling facade only).
 */
import type { PortalHttpClient } from './api-client';

export interface PortalAppointment {
  id: string;
  branchId: string | null;
  providerId: string;
  start: string;
  end: string;
  status: string;
  serviceType: string | null;
  cancellationReason?: string | null;
  updatedAt?: string;
}

export interface PortalProvider {
  id: string;
  name: string;
}

export interface PortalAvailabilitySlot {
  start: string;
  end: string;
}

function authHeaders(accessToken: string, tenantId: string, idempotencyKey?: string) {
  return {
    accessToken,
    tenantId,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  };
}

export async function fetchMyAppointments(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
  params?: { from?: string; to?: string; scope?: 'upcoming' | 'past' | 'all'; branchId?: string },
): Promise<{ items: PortalAppointment[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.scope) qs.set('scope', params.scope);
  if (params?.branchId) qs.set('branchId', params.branchId);
  const query = qs.toString();
  return api.request(`/patient-portal/me/appointments${query ? `?${query}` : ''}`, {
    ...authHeaders(accessToken, tenantId),
  });
}

export async function fetchMyAppointment(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
  appointmentId: string,
): Promise<PortalAppointment> {
  return api.request(`/patient-portal/me/appointments/${encodeURIComponent(appointmentId)}`, {
    ...authHeaders(accessToken, tenantId),
  });
}

export async function bookMyAppointment(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
  payload: { providerId: string; start: string; end: string; notes?: string; serviceType?: string },
  idempotencyKey: string,
) {
  return api.request('/patient-portal/me/appointments', {
    method: 'POST',
    body: payload,
    ...authHeaders(accessToken, tenantId, idempotencyKey),
  });
}

export async function cancelMyAppointment(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
  appointmentId: string,
  idempotencyKey: string,
  cancellationReason?: string,
) {
  return api.request(`/patient-portal/me/appointments/${encodeURIComponent(appointmentId)}`, {
    method: 'PATCH',
    body: { action: 'cancel', cancellationReason: cancellationReason ?? null },
    ...authHeaders(accessToken, tenantId, idempotencyKey),
  });
}

export async function rescheduleMyAppointment(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
  appointmentId: string,
  start: string,
  end: string,
  idempotencyKey: string,
) {
  return api.request(`/patient-portal/me/appointments/${encodeURIComponent(appointmentId)}`, {
    method: 'PATCH',
    body: { start, end },
    ...authHeaders(accessToken, tenantId, idempotencyKey),
  });
}

export async function fetchMyProviders(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
  branchId?: string,
): Promise<{ items: PortalProvider[] }> {
  const qs = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
  return api.request(`/patient-portal/me/providers${qs}`, {
    ...authHeaders(accessToken, tenantId),
  });
}

export async function fetchMyAvailability(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
  params: { providerId: string; date: string; durationMin?: number },
): Promise<{ slots: PortalAvailabilitySlot[] }> {
  const qs = new URLSearchParams({
    providerId: params.providerId,
    date: params.date,
  });
  if (params.durationMin) qs.set('durationMin', String(params.durationMin));
  return api.request(`/patient-portal/me/availability?${qs}`, {
    ...authHeaders(accessToken, tenantId),
  });
}

export function createIdempotencyKey(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
