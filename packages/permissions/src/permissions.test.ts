import { describe, expect, it } from 'vitest';
import { CLINIC_NAV_ITEMS, filterNavItems, hasPermission } from './index';

describe('permissions', () => {
  it('grants super_admin all permissions', () => {
    expect(hasPermission(['super_admin'], 'api.billing', 'view')).toBe(true);
  });

  it('allows receptionist patients but not billing', () => {
    expect(hasPermission(['receptionist'], 'api.patients', 'view')).toBe(true);
    expect(hasPermission(['receptionist'], 'api.billing', 'view')).toBe(false);
  });

  it('filters nav items by role', () => {
    const nav = filterNavItems(CLINIC_NAV_ITEMS, ['receptionist']);
    const ids = nav.map((n) => n.id);
    expect(ids).toContain('patients');
    expect(ids).toContain('appointments');
    expect(ids).not.toContain('billing');
    expect(ids).not.toContain('encounters');
  });
});
