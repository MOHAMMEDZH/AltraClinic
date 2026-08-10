export const CAREGIVER_GRANT_STATUSES = [
  'invited',
  'active',
  'declined',
  'revoked',
] as const;

export type CaregiverGrantStatus = (typeof CAREGIVER_GRANT_STATUSES)[number];

export function isCaregiverGrantStatus(value: unknown): value is CaregiverGrantStatus {
  return typeof value === 'string' && (CAREGIVER_GRANT_STATUSES as readonly string[]).includes(value);
}
