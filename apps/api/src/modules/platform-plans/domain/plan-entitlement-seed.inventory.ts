/**
 * Step 14 — exact Draft entitlement/Limit seed inventory from runtime licensing SSOT.
 * Maps plan.lite|pro|enterprise → starter|professional|enterprise UI tiers.
 * Does NOT seed Facility Types or Specialties as commercial grants.
 * Does NOT invent business-tier Plan alias assignments.
 */
import {
  LICENSED_FEATURES,
  LICENSED_MODULES,
  featureStateForPlan,
  isFeatureAllowed,
  moduleAccessForPlan,
  type LicensedFeatureId,
  type LicensedModuleId,
  type UiSubscriptionPlan,
} from '../../subscription/domain/config/licensing.config';
import {
  PLAN_LIMITS,
  UNLIMITED,
  type PlanLimits,
} from '../../subscription/domain/config/plan-limits.config';
import type { SubscriptionPlanType } from '../../subscription/domain/value-objects/subscription-plan.vo';

export type CanonicalPlanKey = 'plan.lite' | 'plan.pro' | 'plan.enterprise';

export const ENTITLEMENT_ELIGIBLE_KINDS = ['MODULE', 'FEATURE'] as const;
export type EntitlementEligibleKind = (typeof ENTITLEMENT_ELIGIBLE_KINDS)[number];

export const PLAN_KEY_TO_UI_TIER: Record<CanonicalPlanKey, UiSubscriptionPlan> = {
  'plan.lite': 'starter',
  'plan.pro': 'professional',
  'plan.enterprise': 'enterprise',
};

export const PLAN_KEY_TO_LIMITS: Record<CanonicalPlanKey, SubscriptionPlanType> = {
  'plan.lite': 'lite',
  'plan.pro': 'pro',
  'plan.enterprise': 'enterprise',
};

