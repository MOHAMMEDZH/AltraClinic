import { describe, expect, it } from 'vitest';
import {
  CLINIC_NAV_ITEMS,
  filterNavItems,
  hasPermission,
  hasPermissionWithCustomGrants,
  isProtectedPermission,
} from './index';

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

  it('does not grant super_admin clinical-forms approve', () => {
    expect(isProtectedPermission('api.clinical-forms', 'approve')).toBe(true);
    expect(hasPermission(['super_admin'], 'api.clinical-forms', 'approve')).toBe(false);
    expect(hasPermission(['doctor'], 'api.clinical-forms', 'approve')).toBe(true);
    expect(hasPermission(['super_admin'], 'api.billing', 'view')).toBe(true);
  });

  it('ignores custom grants for clinical-forms approve', () => {
    const grants = [{ 'api.clinical-forms': ['approve'] }];
    expect(hasPermissionWithCustomGrants(['receptionist'], grants, 'api.clinical-forms', 'approve')).toBe(
      false,
    );
    expect(hasPermissionWithCustomGrants(['owner'], grants, 'api.clinical-forms', 'approve')).toBe(false);
    expect(hasPermissionWithCustomGrants(['super_admin'], grants, 'api.clinical-forms', 'approve')).toBe(
      false,
    );
    expect(hasPermissionWithCustomGrants(['doctor'], [], 'api.clinical-forms', 'approve')).toBe(true);
  });

  it('still honors custom grants for unrelated permissions', () => {
    const grants = [{ 'api.clinical-forms': ['create'] }];
    expect(hasPermissionWithCustomGrants(['accountant'], grants, 'api.clinical-forms', 'create')).toBe(
      true,
    );
  });
});
