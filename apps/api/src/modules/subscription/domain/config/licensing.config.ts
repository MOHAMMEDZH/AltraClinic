import { SubscriptionPlanType } from '../value-objects/subscription-plan.vo';
import { UiSubscriptionPlan } from './plan-name.mapper';
import { PlanFeatures } from './plan-limits.config';

export type BackendFeatureName = keyof PlanFeatures;

/** How a licensed module appears to the tenant. */
export type ModuleAccessMode = 'enabled' | 'disabled' | 'hidden' | 'read_only' | 'preview';

/** Billing cycle identifiers. */
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly' | 'lifetime';

/** License lifecycle states derived from platform + subscription records. */
export type LicenseStatus =
  | 'active'
  | 'trial'
  | 'grace'
  | 'suspended'
  | 'cancelled'
  | 'expired'
  | 'provisioning';

export type LicensedModuleId =
  | 'dashboard'
  | 'patients'
  | 'scheduling'
  | 'queue'
  | 'emr'
  | 'dental'
  | 'beauty'
  | 'inventory'
  | 'billing'
  | 'reporting'
  | 'analytics'
  | 'workflow'
  | 'notifications'
  | 'ai'
  | 'userManagement'
  | 'settings'
  | 'patientPortal'
  | 'search'
  | 'media'
  | 'commission'
  | 'loyalty';

/** Minimum UI plan tier required for full module access. */
export interface LicensedModuleDefinition {
  id: LicensedModuleId;
  /** Lowest plan where module is fully enabled (not preview/read_only). */
  minPlan: UiSubscriptionPlan;
  /** Plans where module is visible but limited (preview/read_only). */
  previewFrom?: UiSubscriptionPlan;
}

export const LICENSED_MODULES: LicensedModuleDefinition[] = [
  { id: 'dashboard', minPlan: 'starter', previewFrom: 'starter' },
  { id: 'patients', minPlan: 'starter', previewFrom: 'starter' },
  { id: 'scheduling', minPlan: 'starter', previewFrom: 'starter' },
  { id: 'queue', minPlan: 'professional' },
  { id: 'emr', minPlan: 'professional' },
  { id: 'dental', minPlan: 'professional' },
  { id: 'beauty', minPlan: 'professional' },
  { id: 'inventory', minPlan: 'business' },
  { id: 'billing', minPlan: 'starter', previewFrom: 'starter' },
  { id: 'reporting', minPlan: 'starter', previewFrom: 'starter' },
  { id: 'analytics', minPlan: 'business' },
  { id: 'workflow', minPlan: 'business' },
  { id: 'notifications', minPlan: 'professional' },
  { id: 'ai', minPlan: 'starter', previewFrom: 'starter' },
  { id: 'userManagement', minPlan: 'starter' },
  { id: 'settings', minPlan: 'starter' },
  { id: 'patientPortal', minPlan: 'professional' },
  { id: 'search', minPlan: 'professional' },
  { id: 'media', minPlan: 'starter', previewFrom: 'starter' },
  { id: 'commission', minPlan: 'business' },
  { id: 'loyalty', minPlan: 'professional' },
];

/** Frontend feature flag keys (aligned with clinic-dashboard subscription-config). */
export type LicensedFeatureId =
  | 'dashboard'
  | 'patients'
  | 'scheduling'
  | 'billing'
  | 'reports'
  | 'aiChat'
  | 'medicalCopilot'
  | 'dentalCopilot'
  | 'reportingAi'
  | 'workflow'
  | 'analytics'
  | 'inventoryAi'
  | 'apiAccess'
  | 'integrations'
  | 'prioritySupport'
  | 'customBranding'
  | 'whiteLabel'
  | 'auditLogs'
  | 'customRoles'
  | 'multiProviderAi'
  | 'organizationKnowledge';

export type FeatureAccessState = 'enabled' | 'disabled' | 'limited' | 'upgrade';

export interface LicensedFeatureDefinition {
  id: LicensedFeatureId;
  /** Maps to backend PlanFeatures key when applicable. */
  backendFeature?: BackendFeatureName;
  plans: Record<UiSubscriptionPlan, FeatureAccessState>;
}

