import type { AiFeatureKey } from './ai-config';

/** UI subscription tiers mapped from tenant plan names. */
export type AiPlanTier = 'starter' | 'professional' | 'business' | 'enterprise';

const TIER_FEATURES: Record<AiPlanTier, AiFeatureKey[] | 'all'> = {
  starter: ['chat'],
  professional: ['chat', 'medical', 'dental', 'beauty', 'reporting'],
  business: [
    'chat',
    'medical',
    'dental',
    'beauty',
    'reception',
    'billing',
    'inventory',
    'analytics',
    'workflow',
    'reporting',
    'management',
  ],
  enterprise: 'all',
};

export function resolveAiPlanTier(planName?: string | null): AiPlanTier {
  const normalized = (planName ?? 'lite').toLowerCase();
  if (normalized === 'enterprise') return 'enterprise';
  if (normalized === 'pro' || normalized === 'professional') return 'professional';
  if (normalized === 'business') return 'business';
  return 'starter';
}

export function aiFeatureEnabled(tier: AiPlanTier, feature: AiFeatureKey): boolean {
  const allowed = TIER_FEATURES[tier];
  if (allowed === 'all') return true;
  return allowed.includes(feature);
}

/** API-driven workspace check (preferred over client tier guessing). */
export function featureAllowedByWorkspaces(
  workspaces: string[] | 'all' | undefined,
  feature: AiFeatureKey,
): boolean {
  if (!workspaces) return false;
  if (workspaces === 'all') return true;
  if (feature === 'admin') return workspaces.includes('admin');
  return workspaces.includes(feature);
}

export function aiWorkspaceFeature(workspaceId: string): AiFeatureKey {
  const map: Record<string, AiFeatureKey> = {
    medical: 'medical',
    dental: 'dental',
    beauty: 'beauty',
    reception: 'reception',
    billing: 'billing',
    inventory: 'inventory',
    analytics: 'analytics',
    workflow: 'workflow',
    reporting: 'reporting',
    management: 'management',
    super_admin: 'admin',
  };
  return map[workspaceId] ?? 'chat';
}
