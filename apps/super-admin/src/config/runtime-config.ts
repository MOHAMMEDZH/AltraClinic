/**
 * Step 05 — Super Admin runtime configuration (fail-closed defaults).
 * No secrets, tenant IDs, or authentication values.
 */

export type SuperAdminRuntimeEnv = 'development' | 'test' | 'production';

export interface SuperAdminRuntimeConfig {
  appName: string;
  environment: SuperAdminRuntimeEnv;
  /** Platform API base URL for authentication and future control-plane calls. */
  apiBaseUrl: string;
  phase: '47-platform-auth';
}

const ALLOWED_ENV: ReadonlySet<string> = new Set(['development', 'test', 'production']);

function normalizeEnv(raw: string | undefined): SuperAdminRuntimeEnv {
  const value = (raw ?? 'development').trim().toLowerCase();
  if (ALLOWED_ENV.has(value)) return value as SuperAdminRuntimeEnv;
  return 'development';
}

export function loadSuperAdminRuntimeConfig(
  env: ImportMetaEnv | Record<string, string | undefined> = import.meta.env,
): SuperAdminRuntimeConfig {
  const record = env as Record<string, string | undefined>;
  const appName = record.VITE_SUPER_ADMIN_APP_NAME?.trim() || 'Super Admin';
  return {
    appName,
    environment: normalizeEnv(record.VITE_SUPER_ADMIN_ENV),
    apiBaseUrl: (record.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '') || '/api',
    phase: '47-platform-auth',
  };
}

export function validateSuperAdminRuntimeConfig(
  config: SuperAdminRuntimeConfig,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!config.appName.trim()) {
    errors.push('appName is required');
  }
  if (!ALLOWED_ENV.has(config.environment)) {
    errors.push('environment must be development, test, or production');
  }
  if (!config.apiBaseUrl.startsWith('/') && !/^https?:\/\//.test(config.apiBaseUrl)) {
    errors.push('apiBaseUrl must be absolute http(s) or path-absolute');
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
