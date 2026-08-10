/**
 * Flexible Step 19 containment — server-side only.
 * Default OFF. Frontend never grants authority. Platform Owner cannot bypass.
 */
export function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  const v = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return defaultValue;
}

export function isTenantLifecycleEnabled(): boolean {
  return envFlag('TENANT_LIFECYCLE_ENABLED', false);
}

export const TENANT_LIFECYCLE_DISABLED_CODE = 'tenant_lifecycle_disabled';
export const TENANT_LIFECYCLE_DISABLED_MESSAGE =
  'Tenant lifecycle mutations are disabled until Flexible Step 19 is explicitly enabled.';
