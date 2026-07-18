export type QueueTicketStatus =
  | 'waiting'
  | 'called'
  | 'serving'
  | 'completed'
  | 'skipped'
  | 'no_show'
  | 'cancelled'
  | 'transferred';

export type QueuePriority =
  | 'normal'
  | 'appointment'
  | 'walk_in'
  | 'priority'
  | 'vip'
  | 'emergency';

export interface QueueBoardItem {
  queueTicketId: string;
  tenantId: string;
  branchId: string | null;
  appointmentId: string;
  patientId: string;
  patientName: string;
  providerId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: QueueTicketStatus;
  priority: QueuePriority;
  position: number | null;
  checkedInAt: string | null;
  calledAt: string | null;
  servedAt: string | null;
  completedAt: string | null;
  waitTimeSeconds: number | null;
  estimatedWaitMinutes: number | null;
  etaAt: string | null;
  resourceId: string | null;
  resourceName: string | null;
  elapsedWaitSeconds: number | null;
}

export interface QueueBoardResponse {
  waiting: QueueBoardItem[];
  called: QueueBoardItem[];
  serving: QueueBoardItem[];
  recentlyCompleted: QueueBoardItem[];
}

export interface QueueMetricsSummary {
  waiting: number;
  serving: number;
  called: number;
  completedToday: number;
  skippedToday: number;
  noShowToday: number;
  cancelledToday: number;
  avgWaitMinutes: number;
  throughputPerHour: number;
  longestWaitMinutes: number;
}

export interface QueueAnalyticsSummary extends QueueMetricsSummary {
  transferredToday: number;
  noShowRate: number;
  completionRate: number;
}

export interface QueueHourlyThroughput {
  hour: string;
  completed: number;
  checkIns?: number;
  avgWaitMinutes: number;
}

export interface QueuePeakHour {
  hour: string;
  totalActivity: number;
  completed: number;
  checkIns: number;
}

export interface QueueProviderUtilization {
  providerId: string;
  providerName: string;
  waiting: number;
  called: number;
  serving: number;
  completedToday: number;
  avgWaitMinutes: number;
  utilizationPercent: number;
}

export interface QueueRoomUtilization {
  resourceId: string;
  resourceName: string;
  activeTickets: number;
  completedToday: number;
}

export interface QueueAnalyticsResponse {
  summary: QueueAnalyticsSummary;
  hourlyThroughput: QueueHourlyThroughput[];
  providerUtilization: QueueProviderUtilization[];
  peakHours: QueuePeakHour[];
  roomUtilization: QueueRoomUtilization[];
}

export interface QueueHistoryItem {
  eventId: string;
  queueTicketId: string;
  patientId: string;
  patientName: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface QueueHistoryResponse {
  items: QueueHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export type QueueViewMode = 'reception' | 'doctor' | 'manager';

export interface QueueRealtimeEvent {
  channel: 'queue';
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}
