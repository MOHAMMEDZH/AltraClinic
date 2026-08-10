/**
 * Deterministic Step 13 Plan seed — exactly three canonical Plans.
 * No fourth vocabulary. `business` is an alias of plan.pro (UI tier), not a Plan.
 */
import type { PlanAliasNamespace } from '../platform-plans.tokens';

export interface SeedPlanTranslation {
  locale: 'en-US' | 'ar-SY';
  displayName: string;
  shortDescription: string;
}

export interface SeedPlanAlias {
  aliasValue: string;
  sourceNamespace: PlanAliasNamespace;
  migrationNote: string;
}

export interface SeedPlan {
  canonicalKey: string;
  sortOrder: number;
  translations: SeedPlanTranslation[];
  aliases: SeedPlanAlias[];
}

function t(
  enName: string,
  enDesc: string,
  arName: string,
  arDesc: string,
): SeedPlanTranslation[] {
  return [
    { locale: 'en-US', displayName: enName, shortDescription: enDesc },
    { locale: 'ar-SY', displayName: arName, shortDescription: arDesc },
  ];
}

export const SEED_PLANS: SeedPlan[] = [
  {
    canonicalKey: 'plan.lite',
    sortOrder: 10,
    translations: t(
      'Lite',
      'Entry commercial plan family (legacy LITE / starter)',
      'لايت',
      'عائلة الخطة التجارية الأساسية (LITE / starter)',
    ),
    aliases: [
      {
        aliasValue: 'LITE',
        sourceNamespace: 'prisma_plan_enum',
        migrationNote: 'Prisma EntitlementPlan.LITE — high confidence',
      },
      {
        aliasValue: 'starter',
        sourceNamespace: 'platform_subscription_plan',
        migrationNote: 'Platform domain starter ↔ LITE',
      },
      {
        aliasValue: 'starter',
        sourceNamespace: 'clinic_ui_plan',
        migrationNote: 'Clinic UI subscription plan starter',
      },
      {
        aliasValue: 'lite',
        sourceNamespace: 'legacy_license_plan',
        migrationNote: 'LicensingEngine / SubscriptionPlanVO lite',
      },
      {
        aliasValue: 'lite',
        sourceNamespace: 'api_plan_code',
        migrationNote: 'API plan code lite',
      },
      {
        aliasValue: 'basic',
        sourceNamespace: 'legacy_license_plan',
        migrationNote: 'Legacy alias basic → lite',
      },
    ],
  },
  {
    canonicalKey: 'plan.pro',
    sortOrder: 20,
    translations: t(
      'Pro',
      'Mid-tier commercial plan family (legacy PRO / growth / professional)',
      'برو',
      'عائلة الخطة التجارية المتوسطة (PRO / growth / professional)',
    ),
    aliases: [
      {
        aliasValue: 'PRO',
        sourceNamespace: 'prisma_plan_enum',
        migrationNote: 'Prisma EntitlementPlan.PRO — high confidence',
      },
      {
        aliasValue: 'growth',
        sourceNamespace: 'platform_subscription_plan',
        migrationNote: 'Platform domain growth ↔ PRO',
      },
      {
        aliasValue: 'professional',
        sourceNamespace: 'clinic_ui_plan',
        migrationNote: 'Default Clinic UI tier for pro backend',
      },
      {
        aliasValue: 'pro',
        sourceNamespace: 'legacy_license_plan',
        migrationNote: 'LicensingEngine / SubscriptionPlanVO pro',
      },
      {
        aliasValue: 'pro',
        sourceNamespace: 'api_plan_code',
        migrationNote: 'API plan code pro',
      },
      {
        aliasValue: 'standard',
        sourceNamespace: 'legacy_license_plan',
        migrationNote: 'Legacy alias standard → pro',
      },
    ],
  },
  {
    canonicalKey: 'plan.enterprise',
    sortOrder: 30,
    translations: t(
      'Enterprise',
      'Enterprise commercial plan family',
      'مؤسسات',
      'عائلة خطة المؤسسات التجارية',
    ),
    aliases: [
      {
        aliasValue: 'ENTERPRISE',
        sourceNamespace: 'prisma_plan_enum',
        migrationNote: 'Prisma EntitlementPlan.ENTERPRISE — high confidence',
      },
      {
        aliasValue: 'enterprise',
        sourceNamespace: 'platform_subscription_plan',
        migrationNote: 'Platform domain enterprise',
      },
      {
        aliasValue: 'enterprise',
        sourceNamespace: 'clinic_ui_plan',
        migrationNote: 'Clinic UI enterprise',
      },
      {
        aliasValue: 'enterprise',
        sourceNamespace: 'legacy_license_plan',
        migrationNote: 'LicensingEngine enterprise',
      },
      {
        aliasValue: 'enterprise',
        sourceNamespace: 'api_plan_code',
        migrationNote: 'API plan code enterprise',
      },
      {
        aliasValue: 'premium',
        sourceNamespace: 'legacy_license_plan',
        migrationNote: 'Legacy alias premium → enterprise',
      },
    ],
  },
];

/**
 * Legacy identifiers that must NOT be PlatformPlanAlias rows and must NOT become canonical Plans.
 * `business` is a Clinic UI tier overlay on PRO (distinct price/limits/features) — Option B.
 */
export const UNRESOLVED_PLAN_IDENTIFIERS = [
  {
    value: 'business',
    classification: 'non_plan_ui_tier' as const,
    note:
      'Clinic UI subscriptionUiPlan tier layered on PRO — not Plan-equivalent; do not alias to plan.pro; never seed plan.business',
  },
] as const;

/** Canonical keys forbidden even though they match PLAN_KEY_REGEX. */
export const RESERVED_PLAN_KEYS = ['plan.business'] as const;
