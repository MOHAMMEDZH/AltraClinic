import { clearReportingCache } from '@/features/dynamic-reporting/lib/reporting-cache';
import { clearAnalyticsCache } from '@/features/dynamic-analytics/lib/analytics-cache';
import { clearWhiteLabelCache } from '@/features/dynamic-white-label/lib/white-label-cache';
import { clearBranchCache } from '@/features/dynamic-branch/lib/branch-cache';
import { clearDashboardCache } from '@/features/dynamic-dashboard/lib/dashboard-cache';
import { clearSearchCache } from '@/features/dynamic-search/lib/search-cache';
import { clearNavigationCache } from '@/features/dynamic-navigation/lib/navigation-cache';
import { clearRouteCache } from '@/features/dynamic-routing/lib/route-cache';
import { clearActivityCache } from '@/features/dynamic-activity/lib/activity-cache';
import { clearAuditCache } from '@/features/dynamic-audit/lib/audit-cache';
import { clearJourneyCache } from '@/features/dynamic-journey/lib/journey-cache';
import { clearRegistryCache } from './registry-cache';

/** Clears all module-registry and dynamic consumer client caches (nav → journey). */
export function clearModuleRegistryCaches(): void {
  clearRegistryCache();
  clearNavigationCache();
  clearRouteCache();
  clearDashboardCache();
  clearSearchCache();
  clearReportingCache();
  clearAnalyticsCache();
  clearBranchCache();
  clearWhiteLabelCache();
  clearActivityCache();
  clearAuditCache();
  clearJourneyCache();
}