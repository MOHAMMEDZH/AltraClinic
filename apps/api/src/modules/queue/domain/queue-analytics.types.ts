import type { QueueMetricsSummary } from './queue.types';

export interface QueueAnalyticsSummary extends QueueMetricsSummary {
  transferredToday: number;
  noShowRate: number;
  completionRate: number;
}

export interface QueueHourlyThroughput {
  hour: string;
  completed: number;
  checkIns: number;
  avgWaitMinutes: number;
}

export interface QueuePeakHour {
  hour: string;
  totalActivity: number;
  completed: number;
  checkIns: number;
}

export interface QueueRoomUtilization {
  resourceId: string;
  resourceName: string;
  activeTickets: number;
  completedToday: number;
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

export interface QueueAnalyticsResponse {
  summary: QueueAnalyticsSummary;
  hourlyThroughput: QueueHourlyThroughput[];
  providerUtilization: QueueProviderUtilization[];
  peakHours: QueuePeakHour[];
  roomUtilization: QueueRoomUtilization[];
}
