import { PATIENT_PORTAL_ERROR_CODES } from '../patient-portal.constants';

/**
 * Phase 46a/46c — patient-safe error contract helpers.
 * Never embed PHI, credentials, or account existence hints.
 */

export type PatientPortalErrorCode =
  (typeof PATIENT_PORTAL_ERROR_CODES)[keyof typeof PATIENT_PORTAL_ERROR_CODES];

export interface PatientPortalSafeErrorBody {
  code: PatientPortalErrorCode;
  message: string;
  correlationId?: string | null;
}

const SAFE_MESSAGES: Record<PatientPortalErrorCode, string> = {
  PATIENT_PORTAL_DISABLED: 'Patient Portal is not available',
  PATIENT_PORTAL_LICENSE_DENIED: 'Patient Portal is not licensed',
  PATIENT_PORTAL_TENANT_REQUIRED: 'Tenant context is required',
  PATIENT_PORTAL_TENANT_MISMATCH: 'Request could not be completed',
  PATIENT_PORTAL_BRANCH_FILTER_INVALID: 'Invalid branch filter',
  PATIENT_PORTAL_UNAVAILABLE: 'Patient Portal is temporarily unavailable',
  PATIENT_PORTAL_APPOINTMENTS_DISABLED: 'Patient Portal appointments are not available',
  PATIENT_PORTAL_ENROLLMENT_INCOMPLETE: 'Patient portal enrollment is incomplete',
  PATIENT_PORTAL_INVALID_SESSION: 'A valid patient session is required',
  PATIENT_PORTAL_APPOINTMENT_NOT_FOUND: 'Appointment not found',
  PATIENT_PORTAL_APPOINTMENT_ACCESS_DENIED: 'You cannot access this appointment',
  PATIENT_PORTAL_BOOKING_NOT_PERMITTED: 'Booking is not permitted',
  PATIENT_PORTAL_SLOT_UNAVAILABLE: 'The selected time slot is no longer available',
  PATIENT_PORTAL_STALE_APPOINTMENT: 'This appointment has changed. Refresh and try again',
  PATIENT_PORTAL_RESCHEDULE_NOT_PERMITTED: 'Rescheduling is not permitted for this appointment',
  PATIENT_PORTAL_CANCEL_NOT_PERMITTED: 'Cancellation is not permitted for this appointment',
  PATIENT_PORTAL_RATE_LIMITED: 'Too many requests. Please try again later',
  PATIENT_PORTAL_SCHEDULING_UNAVAILABLE: 'Scheduling is temporarily unavailable',
  PATIENT_PORTAL_IDEMPOTENCY_MISMATCH: 'Idempotency key was reused with a different request',
  PATIENT_PORTAL_IDEMPOTENCY_KEY_REQUIRED: 'Idempotency-Key header is required',
  PATIENT_PORTAL_CAREGIVER_DISABLED: 'Patient Portal caregiver access is not available',
  PATIENT_PORTAL_CAREGIVER_LICENSE_DENIED: 'Caregiver access is not licensed',
  PATIENT_PORTAL_ACTING_CONTEXT_INVALID: 'Acting context is invalid or missing',
  PATIENT_PORTAL_GRANT_NOT_FOUND: 'Caregiver grant not found',
  PATIENT_PORTAL_GRANT_DENIED: 'Caregiver grant is not active for this request',
  PATIENT_PORTAL_SCOPE_DENIED: 'Required caregiver scope is not granted',
  PATIENT_PORTAL_PROFILE_NOT_FOUND: 'Profile not found',
  PATIENT_PORTAL_RESULTS_NOT_RELEASED: 'Results are not available',
  PATIENT_PORTAL_RESULTS_UNAVAILABLE: 'Results are not available',
};

export function buildPatientPortalSafeError(
  code: PatientPortalErrorCode,
  correlationId?: string | null,
): PatientPortalSafeErrorBody {
  return {
    code,
    message: SAFE_MESSAGES[code],
    correlationId: correlationId ?? null,
  };
}

export function listPatientPortalErrorCodes(): readonly PatientPortalErrorCode[] {
  return Object.values(PATIENT_PORTAL_ERROR_CODES);
}