export const LICENSED_FEATURES: LicensedFeatureDefinition[] = [
  { id: 'dashboard', plans: { starter: 'enabled', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'patients', plans: { starter: 'limited', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'scheduling', plans: { starter: 'limited', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'billing', plans: { starter: 'limited', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'reports', plans: { starter: 'limited', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'aiChat', plans: { starter: 'enabled', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'medicalCopilot', plans: { starter: 'upgrade', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'dentalCopilot', plans: { starter: 'upgrade', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'reportingAi', plans: { starter: 'upgrade', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'workflow', backendFeature: 'customWorkflows', plans: { starter: 'disabled', professional: 'limited', business: 'enabled', enterprise: 'enabled' } },
  { id: 'analytics', backendFeature: 'advancedAnalytics', plans: { starter: 'disabled', professional: 'limited', business: 'enabled', enterprise: 'enabled' } },
  { id: 'inventoryAi', plans: { starter: 'disabled', professional: 'upgrade', business: 'enabled', enterprise: 'enabled' } },
  { id: 'apiAccess', plans: { starter: 'limited', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'integrations', plans: { starter: 'disabled', professional: 'limited', business: 'enabled', enterprise: 'enabled' } },
  { id: 'prioritySupport', plans: { starter: 'disabled', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'customBranding', plans: { starter: 'disabled', professional: 'disabled', business: 'limited', enterprise: 'enabled' } },
  { id: 'whiteLabel', plans: { starter: 'disabled', professional: 'disabled', business: 'disabled', enterprise: 'enabled' } },
  { id: 'auditLogs', backendFeature: 'auditExport', plans: { starter: 'disabled', professional: 'limited', business: 'enabled', enterprise: 'enabled' } },
  { id: 'customRoles', plans: { starter: 'disabled', professional: 'limited', business: 'enabled', enterprise: 'enabled' } },
  { id: 'multiProviderAi', backendFeature: 'aiModels', plans: { starter: 'disabled', professional: 'disabled', business: 'disabled', enterprise: 'enabled' } },
  { id: 'organizationKnowledge', plans: { starter: 'disabled', professional: 'disabled', business: 'limited', enterprise: 'enabled' } },
];

export const PLAN_TIER_ORDER: UiSubscriptionPlan[] = [
  'starter',
  'professional',
  'business',
  'enterprise',
];

export const DEFAULT_GRACE_PERIOD_DAYS = 7;
export const USAGE_WARNING_THRESHOLD = 80;
export const USAGE_CRITICAL_THRESHOLD = 95;

export function planTierIndex(plan: UiSubscriptionPlan): number {
  return PLAN_TIER_ORDER.indexOf(plan);
}

export function comparePlanTiers(
  current: UiSubscriptionPlan,
  target: UiSubscriptionPlan,
): 'upgrade' | 'downgrade' | 'same' {
  const ci = planTierIndex(current);
  const ti = planTierIndex(target);
  if (ci === ti) return 'same';
  return ti > ci ? 'upgrade' : 'downgrade';
}

export function featureStateForPlan(
  featureId: LicensedFeatureId,
  plan: UiSubscriptionPlan,
): FeatureAccessState {
  const row = LICENSED_FEATURES.find((f) => f.id === featureId);
  return row?.plans[plan] ?? 'disabled';
}

export function isFeatureAllowed(state: FeatureAccessState): boolean {
  return state === 'enabled' || state === 'limited';
}

export function moduleAccessForPlan(
  moduleId: LicensedModuleId,
  plan: UiSubscriptionPlan,
): ModuleAccessMode {
  const def = LICENSED_MODULES.find((m) => m.id === moduleId);
  if (!def) return 'hidden';

  const planIdx = planTierIndex(plan);
  const minIdx = planTierIndex(def.minPlan);
  const previewIdx = def.previewFrom ? planTierIndex(def.previewFrom) : minIdx;

  if (planIdx >= minIdx) return 'enabled';
  if (planIdx >= previewIdx) return 'preview';
  if (planIdx === minIdx - 1) return 'read_only';
  return 'disabled';
}

export function backendFeatureKeys(): BackendFeatureName[] {
  return Object.keys({
    aiModels: true,
    advancedAnalytics: true,
    loyaltyProgram: true,
    customWorkflows: true,
    multiCurrency: true,
    caregiverAccess: true,
    commissionRules: true,
    auditExport: true,
    smsInvites: true,
  } satisfies Record<BackendFeatureName, true>) as BackendFeatureName[];
}

export function mapUiFeatureToBackend(featureId: LicensedFeatureId): BackendFeatureName | null {
  const row = LICENSED_FEATURES.find((f) => f.id === featureId);
  return row?.backendFeature ?? null;
}

export function lostFeaturesOnDowngrade(
  from: UiSubscriptionPlan,
  to: UiSubscriptionPlan,
): LicensedFeatureDefinition[] {
  return LICENSED_FEATURES.filter((row) => {
    const fromState = row.plans[from];
    const toState = row.plans[to];
    return isFeatureAllowed(fromState) && !isFeatureAllowed(toState);
  });
}

export function gainedFeaturesOnUpgrade(
  from: UiSubscriptionPlan,
  to: UiSubscriptionPlan,
): LicensedFeatureDefinition[] {
  return LICENSED_FEATURES.filter((row) => {
    const fromState = row.plans[from];
    const toState = row.plans[to];
    return !isFeatureAllowed(fromState) && isFeatureAllowed(toState);
  });
}

export function lostModulesOnDowngrade(
  from: UiSubscriptionPlan,
  to: UiSubscriptionPlan,
): LicensedModuleDefinition[] {
  return LICENSED_MODULES.filter((mod) => {
    const fromAccess = moduleAccessForPlan(mod.id, from);
    const toAccess = moduleAccessForPlan(mod.id, to);
    return (fromAccess === 'enabled' || fromAccess === 'preview') && toAccess === 'disabled';
  });
}

/** Maps backend subscription plan to default UI plan when no override is stored. */
export function defaultUiPlanForBackend(backend: SubscriptionPlanType): UiSubscriptionPlan {
  if (backend === 'enterprise') return 'enterprise';
  if (backend === 'pro') return 'professional';
  return 'starter';
}
