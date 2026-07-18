import { describe, expect, it } from 'vitest';
import {
  buildDashboardUrl,
  dashboardDrillDown,
  parseDashboardBranchParam,
  parseDashboardCategoryParam,
  parseDashboardRangeParam,
} from './dashboard-drill-down';

describe('dashboard-drill-down', () => {
  it('parses URL filter params with defaults', () => {
    expect(parseDashboardRangeParam(null)).toBe('7d');
    expect(parseDashboardRangeParam('30d')).toBe('30d');
    expect(parseDashboardRangeParam('90d')).toBe('90d');
    expect(parseDashboardRangeParam('custom')).toBe('custom');
    expect(parseDashboardBranchParam('all')).toBeNull();
    expect(parseDashboardBranchParam('abc')).toBe('abc');
    expect(parseDashboardCategoryParam('finance')).toBe('finance');
    expect(parseDashboardCategoryParam(null)).toBe('all');
  });

  it('builds shareable dashboard URLs', () => {
    expect(buildDashboardUrl('7d', null)).toBe('/?branchId=all');
    expect(buildDashboardUrl('30d', 'branch-1', 'finance')).toBe(
      '/?range=30d&branchId=branch-1&category=finance',
    );
  });

  it('builds drill-down paths with query params', () => {
    expect(dashboardDrillDown.billingOutstanding()).toBe('/billing/outstanding');
    expect(dashboardDrillDown.inventoryLowStock()).toBe('/inventory/catalog?stock=low');
    expect(dashboardDrillDown.analytics('revenue', '30d')).toBe('/analytics?metric=revenue&range=30d');
  });
});
