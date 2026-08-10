/**
 * Phase 46a/46e — runtime configuration (fail-closed defaults).
 */

export interface PatientPortalRuntimeConfig {
  centerEnabled: boolean;
  appointmentsEnabled: boolean;
  caregiverEnabled: boolean;
  apiBaseUrl: string;
  defaultLocale: string;
  appName: string;
  phase: '46e';
}

function envFlagTrue(raw: string | undefined): boolean {
  const value = (raw ?? 'false').trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

export function loadPatientPortalRuntimeConfig(
  env: ImportMetaEnv | Record<string, string | undefined> = import.meta.env,
): PatientPortalRuntimeConfig {
  const record = env as Record<string, string | undefined>;
  const centerEnabled = envFlagTrue(record.VITE_PATIENT_PORTAL_CENTER_ENABLED);
  return {
    centerEnabled,
    appointmentsEnabled:
      centerEnabled && envFlagTrue(record.VITE_PATIENT_PORTAL_APPOINTMENTS_ENABLED),
    caregiverEnabled:
      centerEnabled && envFlagTrue(record.VITE_PATIENT_PORTAL_CAREGIVER_ENABLED),
    apiBaseUrl: (record.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '') || '/api',
    defaultLocale: record.VITE_DEFAULT_LOCALE?.trim() || 'en',
    appName: 'Patient Portal',
    phase: '46e',
  };
}

export function validatePatientPortalRuntimeConfig(
  config: PatientPortalRuntimeConfig,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!config.apiBaseUrl.startsWith('/') && !/^https?:\/\//.test(config.apiBaseUrl)) {
    errors.push('apiBaseUrl must be absolute http(s) or path-absolute');
  }
  if (!config.defaultLocale.trim()) {
    errors.push('defaultLocale is required');
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
