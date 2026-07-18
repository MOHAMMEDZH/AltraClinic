export const ENTITLEMENT_PLANS = ['starter', 'growth', 'enterprise'] as const;

export type EntitlementPlan = (typeof ENTITLEMENT_PLANS)[number];

const ENTITLEMENT_PLAN_ALIASES: Record<string, EntitlementPlan> = {
  starter: 'starter',
  growth: 'growth',
  enterprise: 'enterprise',
  lite: 'starter',
  pro: 'growth',
  basic: 'starter',
  standard: 'growth',
  premium: 'enterprise',
  professional: 'growth',
  business: 'growth',
};

export function normalizeEntitlementPlan(value: unknown): EntitlementPlan | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  const alias = ENTITLEMENT_PLAN_ALIASES[key];
  if (alias) return alias;
  const upper = value.trim().toUpperCase();
  if (upper === 'LITE') return 'starter';
  if (upper === 'PRO') return 'growth';
  if (upper === 'ENTERPRISE') return 'enterprise';
  return null;
}

export function isEntitlementPlan(value: unknown): value is EntitlementPlan {
  return normalizeEntitlementPlan(value) !== null;
}

/** Per-plan resource quotas. `null` means unlimited (enterprise). */
export interface EntitlementLimits {
  readonly maxBranches: number | null;
  readonly maxUsers: number | null;
}
