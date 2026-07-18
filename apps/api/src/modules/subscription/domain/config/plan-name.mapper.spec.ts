import {
  normalizeSubscriptionPlan,
  platformPlanToSubscriptionPlan,
  subscriptionPlanToUiPlan,
  uiPlanToSubscriptionPlan,
  getLimitsForUiPlan,
} from './plan-name.mapper';
import { getPlanLimits } from './plan-limits.config';

describe('plan-name.mapper', () => {
  it('normalizes prisma and alias plan names', () => {
    expect(normalizeSubscriptionPlan('LITE')).toBe('lite');
    expect(normalizeSubscriptionPlan('starter')).toBe('lite');
    expect(normalizeSubscriptionPlan('growth')).toBe('pro');
    expect(normalizeSubscriptionPlan('business')).toBe('pro');
    expect(normalizeSubscriptionPlan('ENTERPRISE')).toBe('enterprise');
  });

  it('maps platform plans to subscription limits', () => {
    expect(platformPlanToSubscriptionPlan('LITE')).toBe('lite');
    expect(platformPlanToSubscriptionPlan('growth')).toBe('pro');
    expect(platformPlanToSubscriptionPlan('enterprise')).toBe('enterprise');
  });

  it('maps ui plans to backend plans', () => {
    expect(uiPlanToSubscriptionPlan('professional')).toBe('pro');
    expect(uiPlanToSubscriptionPlan('business')).toBe('pro');
    expect(subscriptionPlanToUiPlan('pro', 'business')).toBe('business');
    expect(subscriptionPlanToUiPlan('pro')).toBe('professional');
  });

  it('applies business-tier limits over pro base limits', () => {
    const proLimits = getPlanLimits('pro');
    const businessLimits = getLimitsForUiPlan('business', proLimits);
    expect(businessLimits.maxUsers).toBe(120);
    expect(businessLimits.maxBranches).toBe(20);
    expect(businessLimits.maxReportsPerMonth).toBe(-1);
  });
});
