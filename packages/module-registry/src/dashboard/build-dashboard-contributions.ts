import type { DashboardContribution, LicensedModuleId } from '../types';
import { moduleDashboardWidget } from '../builtin/extension-builders';
import {
  CANONICAL_DASHBOARD_WIDGETS,
  type CanonicalDashboardWidget,
} from './canonical-dashboard-widgets';

const DEFAULT_DASHBOARD_PROFILES = [
  'owner',
  'general_manager',
  'branch_manager',
  'doctor',
] as const;

function toContribution(widget: CanonicalDashboardWidget): DashboardContribution {
  return moduleDashboardWidget(
    widget.moduleId,
    widget.id,
    widget.componentKey,
    widget.labelKey,
    widget.sortOrder,
    widget.resourceId,
    [...DEFAULT_DASHBOARD_PROFILES],
  );
}

const contributionsByModule = new Map<LicensedModuleId, DashboardContribution[]>();

for (const widget of CANONICAL_DASHBOARD_WIDGETS) {
  const list = contributionsByModule.get(widget.moduleId) ?? [];
  list.push(toContribution(widget));
  contributionsByModule.set(widget.moduleId, list);
}

for (const [moduleId, list] of contributionsByModule) {
  list.sort((a, b) => a.sortOrder - b.sortOrder || a.widgetId.localeCompare(b.widgetId));
  contributionsByModule.set(moduleId, list);
}

export function buildDashboardContributionsForModule(
  moduleId: LicensedModuleId,
): DashboardContribution[] {
  return contributionsByModule.get(moduleId) ?? [];
}

export function listAllBuiltinDashboardContributions(): DashboardContribution[] {
  return CANONICAL_DASHBOARD_WIDGETS.map(toContribution);
}
