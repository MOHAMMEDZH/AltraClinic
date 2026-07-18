import { apiRequest } from '@/lib/api-client';
import type {
  AppointmentDetail,
  AppointmentListResponse,
  CreateAppointmentPayload,
  ListAppointmentsParams,
  QueueTicket,
  SchedulingMetrics,
  SchedulingAnalytics,
  SchedulingServiceType,
  SchedulingResource,
  ResourceDayStatus,
  AppointmentTemplate,
  BulkRescheduleResult,
  UpdateAppointmentPayload,
  SchedulingProvider,
  AvailabilitySlot,
  WaitlistEntry,
  ScheduleDayHours,
  ProviderScheduleDay,
} from '../types/scheduling.types';

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function fetchAppointments(
  token: string,
  tenantId: string,
  params: ListAppointmentsParams = {},
): Promise<AppointmentListResponse> {
  return apiRequest<AppointmentListResponse>(
    `/scheduling/appointments${qs({
      q: params.q,
      status: params.status,
      branchId: params.branchId,
      providerId: params.providerId,
      patientId: params.patientId,
      from: params.from,
      to: params.to,
      limit: params.limit,
      offset: params.offset,
    })}`,
    { token, tenantId },
  );
}

export async function fetchAppointment(
  token: string,
  tenantId: string,
  appointmentId: string,
): Promise<AppointmentDetail> {
  return apiRequest<AppointmentDetail>(`/scheduling/appointments/${appointmentId}`, {
    token,
    tenantId,
  });
}

export async function fetchSchedulingMetrics(
  token: string,
  tenantId: string,
  from?: string,
  to?: string,
): Promise<SchedulingMetrics> {
  return apiRequest<SchedulingMetrics>(
    `/scheduling/appointments/metrics/summary${qs({ from, to })}`,
    { token, tenantId },
  );
}

export async function fetchSchedulingAnalytics(
  token: string,
  tenantId: string,
  from?: string,
  to?: string,
): Promise<SchedulingAnalytics> {
  return apiRequest<SchedulingAnalytics>(
    `/scheduling/appointments/metrics/analytics${qs({ from, to })}`,
    { token, tenantId },
  );
}

export async function fetchServiceTypes(
  token: string,
  tenantId: string,
): Promise<{ items: SchedulingServiceType[] }> {
  return apiRequest(`/scheduling/service-types`, { token, tenantId });
}

export async function fetchSchedulingResources(
  token: string,
  tenantId: string,
  branchId?: string,
  type?: string,
): Promise<{ items: SchedulingResource[] }> {
  return apiRequest(`/scheduling/resources${qs({ branchId, type })}`, { token, tenantId });
}

export async function fetchResourceDayStatus(
  token: string,
  tenantId: string,
  date: string,
  branchId?: string,
): Promise<{ date: string; items: ResourceDayStatus[] }> {
  return apiRequest(`/scheduling/resources/status${qs({ date, branchId })}`, { token, tenantId });
}

export async function fetchAppointmentTemplates(
  token: string,
  tenantId: string,
): Promise<{ items: AppointmentTemplate[] }> {
  return apiRequest('/scheduling/templates', { token, tenantId });
}

export async function createAppointmentTemplate(
  token: string,
  tenantId: string,
  payload: {
    name: string;
    serviceType?: string;
    durationMin?: number;
    providerId?: string;
    notes?: string;
    isEmergency?: boolean;
  },
): Promise<{ id: string }> {
  return apiRequest('/scheduling/templates', {
    method: 'POST',
    body: payload,
    token,
    tenantId,
  });
}

export async function deleteAppointmentTemplate(
  token: string,
  tenantId: string,
  id: string,
): Promise<{ id: string; deleted: boolean }> {
  return apiRequest(`/scheduling/templates/${id}`, { method: 'DELETE', token, tenantId });
}

export async function bulkRescheduleAppointments(
  token: string,
  tenantId: string,
  payload: { appointmentIds: string[]; shiftDays: number },
): Promise<BulkRescheduleResult> {
  return apiRequest('/scheduling/appointments/bulk/reschedule', {
    method: 'PATCH',
    body: payload,
    token,
    tenantId,
  });
}

export async function createAppointment(
  token: string,
  tenantId: string,
  payload: CreateAppointmentPayload,
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/scheduling/appointments', {
    method: 'POST',
    body: payload,
    token,
    tenantId,
  });
}

