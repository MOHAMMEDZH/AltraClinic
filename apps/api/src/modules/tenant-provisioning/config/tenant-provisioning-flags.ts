/**
 * Flexible Step 17 containment — server-side only.
 * Default OFF. Frontend state never grants authority. Platform Owner cannot bypass.
 *
 * Enable for deployment: set TENANT_PROVISIONING_ENABLED=true in API process env
 * (and restart). Do not enable until Step 17 acceptance passes.
 */
export function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  const v = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return defaultValue;
}

/** Master gate for Step 17 routes and command handlers. Default false. */
export function isTenantProvisioningEnabled(): boolean {
  return envFlag('TENANT_PROVISIONING_ENABLED', false);
}

export const TENANT_PROVISIONING_DISABLED_CODE = 'tenant_provisioning_disabled';
export const TENANT_PROVISIONING_DISABLED_MESSAGE =
  'Tenant provisioning is disabled until Flexible Step 17 is explicitly enabled.';
