import { CANONICAL_RESOURCE_TO_MODULE } from '@booking/module-registry/dashboard';
import type { LicensedModuleId } from '@booking/module-registry';

/** Maps permission resource IDs to licensed module IDs for dashboard widget gating. */
export const RESOURCE_TO_MODULE_ID: Record<string, LicensedModuleId | 'core'> = {
  ...CANONICAL_RESOURCE_TO_MODULE,
};

export function resolveModuleIdForResource(resourceId?: string): LicensedModuleId | 'core' {
  if (!resourceId) return 'core';
  return RESOURCE_TO_MODULE_ID[resourceId] ?? 'core';
}
