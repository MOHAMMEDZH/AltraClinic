/**
 * Least-privilege scopes a patient may delegate to a caregiver.
 * Phase 46d product surfaces enforce profile + appointments only.
 * Other scopes remain registered for future milestones and fail closed until enabled.
 */
export const CAREGIVER_ACCESS_SCOPES = [
  'profile',
  'appointments',
  'medical_records',
  'prescriptions',
  'billing',
  'messages',
] as const;

/** Scopes authorized for Phase 46d patient-safe product surfaces. */
export const CAREGIVER_MVP_SCOPES = ['profile', 'appointments'] as const;

export type CaregiverAccessScope = (typeof CAREGIVER_ACCESS_SCOPES)[number];
export type CaregiverMvpScope = (typeof CAREGIVER_MVP_SCOPES)[number];

export function isCaregiverAccessScope(value: unknown): value is CaregiverAccessScope {
  return typeof value === 'string' && (CAREGIVER_ACCESS_SCOPES as readonly string[]).includes(value);
}

export function isCaregiverMvpScope(value: unknown): value is CaregiverMvpScope {
  return typeof value === 'string' && (CAREGIVER_MVP_SCOPES as readonly string[]).includes(value);
}
