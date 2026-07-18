/**
 * Least-privilege scopes a patient may delegate to a caregiver. Each scope maps
 * to a read-only area of the patient portal (see INFORMATION_ARCHITECTURE.md §7).
 * Caregiver access is always read-only and consent-based; there is intentionally
 * no scope that grants write/booking/payment capability to a caregiver.
 */
export const CAREGIVER_ACCESS_SCOPES = [
  'appointments',
  'medical_records',
  'prescriptions',
  'billing',
  'messages',
] as const;

export type CaregiverAccessScope = (typeof CAREGIVER_ACCESS_SCOPES)[number];

export function isCaregiverAccessScope(value: unknown): value is CaregiverAccessScope {
  return typeof value === 'string' && (CAREGIVER_ACCESS_SCOPES as readonly string[]).includes(value);
}