function camelToSnakeModule(id: string): string {
  return `module.${id.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
}

function camelToSnakeFeature(id: string): string {
  return `feature.${id.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
}

function camelToSnakeLimit(id: string): string {
  return `limit.${id.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
}

export interface SeedEntitlementMapping {
  legacyPlan: CanonicalPlanKey;
  legacyIdentifier: string;
  canonicalCatalogKey: string;
  catalogKind: EntitlementEligibleKind;
  source: string;
  runtimeMeaning: string;
  explicitOrDerived: 'explicit';
  confidence: 'high';
  seedDecision: 'seed_draft';
  unresolvedAmbiguity: null;
}

export interface SeedLimitMapping {
  legacyPlan: CanonicalPlanKey;
  legacyIdentifier: string;
  canonicalCatalogKey: string;
  currentValue: number;
  unlimited: boolean;
  valueText: string | null;
  valueType: 'INTEGER' | 'COUNT';
  source: 'plan-limits.config.ts';
  confidence: 'high';
  seedDecision: 'seed_draft';
  unresolvedAmbiguity: null;
}

export interface UnresolvedMapping {
  legacyPlan: string | '*';
  legacyIdentifier: string;
  reason: string;
  seedDecision: 'do_not_seed';
}

/** Modules enabled for the Plan's UI tier (exact minPlan index mapping). */
export function seededModuleKeysForPlan(planKey: CanonicalPlanKey): string[] {
  const ui = PLAN_KEY_TO_UI_TIER[planKey];
  return LICENSED_MODULES.filter(
    (m) => moduleAccessForPlan(m.id as LicensedModuleId, ui) === 'enabled',
  ).map((m) => camelToSnakeModule(m.id));
}

/** Features with enabled|limited access for the Plan's UI tier. */
export function seededFeatureKeysForPlan(planKey: CanonicalPlanKey): string[] {
  const ui = PLAN_KEY_TO_UI_TIER[planKey];
  return LICENSED_FEATURES.filter((f) =>
    isFeatureAllowed(featureStateForPlan(f.id as LicensedFeatureId, ui)),
  ).map((f) => camelToSnakeFeature(f.id));
}

export function seededEntitlementKeysForPlan(planKey: CanonicalPlanKey): string[] {
  return [...seededModuleKeysForPlan(planKey), ...seededFeatureKeysForPlan(planKey)].sort();
}

export function seededLimitsForPlan(planKey: CanonicalPlanKey): SeedLimitMapping[] {
  const limitsKey = PLAN_KEY_TO_LIMITS[planKey];
  const row: PlanLimits = PLAN_LIMITS[limitsKey];
  const entries: Array<[string, number]> = [
    ['maxUsers', row.maxUsers],
    ['maxDoctors', row.maxDoctors],
    ['maxBranches', row.maxBranches],
    ['maxPatients', row.maxPatients],
    ['maxAppointmentsPerMonth', row.maxAppointmentsPerMonth],
    ['maxReportsPerMonth', row.maxReportsPerMonth],
    ['maxStorageGb', row.maxStorageGb],
    ['maxApiRequestsPerDay', row.maxApiRequestsPerDay],
    ['maxEmailPerMonth', row.maxEmailPerMonth],
    ['maxSmsPerMonth', row.maxSmsPerMonth],
    ['maxWhatsappPerMonth', row.maxWhatsappPerMonth],
    ['maxPushPerMonth', row.maxPushPerMonth],
  ];
  return entries.map(([legacyIdentifier, currentValue]) => {
    const unlimited = currentValue === UNLIMITED;
    return {
      legacyPlan: planKey,
      legacyIdentifier,
      canonicalCatalogKey: camelToSnakeLimit(legacyIdentifier),
      currentValue,
      unlimited,
      valueText: unlimited ? null : String(currentValue),
      valueType: legacyIdentifier === 'maxStorageGb' ? 'INTEGER' : 'COUNT',
      source: 'plan-limits.config.ts',
      confidence: 'high',
      seedDecision: 'seed_draft',
      unresolvedAmbiguity: null,
    };
  });
}

export function entitlementMappingMatrix(): SeedEntitlementMapping[] {
  const out: SeedEntitlementMapping[] = [];
  for (const planKey of Object.keys(PLAN_KEY_TO_UI_TIER) as CanonicalPlanKey[]) {
    const ui = PLAN_KEY_TO_UI_TIER[planKey];
    for (const m of LICENSED_MODULES) {
      if (moduleAccessForPlan(m.id as LicensedModuleId, ui) !== 'enabled') continue;
      out.push({
        legacyPlan: planKey,
        legacyIdentifier: m.id,
        canonicalCatalogKey: camelToSnakeModule(m.id),
        catalogKind: 'MODULE',
        source: 'licensing.config.ts#LICENSED_MODULES',
        runtimeMeaning: `moduleAccessForPlan(${m.id}, ${ui}) === enabled`,
        explicitOrDerived: 'explicit',
        confidence: 'high',
        seedDecision: 'seed_draft',
        unresolvedAmbiguity: null,
      });
    }
    for (const f of LICENSED_FEATURES) {
      if (!isFeatureAllowed(featureStateForPlan(f.id as LicensedFeatureId, ui))) continue;
      out.push({
        legacyPlan: planKey,
        legacyIdentifier: f.id,
        canonicalCatalogKey: camelToSnakeFeature(f.id),
        catalogKind: 'FEATURE',
        source: 'licensing.config.ts#LICENSED_FEATURES',
        runtimeMeaning: `featureStateForPlan(${f.id}, ${ui}) in enabled|limited`,
        explicitOrDerived: 'explicit',
        confidence: 'high',
        seedDecision: 'seed_draft',
        unresolvedAmbiguity: null,
      });
    }
  }
  return out;
}

export const UNRESOLVED_ENTITLEMENT_MAPPINGS: UnresolvedMapping[] = [
  {
    legacyPlan: '*',
    legacyIdentifier: 'facility_type.* / specialty.*',
    reason:
      'Catalog Facility Types and Specialties are eligibility selectors, not commercial Plan grants in current LicensingEngineService.',
    seedDecision: 'do_not_seed',
  },
  {
    legacyPlan: '*',
    legacyIdentifier: 'business UI tier',
    reason:
      'business remains Option B unresolved non-Plan UI tier; not a Platform Plan; not seeded as plan.business.',
    seedDecision: 'do_not_seed',
  },
  {
    legacyPlan: '*',
    legacyIdentifier: 'PlanFeatures.loyaltyProgram|multiCurrency|caregiverAccess|commissionRules|smsInvites',
    reason:
      'Orphan PlanFeatures boolean keys without exact LICENSED_FEATURES id mapping; not fabricated as Feature entitlements.',
    seedDecision: 'do_not_seed',
  },
  {
    legacyPlan: 'plan.pro',
    legacyIdentifier: 'modules with minPlan=business (inventory, analytics, workflow, commission)',
    reason:
      'Exact mapping places these only on enterprise (and business UI tier which is not a Plan). pro Draft does not include them.',
    seedDecision: 'do_not_seed',
  },
];

export const DRAFT_VERSION_TRANSLATIONS = [
  {
    locale: 'en-US' as const,
    releaseLabel: 'Commercial definition draft (Step 14 seed)',
    shortDescription:
      'Seeded explicit entitlements and Limits from runtime licensing SSOT. Not published. Not runtime-effective.',
  },
  {
    locale: 'ar-SY' as const,
    releaseLabel: 'مسودة التعريف التجاري (بذرة الخطوة 14)',
    shortDescription:
      'استحقاقات وحدود صريحة مزروعة من مصدر الترخيص الحالي. غير منشورة. غير سارية وقت التشغيل.',
  },
];