export async function updateAppointment(
  token: string,
  tenantId: string,
  appointmentId: string,
  payload: UpdateAppointmentPayload,
): Promise<AppointmentDetail> {
  return apiRequest<AppointmentDetail>(`/scheduling/appointments/${appointmentId}`, {
    method: 'PATCH',
    body: payload,
    token,
    tenantId,
  });
}

export async function deleteAppointment(
  token: string,
  tenantId: string,
  appointmentId: string,
): Promise<{ id: string; deleted: boolean }> {
  return apiRequest(`/scheduling/appointments/${appointmentId}`, {
    method: 'DELETE',
    token,
    tenantId,
  });
}

export async function fetchSchedulingProviders(
  token: string,
  tenantId: string,
  branchId?: string,
): Promise<{ items: SchedulingProvider[] }> {
  return apiRequest(`/scheduling/providers${qs({ branchId })}`, { token, tenantId });
}

export async function fetchAvailability(
  token: string,
  tenantId: string,
  params: { providerId: string; date: string; durationMin?: number; branchId?: string },
): Promise<{ slots: AvailabilitySlot[] }> {
  return apiRequest(`/scheduling/availability${qs(params)}`, { token, tenantId });
}

export async function fetchResourceAvailability(
  token: string,
  tenantId: string,
  params: { resourceId: string; date: string; durationMin?: number },
): Promise<{ slots: AvailabilitySlot[]; bookedCount: number }> {
  return apiRequest(`/scheduling/resources/availability${qs(params)}`, { token, tenantId });
}

export async function createInvoiceFromAppointment(
  token: string,
  tenantId: string,
  appointmentId: string,
): Promise<{ invoiceId: string; appointmentId: string }> {
  return apiRequest(`/scheduling/appointments/${encodeURIComponent(appointmentId)}/invoice`, {
    method: 'POST',
    token,
    tenantId,
  });
}

export async function fetchWaitlist(
  token: string,
  tenantId: string,
  status?: string,
): Promise<{ items: WaitlistEntry[] }> {
  return apiRequest(`/scheduling/waitlist${qs({ status })}`, { token, tenantId });
}

export async function createWaitlistEntry(
  token: string,
  tenantId: string,
  payload: {
    patientId: string;
    providerId?: string;
    preferredDate?: string;
    durationMin?: number;
    notes?: string;
  },
): Promise<{ id: string }> {
  return apiRequest('/scheduling/waitlist', {
    method: 'POST',
    body: payload,
    token,
    tenantId,
  });
}

export async function cancelWaitlistEntry(
  token: string,
  tenantId: string,
  id: string,
): Promise<{ id: string; status: string }> {
  return apiRequest(`/scheduling/waitlist/${id}`, {
    method: 'DELETE',
    token,
    tenantId,
  });
}

export async function bookWaitlistEntry(
  token: string,
  tenantId: string,
  id: string,
  payload: { start: string; end: string; providerId?: string },
): Promise<{ appointmentId: string; waitlistId: string }> {
  return apiRequest(`/scheduling/waitlist/${encodeURIComponent(id)}/book`, {
    method: 'POST',
    body: payload,
    token,
    tenantId,
  });
}

export async function fetchBranchHours(
  token: string,
  tenantId: string,
  branchId: string,
): Promise<{ branchId: string; items: ScheduleDayHours[] }> {
  return apiRequest(`/scheduling/branches/${encodeURIComponent(branchId)}/hours`, { token, tenantId });
}

export async function fetchSchedulingContext(
  token: string,
  tenantId: string,
): Promise<import('../types/scheduling.types').SchedulingContext> {
  return apiRequest('/scheduling/context', { token, tenantId });
}

export async function updateBranchHours(
  token: string,
  tenantId: string,
  branchId: string,
  days: ScheduleDayHours[],
): Promise<{ branchId: string; updated: number }> {
  return apiRequest(`/scheduling/branches/${encodeURIComponent(branchId)}/hours`, {
    method: 'PUT',
    body: { days },
    token,
    tenantId,
  });
}

