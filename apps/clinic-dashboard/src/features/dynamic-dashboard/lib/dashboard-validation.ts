import { hasPermission } from '@booking/permissions';
import { getWidgetsForRoles } from '@/features/dashboard/config/dashboard-config';
import type { DashboardCatalogEntry, DashboardParityMismatch, DashboardSnapshot } from './dashboard-types';
import { assertCanonicalWidgetParity, listRegisteredWidgetIds } from './dashboard-widget-registry';
import { STATIC_DASHBOARD_CATALOG } from './static-dashboard-catalog';

export function validateDashboardCatalog(catalog: DashboardCatalogEntry[]): string[] {
  const errors: string[] = [];
  const registered = new Set(listRegisteredWidgetIds());
  const seenIds = new Set<string>();

  for (const entry of catalog) {
    if (seenIds.has(entry.id)) {
      errors.push(`Duplicate widget id: ${entry.id}`);
    }
    seenIds.add(entry.id);

    if (!registered.has(entry.id)) {
      errors.push(`Unknown widget id "${entry.id}" in catalog`);
    }

    if (!entry.moduleId) {
      errors.push(`Widget ${entry.id} must define moduleId`);
    }
  }

  return errors;
}

export function verifyDashboardParity(
  expectedWidgetIds: string[],
  actualSnapshot: DashboardSnapshot,
): DashboardParityMismatch[] {
  const expected = [...expectedWidgetIds];
  const actual = [...actualSnapshot.widgetIds];
  const mismatches: DashboardParityMismatch[] = [];

  if (expected.length !== actual.length) {
    mismatches.push({
      id: 'widget-count',
      field: 'length',
      expected: String(expected.length),
      actual: String(actual.length),
    });
  }

  for (let i = 0; i < Math.max(expected.length, actual.length); i += 1) {
    const exp = expected[i];
    const act = actual[i];
    if (exp !== act) {
      mismatches.push({
        id: `widget-${i}`,
        field: 'widgetId',
        expected: exp ?? '(missing)',
        actual: act ?? '(missing)',
      });
    }
  }

  return mismatches;
}

export function buildStaticParityWidgetIds(roles: string[]): string[] {
  return getWidgetsForRoles(roles, (resourceId) => hasPermission(roles, resourceId)).map(
    (widget) => widget.id,
  );
}

export function assertDashboardCatalogValid(catalog: DashboardCatalogEntry[] = STATIC_DASHBOARD_CATALOG): void {
  assertCanonicalWidgetParity();
  const errors = validateDashboardCatalog(catalog);
  if (errors.length > 0) {
    throw new Error(`Dashboard catalog validation failed:\n${errors.join('\n')}`);
  }
}
