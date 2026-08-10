import {
  PATIENT_PORTAL_API_NAMESPACE,
  PATIENT_PORTAL_API_VERSION,
  PATIENT_PORTAL_APPOINTMENTS_ENABLED_ENV,
  PATIENT_PORTAL_BILLING_ENABLED_ENV,
  PATIENT_PORTAL_CAREGIVER_ENABLED_ENV,
  PATIENT_PORTAL_CENTER_ENABLED_ENV,
  PATIENT_PORTAL_DOCUMENTS_ENABLED_ENV,
  PATIENT_PORTAL_MESSAGING_ENABLED_ENV,
  PATIENT_PORTAL_METRICS_NAMESPACE,
  PATIENT_PORTAL_PAYMENTS_ENABLED_ENV,
  PATIENT_PORTAL_PROFILE_ENABLED_ENV,
  PATIENT_PORTAL_RECORDS_ENABLED_ENV,
  PATIENT_PORTAL_TRACE_NAMESPACE,
} from '../patient-portal.constants';

/**
 * Phase 46a configuration defaults.
 * No identity / enrollment / PHI runtime beyond flag registration.
 */

export interface PatientPortalFeatureFlags {
  centerEnabled: boolean;
  appointmentsEnabled: boolean;
  caregiverEnabled: boolean;
  profileEnabled: boolean;
  recordsEnabled: boolean;
  messagingEnabled: boolean;
  billingEnabled: boolean;
  paymentsEnabled: boolean;
  documentsEnabled: boolean;
}

export interface PatientPortalFoundationConfig {
  featureFlagEnv: string;
  featureEnabled: boolean;
  flags: PatientPortalFeatureFlags;
  apiNamespace: typeof PATIENT_PORTAL_API_NAMESPACE;
  apiVersion: typeof PATIENT_PORTAL_API_VERSION;
  metricsNamespace: string;
  traceNamespace: string;
}

function envFlagTrue(env: NodeJS.ProcessEnv, key: string): boolean {
  const raw = (env[key] ?? 'false').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function isPatientPortalCenterEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return envFlagTrue(env, PATIENT_PORTAL_CENTER_ENABLED_ENV);
}

export function isPatientPortalAppointmentsEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    isPatientPortalCenterEnabled(env) &&
    envFlagTrue(env, PATIENT_PORTAL_APPOINTMENTS_ENABLED_ENV)
  );
}

export function isPatientPortalCaregiverEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    isPatientPortalCenterEnabled(env) &&
    envFlagTrue(env, PATIENT_PORTAL_CAREGIVER_ENABLED_ENV)
  );
}

export function loadPatientPortalFeatureFlags(
  env: NodeJS.ProcessEnv = process.env,
): PatientPortalFeatureFlags {
  return {
    centerEnabled: isPatientPortalCenterEnabled(env),
    appointmentsEnabled: envFlagTrue(env, PATIENT_PORTAL_APPOINTMENTS_ENABLED_ENV),
    caregiverEnabled: envFlagTrue(env, PATIENT_PORTAL_CAREGIVER_ENABLED_ENV),
    profileEnabled: envFlagTrue(env, PATIENT_PORTAL_PROFILE_ENABLED_ENV),
    recordsEnabled: envFlagTrue(env, PATIENT_PORTAL_RECORDS_ENABLED_ENV),
    messagingEnabled: envFlagTrue(env, PATIENT_PORTAL_MESSAGING_ENABLED_ENV),
    billingEnabled: envFlagTrue(env, PATIENT_PORTAL_BILLING_ENABLED_ENV),
    paymentsEnabled: envFlagTrue(env, PATIENT_PORTAL_PAYMENTS_ENABLED_ENV),
    documentsEnabled: envFlagTrue(env, PATIENT_PORTAL_DOCUMENTS_ENABLED_ENV),
  };
}

export function loadPatientPortalFoundationConfig(
  env: NodeJS.ProcessEnv = process.env,
): PatientPortalFoundationConfig {
  const flags = loadPatientPortalFeatureFlags(env);
  return {
    featureFlagEnv: PATIENT_PORTAL_CENTER_ENABLED_ENV,
    featureEnabled: flags.centerEnabled,
    flags,
    apiNamespace: PATIENT_PORTAL_API_NAMESPACE,
    apiVersion: PATIENT_PORTAL_API_VERSION,
    metricsNamespace: PATIENT_PORTAL_METRICS_NAMESPACE,
    traceNamespace: PATIENT_PORTAL_TRACE_NAMESPACE,
  };
}