export async function fetchProviderSchedule(
  token: string,
  tenantId: string,
  providerId: string,
): Promise<{ providerId: string; items: ProviderScheduleDay[] }> {
  return apiRequest(`/scheduling/providers/${encodeURIComponent(providerId)}/schedule`, {
    token,
    tenantId,
  });
}

export async function updateProviderSchedule(
  token: string,
  tenantId: string,
  providerId: string,
  days: ProviderScheduleDay[],
): Promise<{ providerId: string; updated: number }> {
  return apiRequest(`/scheduling/providers/${encodeURIComponent(providerId)}/schedule`, {
    method: 'PUT',
    body: { days },
    token,
    tenantId,
  });
}

export async function fetchWaitingQueue(
  token: string,
  tenantId: string,
  branchId?: string,
): Promise<QueueTicket[]> {
  return apiRequest<QueueTicket[]>(`/queue/waiting${qs({ branchId })}`, { token, tenantId });
}

export async function updateQueueStatus(
  token: string,
  tenantId: string,
  queueTicketId: string,
  status: 'serving' | 'completed' | 'skipped',
): Promise<{
  queueTicketId: string;
  status: string;
  checkedInAt: string | null;
  servedAt: string | null;
  completedAt: string | null;
}> {
  return apiRequest(`/queue/${queueTicketId}/status`, {
    method: 'PATCH',
    body: { status },
    token,
    tenantId,
  });
}

function todayAt(hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function todayEnd(hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Demo fallback when API unavailable */
export function createDemoAppointments(): AppointmentListResponse {
  return {
    total: 3,
    items: [
      {
        id: 'demo-a1',
        tenantId: 'demo',
        branchId: null,
        patientId: 'b1000000-0000-4000-8000-000000000001',
        patientName: 'Sarah Hassan',
        providerId: 'a1000000-0000-4000-8000-000000000002',
        start: todayAt(9, 0),
        end: todayEnd(9, 30),
        status: 'confirmed',
        notes: 'Follow-up consultation',
        serviceType: 'follow_up',
        isEmergency: false,
        recurrenceSeriesId: null,
        resourceId: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'demo-a2',
        tenantId: 'demo',
        branchId: null,
        patientId: 'b1000000-0000-4000-8000-000000000002',
        patientName: 'Omar Khalil',
        providerId: 'a1000000-0000-4000-8000-000000000002',
        start: todayAt(10, 30),
        end: todayEnd(11, 0),
        status: 'pending',
        notes: null,
        serviceType: 'consultation',
        isEmergency: false,
        recurrenceSeriesId: null,
        resourceId: null,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'demo-a3',
        tenantId: 'demo',
        branchId: null,
        patientId: 'b1000000-0000-4000-8000-000000000001',
        patientName: 'Sarah Hassan',
        providerId: 'a1000000-0000-4000-8000-000000000002',
        start: todayAt(14, 0),
        end: todayEnd(14, 45),
        status: 'pending',
        notes: 'Dental cleaning',
        serviceType: 'cleaning',
        isEmergency: false,
        recurrenceSeriesId: null,
        resourceId: null,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

export function createDemoAnalytics(): SchedulingAnalytics {
  return {
    total: 3,
    completed: 0,
    cancelled: 0,
    noShow: 0,
    emergency: 0,
    completionRate: 0,
    cancellationRate: 0,
    noShowRate: 0,
    dailyBreakdown: [
      { date: toDateInputValue(new Date()), total: 3, completed: 0, cancelled: 0, noShow: 0 },
    ],
    byServiceType: [
      { serviceType: 'consultation', count: 1 },
      { serviceType: 'follow_up', count: 1 },
      { serviceType: 'cleaning', count: 1 },
    ],
  };
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function createDemoMetrics(): SchedulingMetrics {
  return {
    total: 3,
    pending: 2,
    confirmed: 1,
    completed: 0,
    cancelled: 0,
    noShow: 0,
    utilizationPercent: 0,
  };
}

export function createDemoQueue(): QueueTicket[] {
  return [
    {
      queueTicketId: 'demo-q1',
      tenantId: 'demo',
      branchId: null,
      appointmentId: 'demo-a1',
      patientId: 'b1000000-0000-4000-8000-000000000001',
      providerId: 'a1000000-0000-4000-8000-000000000002',
      scheduledStart: todayAt(9, 0),
      scheduledEnd: todayEnd(9, 30),
      status: 'waiting',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}
