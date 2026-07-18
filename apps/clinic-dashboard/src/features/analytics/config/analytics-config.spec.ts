import { describe, expect, it } from 'vitest';
import {
  buildAnalyticsPermCheck,
  canViewAnalytics,
  canViewAnalyticsDomain,
} from '../config/analytics-config';

describe('analytics-config', () => {
  it('allows owner to view analytics', () => {
    const perm = buildAnalyticsPermCheck(['owner']);
    expect(canViewAnalytics(perm)).toBe(true);
    expect(canViewAnalyticsDomain('executive', perm)).toBe(true);
  });

  it('allows financial domain when billing view is granted', () => {
    const perm = buildAnalyticsPermCheck(['accountant']);
    expect(canViewAnalyticsDomain('financial', perm)).toBe(true);
  });

  it('blocks forecasting for roles without create permission', () => {
    const perm = buildAnalyticsPermCheck(['receptionist']);
    expect(canViewAnalyticsDomain('forecasting', perm)).toBe(false);
  });
});
