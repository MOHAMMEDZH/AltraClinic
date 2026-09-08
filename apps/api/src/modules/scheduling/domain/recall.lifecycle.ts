/**
 * Wave G / P1-13 / AR-17 — pure PatientRecallInstance transition + due helpers.
 * Appointment reminders / journey registry are delivery-only — not this SoR.
 */

export type PatientRecallLifecycleStatus =
  | 'DUE'
  | 'SNOOZED'
  | 'BOOKED'
  | 'COMPLETED'
  | 'OPTED_OUT';

const OPEN_STATUSES: ReadonlySet<PatientRecallLifecycleStatus> = new Set([
  'DUE',
  'SNOOZED',
  'BOOKED',
]);

/** Bounded eligibilityExpr keys only — no full rules engine. */
export interface BoundedRecallEligibilityExpr {
  minAgeYears?: number;
  requireLastService?: boolean;
}

export function parseBoundedEligibilityExpr(
  raw: unknown,
): BoundedRecallEligibilityExpr {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: BoundedRecallEligibilityExpr = {};
  if (typeof obj.minAgeYears === 'number' && Number.isFinite(obj.minAgeYears)) {
    out.minAgeYears = Math.max(0, Math.floor(obj.minAgeYears));
  }
  if (typeof obj.requireLastService === 'boolean') {
    out.requireLastService = obj.requireLastService;
  }
  return out;
}

export function computeDueAt(
  lastQualifyingServiceAt: Date,
  intervalDays: number,
): Date {
  const days = Math.max(1, Math.floor(intervalDays));
  return new Date(lastQualifyingServiceAt.getTime() + days * 24 * 60 * 60_000);
}

export function isDueAsOf(dueAt: Date, asOf: Date): boolean {
  return dueAt.getTime() <= asOf.getTime();
}

export function hasOpenRecallStatus(status: PatientRecallLifecycleStatus): boolean {
  return OPEN_STATUSES.has(status);
}

export function canSnooze(status: PatientRecallLifecycleStatus): boolean {
  return status === 'DUE' || status === 'SNOOZED';
}

export function canBook(status: PatientRecallLifecycleStatus): boolean {
  return status === 'DUE' || status === 'SNOOZED';
}

export function canComplete(status: PatientRecallLifecycleStatus): boolean {
  return status === 'BOOKED' || status === 'DUE';
}

export function canOptOut(status: PatientRecallLifecycleStatus): boolean {
  return status === 'DUE' || status === 'SNOOZED' || status === 'BOOKED';
}

export function patientPassesBoundedEligibility(input: {
  expr: BoundedRecallEligibilityExpr;
  dateOfBirth?: Date | null;
  lastQualifyingServiceAt?: Date | null;
  asOf: Date;
}): boolean {
  const { expr } = input;
  // Default require last qualifying service unless explicitly false.
  if (expr.requireLastService !== false && !input.lastQualifyingServiceAt) {
    return false;
  }
  if (expr.minAgeYears != null) {
    if (!input.dateOfBirth) return false;
    const ageMs = input.asOf.getTime() - input.dateOfBirth.getTime();
    const ageYears = ageMs / (365.25 * 24 * 60 * 60_000);
    if (ageYears < expr.minAgeYears) return false;
  }
  return true;
}
