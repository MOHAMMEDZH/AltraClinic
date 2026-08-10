/**
 * Projects Step 17 SNAPSHOT bundles into Clinic TenantLicense module/feature/limit shapes.
 * Never merges LEGACY matrices into SNAPSHOT results.
 */
import { UNLIMITED, type PlanFeatures, type PlanLimits } from '../../subscription/domain/config/plan-limits.config';
import {
  LICENSED_FEATURES,
  LICENSED_MODULES,
  type FeatureAccessState,
  type LicensedFeatureId,
  type LicensedModuleId,
  type ModuleAccessMode,
} from '../../subscription/domain/config/licensing.config';
import type { UiSubscriptionPlan } from '../../subscription/domain/config/plan-name.mapper';
import type { EffectiveEntitlementBundle, EffectiveLimit } from '../domain/effective-entitlement.types';
import {
  catalogKeyToLicensedFeatureId,
  catalogKeyToLicensedModuleId,
} from '../domain/snapshot-validation';

const LIMIT_FIELD_BY_KEY: Record<string, keyof Omit<PlanLimits, 'planName' | 'features'>> = {
  'limit.max_users': 'maxUsers',
  'limit.max_doctors': 'maxDoctors',
  'limit.max_branches': 'maxBranches',
  'limit.max_patients': 'maxPatients',
  'limit.max_appointments_per_month': 'maxAppointmentsPerMonth',
  'limit.max_reports_per_month': 'maxReportsPerMonth',
  'limit.max_storage_gb': 'maxStorageGb',
  'limit.max_api_requests_per_day': 'maxApiRequestsPerDay',
  'limit.max_email_per_month': 'maxEmailPerMonth',
  'limit.max_sms_per_month': 'maxSmsPerMonth',
  'limit.max_whatsapp_per_month': 'maxWhatsappPerMonth',
  'limit.max_push_per_month': 'maxPushPerMonth',
};

export function planCanonicalToBackendPlan(canonicalKey: string | undefined): string {
  switch (canonicalKey) {
    case 'plan.lite':
      return 'lite';
    case 'plan.pro':
      return 'pro';
    case 'plan.enterprise':
      return 'enterprise';
    default:
      return 'lite';
  }
}

export function planCanonicalToUiPlan(canonicalKey: string | undefined): UiSubscriptionPlan {
  switch (canonicalKey) {
    case 'plan.lite':
      return 'starter';
    case 'plan.pro':
      return 'professional';
    case 'plan.enterprise':
      return 'enterprise';
    default:
      return 'starter';
  }
}

export function projectModulesFromBundle(
  bundle: EffectiveEntitlementBundle,
): Record<LicensedModuleId, ModuleAccessMode> {
  const granted = new Set<string>();
  for (const key of bundle.modules) {
    const id = catalogKeyToLicensedModuleId(key);
    if (id) granted.add(id);
  }
  const modules = {} as Record<LicensedModuleId, ModuleAccessMode>;
  for (const mod of LICENSED_MODULES) {
    modules[mod.id] = granted.has(mod.id) ? 'enabled' : 'disabled';
  }
  return modules;
}

export function projectFeaturesFromBundle(
  bundle: EffectiveEntitlementBundle,
): Record<LicensedFeatureId, FeatureAccessState> {
  const granted = new Set<string>();
  for (const key of bundle.features) {
    const id = catalogKeyToLicensedFeatureId(key);
    if (id) granted.add(id);
  }
  const features = {} as Record<LicensedFeatureId, FeatureAccessState>;
  for (const row of LICENSED_FEATURES) {
    features[row.id] = granted.has(row.id) ? 'enabled' : 'disabled';
  }
  return features;
}

function limitToNumber(limit: EffectiveLimit | undefined): number | null {
  if (!limit) return null;
  if (limit.state === 'UNLIMITED') return UNLIMITED;
  if (limit.state === 'UNCONFIGURED') return null;
  const n = Number(limit.value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function projectPlanLimitsFromBundle(
  bundle: EffectiveEntitlementBundle,
  backendPlan: string,
  backendFeatures: PlanFeatures,
): PlanLimits {
  const limits: PlanLimits = {
    planName: backendPlan as PlanLimits['planName'],
    maxUsers: 0,
    maxDoctors: 0,
    maxBranches: 0,
    maxPatients: 0,
    maxAppointmentsPerMonth: 0,
    maxReportsPerMonth: 0,
    maxStorageGb: 0,
    maxApiRequestsPerDay: 0,
    maxEmailPerMonth: 0,
    maxSmsPerMonth: 0,
    maxWhatsappPerMonth: 0,
    maxPushPerMonth: 0,
    features: backendFeatures,
  };
  for (const [canonical, field] of Object.entries(LIMIT_FIELD_BY_KEY)) {
    const n = limitToNumber(bundle.limits[canonical]);
    if (n !== null) limits[field] = n;
  }
  return limits;
}

import { isRuntimeDenyCode } from '../domain/runtime-provenance';

/** @deprecated Prefer isRuntimeDenyCode — kept for LicensingEngineService import stability. */
export function isSnapshotDenyCode(code: string): boolean {
  return isRuntimeDenyCode(code);
}
