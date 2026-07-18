import { Injectable } from '@nestjs/common';
import { QuietHoursDecision } from './delivery.types';

export interface QuietHoursEvaluationInput {
  /** "HH:MM" 24h. If either is missing, no quiet hours are configured. */
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  /** Timezone precedence, most-specific wins: recipient > branch > tenant. */
  recipientTimezone?: string | null;
  branchTimezone?: string | null;
  tenantTimezone?: string | null;
  /** Consent stage already validated an emergency override — bypass quiet hours entirely. */
  emergencyOverrideBypass?: boolean;
  now?: Date;
  /** Minutes to defer by when the timezone is invalid and we fail closed. */
  invalidTimezoneDeferMinutes?: number;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseTime(value: string): { hour: number; minute: number } | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function isValidTimezone(timezone: string): boolean {
  try {
    // Throws RangeError for unknown/invalid IANA zone names.
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** Offset (minutes) such that `localTime = utcTime + offsetMinutes` for the given instant/zone. */
function getTimezoneOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour === '24' ? '0' : map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return (asUtc - date.getTime()) / 60_000;
}

/**
 * Resolves the effective timezone using most-specific-wins precedence:
 * recipient > branch > tenant > UTC fallback. Returns null if none supplied at all.
 */
export function resolveTimezone(input: Pick<QuietHoursEvaluationInput, 'recipientTimezone' | 'branchTimezone' | 'tenantTimezone'>): string {
  return input.recipientTimezone?.trim() || input.branchTimezone?.trim() || input.tenantTimezone?.trim() || 'UTC';
}

@Injectable()
export class QuietHoursService {
  evaluate(input: QuietHoursEvaluationInput): QuietHoursDecision {
    const now = input.now ?? new Date();

    if (input.emergencyOverrideBypass) {
      return {
        inQuietHours: false,
        deferUntil: null,
        timezoneUsed: null,
        bypassed: true,
        reason: 'emergency override bypasses quiet hours',
      };
    }

    if (!input.quietHoursStart || !input.quietHoursEnd) {
      return {
        inQuietHours: false,
        deferUntil: null,
        timezoneUsed: null,
        bypassed: false,
        reason: 'no quiet hours configured',
      };
    }

    const start = parseTime(input.quietHoursStart);
    const end = parseTime(input.quietHoursEnd);
    if (!start || !end) {
      return {
        inQuietHours: false,
        deferUntil: null,
        timezoneUsed: null,
        bypassed: false,
        reason: 'quiet hours configuration is malformed; ignoring',
      };
    }

    const timezone = resolveTimezone(input);
    if (!isValidTimezone(timezone)) {
      const deferMinutes = input.invalidTimezoneDeferMinutes ?? 60;
      return {
        inQuietHours: true,
        deferUntil: new Date(now.getTime() + deferMinutes * 60_000),
        timezoneUsed: null,
        bypassed: false,
        reason: `invalid timezone "${timezone}"; failing closed and deferring ${deferMinutes} minutes`,
      };
    }

    const offsetMinutes = getTimezoneOffsetMinutes(now, timezone);
    const localNow = new Date(now.getTime() + offsetMinutes * 60_000);
    const nowMinutesOfDay = localNow.getUTCHours() * 60 + localNow.getUTCMinutes();
    const startMinutes = start.hour * 60 + start.minute;
    const endMinutes = end.hour * 60 + end.minute;

    const spansMidnight = startMinutes > endMinutes;
    const inQuietHours = spansMidnight
      ? nowMinutesOfDay >= startMinutes || nowMinutesOfDay < endMinutes
      : nowMinutesOfDay >= startMinutes && nowMinutesOfDay < endMinutes;

    if (!inQuietHours) {
      return {
        inQuietHours: false,
        deferUntil: null,
        timezoneUsed: timezone,
        bypassed: false,
        reason: 'outside configured quiet hours window',
      };
    }

    let localEnd = new Date(
      Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate(), end.hour, end.minute, 0),
    );
    if (localEnd.getTime() <= localNow.getTime()) {
      localEnd = new Date(localEnd.getTime() + 24 * 60 * 60_000);
    }
    const deferUntil = new Date(localEnd.getTime() - offsetMinutes * 60_000);

    return {
      inQuietHours: true,
      deferUntil,
      timezoneUsed: timezone,
      bypassed: false,
      reason: `within quiet hours window ${input.quietHoursStart}-${input.quietHoursEnd} (${timezone})`,
    };
  }
}
