import { CLINIC_NAV_ITEMS, filterNavItems, type NavItemDefinition } from '@booking/permissions';
import type { SidebarNavItem } from './navigation-types';

export interface NavigationParityMismatch {
  id: string;
  field: string;
  expected: string;
  actual: string;
}

export function verifySidebarParity(
  dynamicItems: SidebarNavItem[],
  roles: string[],
): NavigationParityMismatch[] {
  const expected = filterNavItems(CLINIC_NAV_ITEMS, roles);
  const mismatches: NavigationParityMismatch[] = [];

  if (dynamicItems.length !== expected.length) {
    mismatches.push({
      id: 'count',
      field: 'length',
      expected: String(expected.length),
      actual: String(dynamicItems.length),
    });
  }

  for (let i = 0; i < expected.length; i += 1) {
    const exp = expected[i];
    const act = dynamicItems[i];
    if (!act) {
      mismatches.push({ id: exp.id, field: 'missing', expected: exp.path, actual: '(missing)' });
      continue;
    }
    compareNavItem(exp, act, mismatches);
  }

  return mismatches;
}

function compareNavItem(
  expected: NavItemDefinition,
  actual: SidebarNavItem,
  mismatches: NavigationParityMismatch[],
): void {
  if (expected.id !== actual.id) {
    mismatches.push({ id: expected.id, field: 'id', expected: expected.id, actual: actual.id });
  }
  if (expected.path !== actual.path) {
    mismatches.push({ id: expected.id, field: 'path', expected: expected.path, actual: actual.path });
  }
  if (expected.labelKey !== actual.labelKey) {
    mismatches.push({
      id: expected.id,
      field: 'labelKey',
      expected: expected.labelKey,
      actual: actual.labelKey,
    });
  }
  if (expected.icon !== actual.icon) {
    mismatches.push({ id: expected.id, field: 'icon', expected: expected.icon, actual: actual.icon });
  }
  const expResource = expected.resourceId ?? '(none)';
  const actResource = actual.resourceId ?? '(none)';
  if (expResource !== actResource) {
    mismatches.push({ id: expected.id, field: 'resourceId', expected: expResource, actual: actResource });
  }
}
