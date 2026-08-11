import {
  TRIAL_DEFAULT_DURATION_DAYS,
  TRIAL_DEFAULT_MAX_EXTENSIONS,
  TRIAL_MAX_EXTENSIONS_CEILING,
  TRIAL_MAX_INITIAL_DURATION_DAYS,
  TRIAL_MAX_SINGLE_EXTENSION_DAYS,
  TRIAL_MIN_DURATION_DAYS,
} from '../platform-sales-trials.constants';
import { SalesTrialValidationError } from '../domain/sales-trial.errors';

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Flexible Step 25 §5 — duration and extension policy.
 * Instant semantics: UTC TIMESTAMPTZ; expiry is exclusive (now >= expiresAt ⇒ expired).
 * No `0 = unlimited` duration or extension budget anywhere.
 */
export function resolveInitialDurationDays(input: {
  requestedDays?: number | null;
  planTrialDefaultEnabled?: boolean | null;
  planTrialDefaultDays?: number | null;
}): number {
  if (input.requestedDays != null) {
    assertInitialDurationDays(input.requestedDays);
    return input.requestedDays;
  }
  if (input.planTrialDefaultEnabled && input.planTrialDefaultDays != null) {
    const planDays = input.planTrialDefaultDays;
    if (
      Number.isInteger(planDays) &&
      planDays >= TRIAL_MIN_DURATION_DAYS &&
      planDays <= TRIAL_MAX_INITIAL_DURATION_DAYS
    ) {
      return planDays;
    }
  }
  return TRIAL_DEFAULT_DURATION_DAYS;
}

export function assertInitialDurationDays(days: number): void {
  if (!Number.isInteger(days)) {
    throw new SalesTrialValidationError('durationDays must be an integer.', 'duration_invalid');
  }
  if (days < TRIAL_MIN_DURATION_DAYS) {
    throw new SalesTrialValidationError(
      `durationDays must be at least ${TRIAL_MIN_DURATION_DAYS} (0 = unlimited is forbidden).`,
      'duration_below_minimum',
    );
  }
  if (days > TRIAL_MAX_INITIAL_DURATION_DAYS) {
    throw new SalesTrialValidationError(
      `durationDays must not exceed ${TRIAL_MAX_INITIAL_DURATION_DAYS}.`,
      'duration_above_maximum',
    );
  }
}

export function assertExtensionDays(days: number): void {
  if (!Number.isInteger(days)) {
    throw new SalesTrialValidationError('extensionDays must be an integer.', 'extension_invalid');
  }
  if (days < TRIAL_MIN_DURATION_DAYS) {
    throw new SalesTrialValidationError(
      `extensionDays must be at least ${TRIAL_MIN_DURATION_DAYS} (0 = unlimited is forbidden).`,
      'extension_below_minimum',
    );
  }
  if (days > TRIAL_MAX_SINGLE_EXTENSION_DAYS) {
    throw new SalesTrialValidationError(
      `extensionDays must not exceed ${TRIAL_MAX_SINGLE_EXTENSION_DAYS}.`,
      'extension_above_maximum',
    );
  }
}

export function resolveMaxExtensions(requested?: number | null): number {
  if (requested == null) return TRIAL_DEFAULT_MAX_EXTENSIONS;
  if (!Number.isInteger(requested)) {
    throw new SalesTrialValidationError('maxExtensions must be an integer.', 'max_extensions_invalid');
  }
  if (requested < 1) {
    throw new SalesTrialValidationError(
      'maxExtensions must be at least 1 (0 = unlimited is forbidden).',
      'max_extensions_unlimited_forbidden',
    );
  }
  if (requested > TRIAL_MAX_EXTENSIONS_CEILING) {
    throw new SalesTrialValidationError(
      `maxExtensions must not exceed ${TRIAL_MAX_EXTENSIONS_CEILING}.`,
      'max_extensions_above_ceiling',
    );
  }
  return requested;
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * MS_PER_DAY);
}

/** Expiry is exclusive after expiresAt: now >= expiresAt ⇒ expired. */
export function isExpiredAt(expiresAt: Date | null, now: Date): boolean {
  if (!expiresAt) return false;
  return now.getTime() >= expiresAt.getTime();
}
