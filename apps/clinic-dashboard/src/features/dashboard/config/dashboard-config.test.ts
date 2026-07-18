import { describe, expect, it } from 'vitest';
import { hasPermission } from '@booking/permissions';
import {
  filterWidgetsByCategory,
  getProfileLayoutType,
  getQuickActionsForProfile,
  getWidgetsForRoles,
  resolveDashboardProfile,
} from '@/features/dashboard/config/dashboard-config';

describe('dashboard-config', () => {
  it('resolves owner profile', () => {
    expect(resolveDashboardProfile(['receptionist', 'owner'])).toBe('owner');
  });

  it('returns role-appropriate widgets', () => {
    const widgets = getWidgetsForRoles(['doctor'], (r) => hasPermission(['doctor'], r));
    expect(widgets.some((w) => w.id === 'today-appointments')).toBe(true);
    expect(widgets.some((w) => w.id === 'revenue-chart')).toBe(false);
  });

  it('includes finance widgets for accountant', () => {
    const widgets = getWidgetsForRoles(['accountant'], (r) =>
      hasPermission(['accountant'], r),
    );
    expect(widgets.some((w) => w.id === 'revenue-summary')).toBe(true);
  });

  it('includes analytics widgets for owner profile', () => {
    const widgets = getWidgetsForRoles(['owner'], (r) => hasPermission(['owner'], r));
    const ids = widgets.map((w) => w.id);
    expect(ids).toContain('branch-performance');
    expect(ids).toContain('business-health');
    expect(ids).toContain('subscription-status');
    expect(ids).toContain('patient-growth');
    expect(ids).toContain('kpi-overview');
    expect(ids).toContain('revenue-chart');
  });

  it('filters widgets by category', () => {
    const widgets = getWidgetsForRoles(['owner'], (r) => hasPermission(['owner'], r)).map(
      (w) => w.id,
    );
    const finance = filterWidgetsByCategory(widgets, 'finance');
    expect(finance).toContain('revenue-summary');
    expect(finance).not.toContain('queue-status');
  });

  it('returns role-specific quick actions', () => {
    expect(getQuickActionsForProfile('doctor')).toEqual(['appointments', 'patients', 'encounters']);
    expect(getQuickActionsForProfile('receptionist')).not.toContain('inventory');
    expect(getQuickActionsForProfile('inventory_manager')).toEqual(['inventory', 'patients']);
  });

  it('maps profiles to layout types', () => {
    expect(getProfileLayoutType('owner')).toBe('executive');
    expect(getProfileLayoutType('doctor')).toBe('clinical');
    expect(getProfileLayoutType('receptionist')).toBe('operational');
  });
});
