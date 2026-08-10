/**
 * Phase 46a — Patient Portal Center foundation constants.
 * Flag / contract registration only. No identity, enrollment, or PHI workflows.
 */

/** Master env feature flag (Architecture SSOT OD-FLAGS). Default OFF. */
export const PATIENT_PORTAL_CENTER_ENABLED_ENV = 'PATIENT_PORTAL_CENTER_ENABLED';

/**
 * Sub-feature flags (all default OFF).
 * Deferred-domain flags are registered dark only in 46a — no product implementation.
 */
export const PATIENT_PORTAL_APPOINTMENTS_ENABLED_ENV =
  'PATIENT_PORTAL_APPOINTMENTS_ENABLED';
export const PATIENT_PORTAL_CAREGIVER_ENABLED_ENV = 'PATIENT_PORTAL_CAREGIVER_ENABLED';
export const PATIENT_PORTAL_PROFILE_ENABLED_ENV = 'PATIENT_PORTAL_PROFILE_ENABLED';
export const PATIENT_PORTAL_RECORDS_ENABLED_ENV = 'PATIENT_PORTAL_RECORDS_ENABLED';
export const PATIENT_PORTAL_MESSAGING_ENABLED_ENV = 'PATIENT_PORTAL_MESSAGING_ENABLED';
export const PATIENT_PORTAL_BILLING_ENABLED_ENV = 'PATIENT_PORTAL_BILLING_ENABLED';
export const PATIENT_PORTAL_PAYMENTS_ENABLED_ENV = 'PATIENT_PORTAL_PAYMENTS_ENABLED';
export const PATIENT_PORTAL_DOCUMENTS_ENABLED_ENV = 'PATIENT_PORTAL_DOCUMENTS_ENABLED';

/** Public API namespace foundation (OD-API). */
export const PATIENT_PORTAL_API_NAMESPACE = 'patient-portal' as const;
export const PATIENT_PORTAL_API_VERSION = 'v1' as const;

/** Permission matrix resource id. */
export const PATIENT_PORTAL_PERMISSION_RESOURCE = 'api.patient_portal';

/** Licensed module id (subscription engine). */
export const PATIENT_PORTAL_LICENSED_MODULE = 'patientPortal' as const;

/** Tenant advanced policy gate (allowPatientPortal). */
export const PATIENT_PORTAL_TENANT_LICENSE_GATE = 'allowPatientPortal' as const;

/** Caregiver entitlement feature key on plan limits. */
export const PATIENT_PORTAL_CAREGIVER_LICENSE_FEATURE = 'caregiverAccess' as const;

export const PATIENT_PORTAL_LOG_KIND = 'patient_portal';
export const PATIENT_PORTAL_METRICS_NAMESPACE = 'patient_portal';
export const PATIENT_PORTAL_TRACE_NAMESPACE = 'patient_portal';

/** Health contributor ids (definitions only in 46a). */
export const PATIENT_PORTAL_HEALTH_CONTRIBUTORS = [
  'configuration',
  'feature_flags',
  'licensing',
  'rbac',
  'tenant_context',
  'branch_context',
  'white_label',
  'observability_hooks',
  'api_namespace',
] as const;

/** Metric name registry — hooks; no external backends. */
export const PATIENT_PORTAL_METRIC_NAMES = [
  'patient_portal.foundation.health_checks',
  'patient_portal.foundation.disabled_denies',
  'patient_portal.foundation.license_denies',
  'patient_portal.api.requests',
  'patient_portal.api.errors',
  'patient_portal.appointments.list',
  'patient_portal.appointments.detail',
  'patient_portal.appointments.availability',
  'patient_portal.appointments.book',
  'patient_portal.appointments.reschedule',
  'patient_portal.appointments.cancel',
  'patient_portal.appointments.conflicts',
  'patient_portal.appointments.stale_slot',
  'patient_portal.appointments.flag_denies',
  'patient_portal.caregiver.grants',
  'patient_portal.caregiver.authz_allows',
  'patient_portal.caregiver.authz_denies',
  'patient_portal.caregiver.scope_denies',
  'patient_portal.caregiver.delegated_requests',
  'patient_portal.profile.reads',
  'patient_portal.results_gate.denies',
  'patient_portal.experience.home',
  'patient_portal.preferences.updates',
  'patient_portal.branding.resolve',
] as const;

