import { LicensedFeatureId, LicensedModuleId } from './licensing.config';

/**
 * Maps licensed modules to their primary LicensedFeatureId for dual guard enforcement.
 * Module-only routes still require @RequireLicensedModule; this enables @RequireLicensedFeature parity.
 */
export const MODULE_PRIMARY_FEATURE: Partial<Record<LicensedModuleId, LicensedFeatureId>> = {
  dashboard: 'dashboard',
  patients: 'patients',
  scheduling: 'scheduling',
  billing: 'billing',
  reporting: 'reports',
  analytics: 'analytics',
  workflow: 'workflow',
  ai: 'aiChat',
};

/** LicensedFeatureId values with no dedicated backend API (UI / support SLA only). */
export const CLIENT_ONLY_LICENSED_FEATURES: LicensedFeatureId[] = ['prioritySupport'];
