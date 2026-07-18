import type { QueuePriority, QueueTicketStatus, QueueViewMode } from '../types/queue.types';

export const QUEUE_POLL_INTERVAL_MS = 30_000;

export const QUEUE_STATUS_OPTIONS: { value: QueueTicketStatus | ''; labelKey: string }[] = [
  { value: '', labelKey: 'queue.filter.allStatuses' },
  { value: 'waiting', labelKey: 'queue.status.waiting' },
  { value: 'called', labelKey: 'queue.status.called' },
  { value: 'serving', labelKey: 'queue.status.serving' },
  { value: 'completed', labelKey: 'queue.status.completed' },
  { value: 'skipped', labelKey: 'queue.status.skipped' },
  { value: 'no_show', labelKey: 'queue.status.no_show' },
  { value: 'cancelled', labelKey: 'queue.status.cancelled' },
  { value: 'transferred', labelKey: 'queue.status.transferred' },
];

export const QUEUE_PRIORITY_OPTIONS: { value: QueuePriority; labelKey: string }[] = [
  { value: 'normal', labelKey: 'queue.priority.normal' },
  { value: 'appointment', labelKey: 'queue.priority.appointment' },
  { value: 'walk_in', labelKey: 'queue.priority.walkIn' },
  { value: 'priority', labelKey: 'queue.priority.priority' },
  { value: 'vip', labelKey: 'queue.priority.vip' },
  { value: 'emergency', labelKey: 'queue.priority.emergency' },
];

export const QUEUE_PRIORITY_FILTER_OPTIONS: { value: QueuePriority | ''; labelKey: string }[] = [
  { value: '', labelKey: 'queue.filter.allPriorities' },
  ...QUEUE_PRIORITY_OPTIONS,
];

export function statusBadgeClass(status: QueueTicketStatus): string {
  switch (status) {
    case 'waiting':
      return 'badgeWaiting';
    case 'called':
      return 'badgeCalled';
    case 'serving':
      return 'badgeServing';
    case 'completed':
      return 'badgeCompleted';
    case 'skipped':
      return 'badgeSkipped';
    case 'no_show':
      return 'badgeNoShow';
    case 'cancelled':
      return 'badgeCancelled';
    case 'transferred':
      return 'badgeTransferred';
    default:
      return 'badgeWaiting';
  }
}

export function priorityBadgeClass(priority: QueuePriority): string {
  switch (priority) {
    case 'emergency':
      return 'priorityEmergency';
    case 'vip':
      return 'priorityVip';
    case 'priority':
      return 'priorityHigh';
    case 'walk_in':
      return 'priorityWalkIn';
    case 'appointment':
      return 'priorityAppointment';
    default:
      return 'priorityNormal';
  }
}

export function canUpdateQueue(perm: (action: string) => boolean): boolean {
  return perm('update');
}

export function canManageQueue(perm: (action: string) => boolean): boolean {
  return perm('manage');
}

export function canExportQueue(perm: (action: string) => boolean): boolean {
  return perm('export');
}

export function canViewQueue(perm: (action: string) => boolean): boolean {
  return perm('view');
}

export function canSelectQueueBranch(roles: string[]): boolean {
  return roles.some((r) => ['super_admin', 'owner', 'general_manager'].includes(r));
}

export function resolveQueueViewMode(roles: string[]): QueueViewMode {
  if (roles.some((r) => ['doctor', 'dentist', 'specialist', 'nurse'].includes(r))) {
    return 'doctor';
  }
  if (roles.some((r) => ['owner', 'general_manager', 'super_admin'].includes(r))) {
    return 'manager';
  }
  return 'reception';
}

export function formatWaitMinutes(minutes: number | null | undefined, locale: string): string {
  if (minutes == null) return '—';
  return new Intl.NumberFormat(locale).format(minutes);
}

export function formatDurationSeconds(seconds: number | null | undefined, locale: string): string {
  if (seconds == null) return '—';
  const mins = Math.round(seconds / 60);
  return `${new Intl.NumberFormat(locale).format(mins)} min`;
}
