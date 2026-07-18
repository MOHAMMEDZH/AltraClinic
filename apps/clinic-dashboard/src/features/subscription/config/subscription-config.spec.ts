import { describe, expect, it } from 'vitest';
import {
  buildSubscriptionPermCheck,
  canViewPlatformAdmin,
  canViewSubscription,
  comparePlanTier,
  formatLimit,
  getPlanById,
  getPlanLimits,
  isFeatureEnabled,
  isUsageCritical,
  isUsageWarning,
  lostFeaturesOnDowngrade,
  mapUiPlanToBackend,
  priceForCycle,
  resolveSubscriptionPlanId,
  usagePercent,
} from './subscription-config';

describe('subscription-config', () => {
  it('allows owners to view subscriptions', () => {
    const perm = buildSubscriptionPermCheck(['owner']);
    expect(canViewSubscription(perm)).toBe(true);
  });

  it('allows super admins to view platform controls', () => {
    const perm = buildSubscriptionPermCheck(['super_admin']);
    expect(canViewPlatformAdmin(perm)).toBe(true);
  });

  it('resolves plan ids from backend names', () => {
    expect(resolveSubscriptionPlanId('lite')).toBe('starter');
    expect(resolveSubscriptionPlanId('pro')).toBe('professional');
    expect(resolveSubscriptionPlanId('enterprise')).toBe('enterprise');
  });

  it('maps ui plans to backend plans', () => {
    expect(mapUiPlanToBackend('starter')).toBe('lite');
    expect(mapUiPlanToBackend('business')).toBe('pro');
    expect(mapUiPlanToBackend('enterprise')).toBe('enterprise');
  });

  it('compares plan tiers', () => {
    expect(comparePlanTier('starter', 'professional')).toBe('upgrade');
    expect(comparePlanTier('business', 'starter')).toBe('downgrade');
    expect(comparePlanTier('professional', 'professional')).toBe('same');
  });

  it('computes usage helpers', () => {
    expect(formatLimit(-1)).toBe('∞');
    expect(usagePercent(50, 100)).toBe(50);
    expect(isUsageWarning(85)).toBe(true);
    expect(isUsageCritical(96)).toBe(true);
  });

  it('returns plan limits and pricing', () => {
    const pro = getPlanById('professional');
    expect(getPlanLimits('professional').maxUsers).toBe(50);
    expect(priceForCycle(pro, 'annual')).toBeGreaterThan(0);
  });

  it('evaluates feature entitlements', () => {
    expect(isFeatureEnabled('dashboard', 'starter')).toBe(true);
    expect(isFeatureEnabled('workflow', 'starter')).toBe(false);
    expect(isFeatureEnabled('workflow', 'business')).toBe(true);
  });

  it('lists features lost on downgrade', () => {
    const lost = lostFeaturesOnDowngrade('business', 'starter');
    expect(lost.some((row) => row.id === 'workflow')).toBe(true);
  });
});
