import { apiRequest, API_BASE } from '@/lib/api-client';
import type {
  QueueAnalyticsResponse,
  QueueBoardItem,
  QueueBoardResponse,
  QueueHistoryResponse,
  QueueMetricsSummary,
  QueuePriority,
} from '../types/queue.types';

function qs(params: Record<string, string | null | undefined>, opts?: { allowEmpty?: string[] }): string {
  const sp = new URLSearchParams();
  const allowEmpty = new Set(opts?.allowEmpty ?? []);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (v === null) {
      if (!allowEmpty.has(k)) continue;
      sp.set(k, '');
      continue;
    }
    if (v === '' && !allowEmpty.has(k)) continue;
    sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export async function fetchQueueBoard(
  token: string,
  tenantId: string,
  branchId?: string | null,
  providerId?: string,
): Promise<QueueBoardResponse> {
  const params: Record<string, string | null | undefined> = {};
  if (branchId !== undefined) params.branchId = branchId ?? '';
  if (providerId) params.providerId = providerId;
  const query =
    branchId === undefined && !providerId
      ? ''
      : qs(params, { allowEmpty: ['branchId'] });
  return apiRequest<QueueBoardResponse>(`/queue/board${query}`, { token, tenantId });
}

export async function fetchQueueMetrics(
  token: string,
  tenantId: string,
  branchId?: string | null,
): Promise<QueueMetricsSummary> {
  const query =
    branchId === undefined
      ? ''
      : qs({ branchId: branchId ?? '' }, { allowEmpty: ['branchId'] });
  return apiRequest<QueueMetricsSummary>(`/queue/metrics/summary${query}`, {
    token,
    tenantId,
  });
}

export async function checkInQueue(
  token: string,
  tenantId: string,
  appointmentId: string,
): Promise<QueueBoardItem> {
  return apiRequest<QueueBoardItem>('/queue/check-in', {
    method: 'POST',
    body: { appointmentId },
    token,
    tenantId,
  });
}

export async function callNextPatient(
  token: string,
  tenantId: string,
  branchId?: string,
  providerId?: string,
): Promise<QueueBoardItem> {
  return apiRequest<QueueBoardItem>(
    `/queue/call-next${qs({ branchId, providerId })}`,
    { method: 'POST', token, tenantId },
  );
}

export type QueueStatusUpdate =
  | 'called'
  | 'serving'
  | 'completed'
  | 'skipped'
  | 'cancelled'
  | 'no_show';

export async function updateQueueStatus(
  token: string,
  tenantId: string,
  queueTicketId: string,
  status: QueueStatusUpdate,
): Promise<unknown> {
  return apiRequest(`/queue/${queueTicketId}/status`, {
    method: 'PATCH',
    body: { status },
    token,
    tenantId,
  });
}

export async function reorderQueue(
  token: string,
  tenantId: string,
  ticketIds: string[],
  branchId?: string,
): Promise<QueueBoardResponse> {
  return apiRequest<QueueBoardResponse>('/queue/reorder', {
    method: 'POST',
    body: { ticketIds, branchId },
    token,
    tenantId,
  });
}

export async function transferQueueTicket(
  token: string,
  tenantId: string,
  queueTicketId: string,
  target: { providerId?: string; branchId?: string },
): Promise<QueueBoardItem> {
  return apiRequest<QueueBoardItem>(`/queue/${queueTicketId}/transfer`, {
    method: 'PATCH',
    body: target,
    token,
    tenantId,
  });
}

export async function updateQueuePriority(
  token: string,
  tenantId: string,
  queueTicketId: string,
  priority: QueuePriority,
): Promise<QueueBoardItem> {
  return apiRequest<QueueBoardItem>(`/queue/${queueTicketId}/priority`, {
    method: 'PATCH',
    body: { priority },
    token,
    tenantId,
  });
}

export async function fetchQueueAnalytics(
  token: string,
  tenantId: string,
  branchId?: string | null,
  from?: string,
  to?: string,
): Promise<QueueAnalyticsResponse> {
  const branchQuery =
    branchId === undefined
      ? qs({ from, to })
      : qs({ branchId: branchId ?? '', from, to }, { allowEmpty: ['branchId'] });
  return apiRequest(`/queue/analytics${branchQuery}`, { token, tenantId });
}

export async function exportQueueCsv(
  token: string,
  tenantId: string,
  branchId?: string | null,
): Promise<string> {
  const query =
    branchId === undefined
      ? ''
      : qs({ branchId: branchId ?? '' }, { allowEmpty: ['branchId'] });
  const headers = new Headers();
  headers.set('Accept', 'text/csv');
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('x-tenant-id', tenantId);
  const response = await fetch(`${API_BASE}/queue/export${query}`, {
    headers,
  });
  if (!response.ok) throw new Error('Export failed');
  return response.text();
}

export async function walkInQueue(
  token: string,
  tenantId: string,
  payload: { patientId: string; providerId: string; branchId?: string; priority?: QueuePriority },
): Promise<QueueBoardItem> {
  return apiRequest<QueueBoardItem>('/queue/walk-in', {
    method: 'POST',
    body: payload,
    token,
    tenantId,
  });
}

export async function removeQueueTicket(
  token: string,
  tenantId: string,
  queueTicketId: string,
): Promise<unknown> {
  return apiRequest(`/queue/${queueTicketId}`, {
    method: 'DELETE',
    token,
    tenantId,
  });
}

export async function assignQueueRoom(
  token: string,
  tenantId: string,
  queueTicketId: string,
  resourceId: string | null,
): Promise<QueueBoardItem> {
  return apiRequest<QueueBoardItem>(`/queue/${queueTicketId}/room`, {
    method: 'PATCH',
    body: { resourceId },
    token,
    tenantId,
  });
}

export async function fetchQueueHistory(
  token: string,
  tenantId: string,
  params?: {
    branchId?: string | null;
    patientId?: string;
    providerId?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<QueueHistoryResponse> {
  const branchId = params?.branchId;
  const queryParams: Record<string, string | null | undefined> = {
    patientId: params?.patientId,
    providerId: params?.providerId,
    from: params?.from,
    to: params?.to,
    page: params?.page != null ? String(params.page) : undefined,
    pageSize: params?.pageSize != null ? String(params.pageSize) : undefined,
  };
  if (branchId !== undefined) queryParams.branchId = branchId ?? '';
  const query = qs(queryParams, { allowEmpty: ['branchId'] });
  return apiRequest<QueueHistoryResponse>(`/queue/history${query}`, { token, tenantId });
}

function todayAt(h: number, m = 0): string {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

const demoItem = (overrides: Partial<QueueBoardItem>): QueueBoardItem => ({
  queueTicketId: 'demo-q1',
  tenantId: 'demo',
  branchId: null,
  appointmentId: 'demo-a1',
  patientId: 'b1000000-0000-4000-8000-000000000001',
  patientName: 'Sarah Hassan',
  providerId: 'a1000000-0000-4000-8000-000000000002',
  scheduledStart: todayAt(9),
  scheduledEnd: todayAt(9, 30),
  status: 'waiting',
  priority: 'appointment',
  position: 1,
  checkedInAt: new Date().toISOString(),
  calledAt: null,
  servedAt: null,
  completedAt: null,
  waitTimeSeconds: null,
  estimatedWaitMinutes: 5,
  etaAt: null,
  resourceId: null,
  resourceName: null,
  elapsedWaitSeconds: null,
  ...overrides,
});

export function createDemoQueueBoard(): QueueBoardResponse {
  return {
    waiting: [
      demoItem({ queueTicketId: 'demo-q1', position: 1, patientName: 'Sarah Hassan' }),
      demoItem({
        queueTicketId: 'demo-q2',
        position: 2,
        patientName: 'Omar Khalil',
        patientId: 'b1000000-0000-4000-8000-000000000002',
        scheduledStart: todayAt(10, 30),
        scheduledEnd: todayAt(11),
        checkedInAt: null,
        estimatedWaitMinutes: 12,
      }),
    ],
    called: [
      demoItem({
        queueTicketId: 'demo-q3',
        patientName: 'Layla Ahmad',
        status: 'called',
        position: null,
        calledAt: new Date().toISOString(),
      }),
    ],
    serving: [
      demoItem({
        queueTicketId: 'demo-q4',
        patientName: 'Karim Saleh',
        status: 'serving',
        position: null,
        servedAt: new Date().toISOString(),
        resourceId: 'demo-room-1',
        resourceName: 'Consultation Room 1',
        elapsedWaitSeconds: 420,
      }),
    ],
    recentlyCompleted: [],
  };
}

export function createDemoQueueMetrics(): QueueMetricsSummary {
  return {
    waiting: 2,
    called: 1,
    serving: 1,
    completedToday: 3,
    skippedToday: 0,
    noShowToday: 1,
    cancelledToday: 0,
    avgWaitMinutes: 8,
    throughputPerHour: 2,
    longestWaitMinutes: 15,
  };
}

export function createDemoQueueAnalytics(): QueueAnalyticsResponse {
  return {
    summary: {
      ...createDemoQueueMetrics(),
      transferredToday: 0,
      noShowRate: 5,
      completionRate: 88,
    },
    hourlyThroughput: [
      { hour: '09:00', completed: 2, avgWaitMinutes: 7 },
      { hour: '10:00', completed: 1, avgWaitMinutes: 12 },
      { hour: '11:00', completed: 0, avgWaitMinutes: 0 },
    ],
    providerUtilization: [
      {
        providerId: 'demo-p1',
        providerName: 'Dr. Demo',
        waiting: 2,
        called: 1,
        serving: 1,
        completedToday: 3,
        avgWaitMinutes: 8,
        utilizationPercent: 72,
      },
    ],
    peakHours: [
      { hour: '09:00', totalActivity: 8, completed: 2, checkIns: 4 },
      { hour: '10:00', totalActivity: 12, completed: 3, checkIns: 5 },
      { hour: '11:00', totalActivity: 6, completed: 1, checkIns: 2 },
    ],
    roomUtilization: [
      {
        resourceId: 'demo-room-1',
        resourceName: 'Consultation Room 1',
        activeTickets: 1,
        completedToday: 2,
      },
      {
        resourceId: 'demo-room-2',
        resourceName: 'Dental Suite A',
        activeTickets: 0,
        completedToday: 1,
      },
    ],
  };
}

export function createDemoQueueHistory(page = 1, pageSize = 25): QueueHistoryResponse {
  const now = new Date();
  const items = [
    {
      eventId: 'demo-ev-1',
      queueTicketId: 'demo-q4',
      patientId: 'b1000000-0000-4000-8000-000000000003',
      patientName: 'Karim Saleh',
      action: 'status_change',
      fromStatus: 'called',
      toStatus: 'serving',
      actorUserId: null,
      metadata: { resourceName: 'Consultation Room 1' },
      createdAt: now.toISOString(),
    },
    {
      eventId: 'demo-ev-2',
      queueTicketId: 'demo-q3',
      patientId: 'b1000000-0000-4000-8000-000000000004',
      patientName: 'Layla Ahmad',
      action: 'status_change',
      fromStatus: 'waiting',
      toStatus: 'called',
      actorUserId: null,
      metadata: null,
      createdAt: new Date(now.getTime() - 15 * 60_000).toISOString(),
    },
    {
      eventId: 'demo-ev-3',
      queueTicketId: 'demo-q2',
      patientId: 'b1000000-0000-4000-8000-000000000002',
      patientName: 'Omar Khalil',
      action: 'status_change',
      fromStatus: 'waiting',
      toStatus: 'no_show',
      actorUserId: null,
      metadata: null,
      createdAt: new Date(now.getTime() - 45 * 60_000).toISOString(),
    },
  ];
  return { items, total: items.length, page, pageSize };
}
