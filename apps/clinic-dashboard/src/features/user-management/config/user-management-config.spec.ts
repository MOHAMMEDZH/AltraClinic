import { describe, expect, it } from 'vitest';
import {
  assignableRoles,
  buildIdentityPermCheck,
  canCreateUsers,
  canDeleteUsers,
  canExportUsers,
  canManageUsers,
  canViewUsers,
} from './user-management-config';

describe('user-management-config', () => {
  it('allows owners to view and manage users', () => {
    const perm = buildIdentityPermCheck(['owner']);
    expect(canViewUsers(perm)).toBe(true);
    expect(canCreateUsers(perm)).toBe(true);
    expect(canManageUsers(perm)).toBe(true);
    expect(canExportUsers(perm)).toBe(true);
    expect(canDeleteUsers(perm)).toBe(false);
  });

  it('allows super_admin to delete users', () => {
    const perm = buildIdentityPermCheck(['super_admin']);
    expect(canDeleteUsers(perm)).toBe(true);
  });

  it('blocks receptionists from user admin', () => {
    const perm = buildIdentityPermCheck(['receptionist']);
    expect(canViewUsers(perm)).toBe(false);
    expect(canCreateUsers(perm)).toBe(false);
  });

  it('excludes patient and super_admin from assignable roles', () => {
    const roles = assignableRoles();
    expect(roles).not.toContain('patient');
    expect(roles).not.toContain('super_admin');
    expect(roles).toContain('doctor');
  });

  it('includes extended staff roles in assignable list', () => {
    const roles = assignableRoles();
    expect(roles).toContain('lab_technician');
    expect(roles).toContain('radiologist');
    expect(roles).toContain('cashier');
    expect(roles).toContain('hr');
    expect(roles).toContain('marketing');
  });

  it('defines employment status filters', async () => {
    const { EMPLOYMENT_STATUS_FILTERS } = await import('./user-management-config');
    expect(EMPLOYMENT_STATUS_FILTERS).toContain('active');
    expect(EMPLOYMENT_STATUS_FILTERS).toContain('terminated');
  });
});
