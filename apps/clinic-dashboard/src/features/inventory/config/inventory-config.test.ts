import { describe, expect, it } from 'vitest';
import { hasPermission } from '@booking/permissions';
import {
  canArchiveInventory,
  canExportInventory,
  canUpdateInventory,
  isCatalogGridReadOnly,
  isCatalogReadOnly,
  isInventoryStaffWorkspace,
  resolveInventoryWorkspaceMode,
} from './inventory-config';

function permForRoles(roles: string[]) {
  return (action: string) => hasPermission(roles, 'api.inventory', action as never);
}

describe('resolveInventoryWorkspaceMode', () => {
  it('maps owner and super_admin to operations', () => {
    expect(resolveInventoryWorkspaceMode(['owner'])).toBe('operations');
    expect(resolveInventoryWorkspaceMode(['super_admin'])).toBe('operations');
  });

  it('maps inventory staff to management', () => {
    expect(resolveInventoryWorkspaceMode(['inventory_manager'])).toBe('management');
    expect(resolveInventoryWorkspaceMode(['general_manager'])).toBe('management');
    expect(resolveInventoryWorkspaceMode(['accountant'])).toBe('management');
  });

  it('maps clinical roles to clinical', () => {
    expect(resolveInventoryWorkspaceMode(['doctor'])).toBe('clinical');
    expect(resolveInventoryWorkspaceMode(['dentist'])).toBe('clinical');
  });

  it('defaults to lookup for front desk roles', () => {
    expect(resolveInventoryWorkspaceMode(['receptionist'])).toBe('lookup');
  });

  it('prefers operations over management when both apply', () => {
    expect(resolveInventoryWorkspaceMode(['owner', 'inventory_manager'])).toBe('operations');
  });
});

describe('inventory workspace helpers', () => {
  it('treats management as staff workspace', () => {
    expect(isInventoryStaffWorkspace('management')).toBe(true);
    expect(isInventoryStaffWorkspace('operations')).toBe(true);
    expect(isInventoryStaffWorkspace('clinical')).toBe(false);
  });

  it('keeps management catalog grid editable', () => {
    expect(isCatalogGridReadOnly('management')).toBe(false);
    expect(isCatalogGridReadOnly('clinical')).toBe(true);
    expect(isCatalogGridReadOnly('lookup')).toBe(true);
  });
});

describe('catalog workspace permissions by role', () => {
  it('owner operations workspace can export and archive', () => {
    const roles = ['owner'];
    expect(resolveInventoryWorkspaceMode(roles)).toBe('operations');
    const perm = permForRoles(roles);
    expect(canExportInventory(perm)).toBe(true);
    expect(canArchiveInventory(perm)).toBe(true);
    expect(canUpdateInventory(perm)).toBe(true);
    expect(isCatalogGridReadOnly(resolveInventoryWorkspaceMode(roles))).toBe(false);
  });

  it('inventory_manager management workspace can export but not bulk archive', () => {
    const roles = ['inventory_manager'];
    expect(resolveInventoryWorkspaceMode(roles)).toBe('management');
    const perm = permForRoles(roles);
    expect(canExportInventory(perm)).toBe(true);
    expect(canArchiveInventory(perm)).toBe(false);
    expect(canUpdateInventory(perm)).toBe(true);
    expect(isInventoryStaffWorkspace('management')).toBe(true);
  });

  it('doctor clinical workspace is read-only catalog with consume only', () => {
    const roles = ['doctor'];
    expect(resolveInventoryWorkspaceMode(roles)).toBe('clinical');
    const perm = permForRoles(roles);
    expect(isCatalogGridReadOnly('clinical')).toBe(true);
    expect(isCatalogReadOnly('clinical')).toBe(false);
    expect(canUpdateInventory(perm)).toBe(true);
    expect(canExportInventory(perm)).toBe(false);
    expect(canArchiveInventory(perm)).toBe(false);
  });

  it('receptionist lookup workspace is browse-only', () => {
    const roles = ['receptionist'];
    expect(resolveInventoryWorkspaceMode(roles)).toBe('lookup');
    const perm = permForRoles(roles);
    expect(isCatalogReadOnly('lookup')).toBe(true);
    expect(isCatalogGridReadOnly('lookup')).toBe(true);
    expect(canUpdateInventory(perm)).toBe(false);
    expect(canExportInventory(perm)).toBe(false);
  });
});
