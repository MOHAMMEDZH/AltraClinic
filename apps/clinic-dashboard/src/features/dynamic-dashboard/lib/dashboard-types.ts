import type { LicensedModuleId } from '@booking/module-registry';
import type {
  DashboardProfileId,
  DashboardWidgetCategory,
  DashboardWidgetId,
} from '@/features/dashboard/config/dashboard-config';

/** Static dashboard catalog entry — parity baseline for Phase 31 migration. */
export interface DashboardCatalogEntry {
  id: DashboardWidgetId;
  moduleId: LicensedModuleId | 'core';
  resourceId?: string;
  span?: 'full' | 'half' | 'third' | 'two-thirds';
  category: DashboardWidgetCategory;
}

export type DashboardCatalogSource = 'registry' | 'static-fallback' | 'static-only';

export interface DashboardSnapshot {
  source: DashboardCatalogSource;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  profile: DashboardProfileId;
  /** Widget IDs included after registry filtering for the active profile. */
  widgetIds: DashboardWidgetId[];
}

export interface DashboardContributionView {
  extensionId: string;
  moduleId: string;
  widgetId: string;
  componentKey: string;
  userVisible: boolean;
  userAccessible: boolean;
  sortOrder: number;
}

export interface DashboardParityMismatch {
  id: string;
  field: string;
  expected: string;
  actual: string;
}

export interface DashboardCacheIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  moduleCount: number;
  profile: DashboardProfileId;
  source: DashboardCatalogSource;
  /** Phase 36b — synchronized with DynamicBranchProvider publication. */
  branchSnapshotVersion?: string | null;
}
