export {
  CANONICAL_DASHBOARD_WIDGET_IDS,
  CANONICAL_DASHBOARD_WIDGETS,
  CANONICAL_RESOURCE_TO_MODULE,
  getCanonicalWidget,
  listCanonicalComponentKeys,
  listCanonicalWidgetIds,
  resolveCanonicalModuleIdForResource,
  type CanonicalDashboardCategory,
  type CanonicalDashboardWidget,
  type CanonicalDashboardWidgetId,
} from './canonical-dashboard-widgets';
export {
  buildDashboardContributionsForModule,
  listAllBuiltinDashboardContributions,
} from './build-dashboard-contributions';
export { validateBuiltinDashboardIntegrity } from './validate-dashboard-integrity';
