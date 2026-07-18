import type { AppointmentStatus, CalendarViewMode } from '../types/scheduling.types';

export const SCHEDULING_PAGE_SIZE = 100;

export const APPOINTMENT_STATUS_OPTIONS: { value: AppointmentStatus | ''; labelKey: string }[] = [
  { value: '', labelKey: 'scheduling.filter.allStatuses' },
  { value: 'pending', labelKey: 'scheduling.status.pending' },
  { value: 'confirmed', labelKey: 'scheduling.status.confirmed' },
  { value: 'checked_in', labelKey: 'scheduling.status.checkedIn' },
  { value: 'in_progress', labelKey: 'scheduling.status.inProgress' },
  { value: 'completed', labelKey: 'scheduling.status.completed' },
  { value: 'cancelled', labelKey: 'scheduling.status.cancelled' },
  { value: 'no_show', labelKey: 'scheduling.status.noShow' },
];

export const DEFAULT_APPOINTMENT_DURATION_MIN = 30;

export const SERVICE_TYPE_OPTIONS: Array<{ id: string; labelKey: string; defaultDurationMin: number }> = [
  { id: 'consultation', labelKey: 'scheduling.serviceType.consultation', defaultDurationMin: 30 },
  { id: 'follow_up', labelKey: 'scheduling.serviceType.followUp', defaultDurationMin: 20 },
  { id: 'procedure', labelKey: 'scheduling.serviceType.procedure', defaultDurationMin: 60 },
  { id: 'cleaning', labelKey: 'scheduling.serviceType.cleaning', defaultDurationMin: 45 },
  { id: 'imaging', labelKey: 'scheduling.serviceType.imaging', defaultDurationMin: 30 },
  { id: 'lab', labelKey: 'scheduling.serviceType.lab', defaultDurationMin: 15 },
  { id: 'emergency', labelKey: 'scheduling.serviceType.emergency', defaultDurationMin: 30 },
];

export function formatServiceTypeLabel(
  serviceType: string | null | undefined,
  t: (key: string) => string,
): string {
  if (!serviceType) return t('scheduling.serviceType.unspecified');
  const opt = SERVICE_TYPE_OPTIONS.find((o) => o.id === serviceType);
  return opt ? t(opt.labelKey) : serviceType;
}

export function defaultDurationForServiceType(serviceType: string | null | undefined): number {
  const opt = SERVICE_TYPE_OPTIONS.find((o) => o.id === serviceType);
  return opt?.defaultDurationMin ?? DEFAULT_APPOINTMENT_DURATION_MIN;
}

export const CALENDAR_HOURS = { start: 7, end: 20 };

export const QUEUE_POLL_INTERVAL_MS = 15_000;

export function statusBadgeClass(status: AppointmentStatus): string {
  switch (status) {
    case 'pending':
      return 'badgePending';
    case 'confirmed':
      return 'badgeConfirmed';
    case 'checked_in':
      return 'badgeCheckedIn';
    case 'in_progress':
      return 'badgeInProgress';
    case 'completed':
      return 'badgeCompleted';
    case 'cancelled':
      return 'badgeCancelled';
    case 'no_show':
      return 'badgeNoShow';
    default:
      return 'badgePending';
  }
}

export function canCreateAppointment(perm: (action: string) => boolean): boolean {
  return perm('create');
}

export function canUpdateAppointment(perm: (action: string) => boolean): boolean {
  return perm('update');
}

export function canExportAppointments(perm: (action: string) => boolean): boolean {
  return perm('export');
}

export function canDeleteAppointment(perm: (action: string) => boolean): boolean {
  return perm('delete');
}

export const CLINICAL_PROVIDER_ROLES = new Set([
  'doctor',
  'dentist',
  'specialist',
  'nurse',
]);

export const CALENDAR_VIEW_MODES: CalendarViewMode[] = [
  'day',
  'week',
  'month',
  'resource',
  'timeline',
  'list',
];

export function parseCalendarView(value: string | null): CalendarViewMode {
  if (value && CALENDAR_VIEW_MODES.includes(value as CalendarViewMode)) {
    return value as CalendarViewMode;
  }
  return 'day';
}

/** Demo seed provider IDs → display labels when API has no provider name. */
export const DEMO_PROVIDER_LABELS: Record<string, string> = {
  'a1000000-0000-4000-8000-000000000002': 'Demo Owner',
  'a1000000-0000-4000-8000-000000000006': 'Demo Doctor',
  'a1000000-0000-4000-8000-000000000008': 'Demo Dentist',
  'a1000000-0000-4000-8000-000000000010': 'Demo Reception',
};

export function formatProviderLabel(providerId: string): string {
  return DEMO_PROVIDER_LABELS[providerId] ?? `Provider ${providerId.slice(0, 8)}…`;
}

export function parseAnchorDate(value: string | null): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function formatTimeRange(
  start: string,
  end: string,
  locale: string,
  timezone?: string,
): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  if (timezone) opts.timeZone = timezone;
  const fmt = new Intl.DateTimeFormat(locale, opts);
  return `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}`;
}

export function formatTimezoneLabel(timezone: string, locale: string): string {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    const tzName = parts.find((p) => p.type === 'timeZoneName')?.value;
    return tzName ? `${timezone} (${tzName})` : timezone;
  } catch {
    return timezone;
  }
}

export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

export function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function endOfMonth(d: Date): Date {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export function appointmentDurationMinutes(start: string, end: string): number {
  return Math.max(Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000), 5);
}

export function combineDateAndTime(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

export function addMinutesToIso(iso: string, minutes: number): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}
