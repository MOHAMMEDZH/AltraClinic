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
