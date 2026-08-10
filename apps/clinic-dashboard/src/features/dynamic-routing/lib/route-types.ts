import type { LicensedModuleId } from '@booking/module-registry';
import type { RouteObject } from 'react-router-dom';

/** Layout shell keys — maps to existing layout components (unchanged). */
export type RouteLayoutKey =
  | 'workflow'
  | 'ai'
  | 'settings'
  | 'security'
  | 'users'
  | 'notifications'
  | 'subscription'
  | 'importExport'
  | 'backupRestore'
  | 'apiIntegrations';

/**
 * Static route catalog entry — parity baseline for Phase 30 migration.
 * moduleId links the route subtree to EffectiveModuleView access (no client RBAC).
 */
export interface RouteCatalogEntry {
  id: string;
  path?: string;
  index?: boolean;
  moduleId: LicensedModuleId | 'core';
  componentKey: string;
  layoutKey?: RouteLayoutKey;
  /** Kiosk routes render outside LicensedApplicationShell (e.g. queue display). */
  kioskRoute?: boolean;
  children?: RouteCatalogEntry[];
}

export type RouteCatalogSource = 'registry' | 'static-fallback' | 'static-only';

export interface RouteSnapshot {
  source: RouteCatalogSource;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  /** Flattened route paths included after registry filtering. */
  paths: string[];
  /** React Router route objects ready for useRoutes / createBrowserRouter. */
  routeObjects: RouteObject[];
}

export interface RouteContributionView {
  extensionId: string;
  moduleId: string;
  path: string;
  componentKey: string;
  layoutKey?: string;
  userVisible: boolean;
  userAccessible: boolean;
}

export interface RouteParityMismatch {
  id: string;
  field: string;
  expected: string;
  actual: string;
}

export interface RouteCacheIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  moduleCount: number;
  source: RouteCatalogSource;
  /** Phase 36b — synchronized with DynamicBranchProvider publication. */
  branchSnapshotVersion?: string | null;
}