/** Patient-safe foundation error codes (no enumeration / no PHI). */
export const PATIENT_PORTAL_ERROR_CODES = {
  DISABLED: 'PATIENT_PORTAL_DISABLED',
  LICENSE_DENIED: 'PATIENT_PORTAL_LICENSE_DENIED',
  TENANT_REQUIRED: 'PATIENT_PORTAL_TENANT_REQUIRED',
  TENANT_MISMATCH: 'PATIENT_PORTAL_TENANT_MISMATCH',
  BRANCH_FILTER_INVALID: 'PATIENT_PORTAL_BRANCH_FILTER_INVALID',
  UNAVAILABLE: 'PATIENT_PORTAL_UNAVAILABLE',
  APPOINTMENTS_DISABLED: 'PATIENT_PORTAL_APPOINTMENTS_DISABLED',
  ENROLLMENT_INCOMPLETE: 'PATIENT_PORTAL_ENROLLMENT_INCOMPLETE',
  INVALID_SESSION: 'PATIENT_PORTAL_INVALID_SESSION',
  APPOINTMENT_NOT_FOUND: 'PATIENT_PORTAL_APPOINTMENT_NOT_FOUND',
  APPOINTMENT_ACCESS_DENIED: 'PATIENT_PORTAL_APPOINTMENT_ACCESS_DENIED',
  BOOKING_NOT_PERMITTED: 'PATIENT_PORTAL_BOOKING_NOT_PERMITTED',
  SLOT_UNAVAILABLE: 'PATIENT_PORTAL_SLOT_UNAVAILABLE',
  STALE_APPOINTMENT: 'PATIENT_PORTAL_STALE_APPOINTMENT',
  RESCHEDULE_NOT_PERMITTED: 'PATIENT_PORTAL_RESCHEDULE_NOT_PERMITTED',
  CANCEL_NOT_PERMITTED: 'PATIENT_PORTAL_CANCEL_NOT_PERMITTED',
  RATE_LIMITED: 'PATIENT_PORTAL_RATE_LIMITED',
  SCHEDULING_UNAVAILABLE: 'PATIENT_PORTAL_SCHEDULING_UNAVAILABLE',
  IDEMPOTENCY_MISMATCH: 'PATIENT_PORTAL_IDEMPOTENCY_MISMATCH',
  IDEMPOTENCY_REQUIRED: 'PATIENT_PORTAL_IDEMPOTENCY_KEY_REQUIRED',
  CAREGIVER_DISABLED: 'PATIENT_PORTAL_CAREGIVER_DISABLED',
  CAREGIVER_LICENSE_DENIED: 'PATIENT_PORTAL_CAREGIVER_LICENSE_DENIED',
  ACTING_CONTEXT_INVALID: 'PATIENT_PORTAL_ACTING_CONTEXT_INVALID',
  GRANT_NOT_FOUND: 'PATIENT_PORTAL_GRANT_NOT_FOUND',
  GRANT_DENIED: 'PATIENT_PORTAL_GRANT_DENIED',
  SCOPE_DENIED: 'PATIENT_PORTAL_SCOPE_DENIED',
  PROFILE_NOT_FOUND: 'PATIENT_PORTAL_PROFILE_NOT_FOUND',
  RESULTS_NOT_RELEASED: 'PATIENT_PORTAL_RESULTS_NOT_RELEASED',
  RESULTS_UNAVAILABLE: 'PATIENT_PORTAL_RESULTS_UNAVAILABLE',
} as const;
