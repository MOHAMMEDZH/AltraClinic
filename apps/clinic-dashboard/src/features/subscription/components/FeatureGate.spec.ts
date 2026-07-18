import { describe, expect, it } from 'vitest';
import { isFeatureEnabled } from '../config/subscription-config';

describe('FeatureGate entitlements', () => {
  it('blocks workflow on starter', () => {
    expect(isFeatureEnabled('workflow', 'starter')).toBe(false);
  });

  it('allows workflow on business', () => {
    expect(isFeatureEnabled('workflow', 'business')).toBe(true);
  });

  it('blocks analytics on starter', () => {
    expect(isFeatureEnabled('analytics', 'starter')).toBe(false);
  });
});
