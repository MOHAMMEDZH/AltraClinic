export const APPOINTMENT_REMINDER_TYPES = {
  HOURS_24: '24h',
  HOURS_1: '1h',
} as const;

export type AppointmentReminderType =
  (typeof APPOINTMENT_REMINDER_TYPES)[keyof typeof APPOINTMENT_REMINDER_TYPES];

/** Reminder windows: send when start is within [minMs, maxMs] from now. */
export const APPOINTMENT_REMINDER_WINDOWS: Array<{
  type: AppointmentReminderType;
  minMs: number;
  maxMs: number;
}> = [
  { type: APPOINTMENT_REMINDER_TYPES.HOURS_24, minMs: 23 * 60 * 60_000, maxMs: 25 * 60 * 60_000 },
  { type: APPOINTMENT_REMINDER_TYPES.HOURS_1, minMs: 45 * 60_000, maxMs: 75 * 60_000 },
];

export const APPOINTMENT_REMINDER_ELIGIBLE_STATUSES = ['PENDING', 'CONFIRMED'] as const;
