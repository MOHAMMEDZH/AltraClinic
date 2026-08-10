import type { StatusTone } from '../ui';
import type { DashboardMetric, MetricStatus } from './types';

/** Maps a metric status to an accessible (text-backed) badge tone. */
export function statusTone(status: MetricStatus): StatusTone {
  switch (status) {
    case 'available':
      return 'success';
    case 'stale':
      return 'info';
    case 'degraded':
      return 'warning';
    case 'empty':
    case 'unavailable':
    case 'permission_limited':
    default:
      return 'neutral';
  }
}

export function statusLabelKey(status: MetricStatus): string {
  return `dashboard.status.${status}`;
}

/** i18n key for an unavailable metric's safe reason code. */
export function reasonLabelKey(reasonCode: string): string {
  return `dashboard.reasons.${reasonCode}`;
}

/**
 * True when the metric must NOT render a numeric value. Unavailable and
 * permission-limited metrics never show a number (Unavailable ≠ zero).
 */
export function hidesValue(metric: DashboardMetric): boolean {
  return (
    metric.status === 'unavailable' ||
    metric.status === 'permission_limited' ||
    metric.value === null
  );
}
