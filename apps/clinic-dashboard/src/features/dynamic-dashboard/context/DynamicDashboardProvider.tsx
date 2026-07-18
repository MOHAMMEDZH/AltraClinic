import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { hasPermission } from '@booking/permissions';
import type { EffectiveModuleView } from '@booking/module-registry';
import { useAuth } from '@/app/providers/AuthProvider';
import { useModuleRegistry } from '@/features/module-registry/context/ModuleRegistryProvider';
import { useOptionalBranch } from '@/features/dynamic-branch/context/DynamicBranchProvider';
import { useRegisterBranchConsumer } from '@/features/dynamic-branch/hooks/useRegisterBranchConsumer';
import { buildRolesHash } from '@/features/module-registry/lib/registry-cache-identity';
import { getWidgetsForRoles } from '@/features/dashboard/config/dashboard-config';
import {
  buildDashboardCacheKey,
  clearDashboardCache,
  readDashboardCache,
  writeDashboardCache,
} from '../lib/dashboard-cache';
import {
  buildRegistryDashboardSnapshot,
  buildStaticDashboardSnapshot,
} from '../lib/dashboard-layout-resolver';
import { STATIC_DASHBOARD_CATALOG } from '../lib/static-dashboard-catalog';
import { isRegistryDashboardEnabled } from '../lib/static-dashboard-flags';
import { assertDashboardCatalogValid } from '../lib/dashboard-validation';
import type { DashboardSnapshot } from '../lib/dashboard-types';

assertDashboardCatalogValid(STATIC_DASHBOARD_CATALOG);

function buildPermissionFilteredSnapshot(roles: string[]): DashboardSnapshot {
  const widgetIds = getWidgetsForRoles(roles, (resourceId) =>
    hasPermission(roles, resourceId),
  ).map((widget) => widget.id);

  const staticSnapshot = buildStaticDashboardSnapshot(roles, STATIC_DASHBOARD_CATALOG);
  return {
    ...staticSnapshot,
    source: 'static-fallback',
    widgetIds,
  };
}

function resolveRegistrySnapshot(
  roles: string[],
  modules: EffectiveModuleView[],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
): DashboardSnapshot {
  return buildRegistryDashboardSnapshot(
    roles,
    STATIC_DASHBOARD_CATALOG,
    modules,
    catalogGeneration,
    entitlementVersion,
  );
}

export interface DynamicDashboardContextValue {
  snapshot: DashboardSnapshot;
  widgetIds: DashboardSnapshot['widgetIds'];
  isRegistrySource: boolean;
  isLoading: boolean;
  /** Observed branch snapshot version (config source). */
  branchSnapshotVersion: string | null;
  activeBranchId: string | null;
}

const DynamicDashboardContext = createContext<DynamicDashboardContextValue | null>(null);

export function DynamicDashboardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const rolesHash = buildRolesHash(roles);
  const tenantId = user?.tenantId ?? '';
  const userId = user?.userId ?? '';
  const registry = useModuleRegistry();
  const branchCtx = useOptionalBranch();
  const useRegistry = isRegistryDashboardEnabled();
  const [refreshNonce, setRefreshNonce] = useState(0);

  useRegisterBranchConsumer('dashboard', () => {
    clearDashboardCache();
    setRefreshNonce((value) => value + 1);
  });

  const branchSnapshotVersion = branchCtx?.branchSnapshotVersion ?? null;
  const activeBranchId = branchCtx?.activeBranchId ?? null;

  const value = useMemo<DynamicDashboardContextValue>(() => {
    void refreshNonce;
    const fallback = buildPermissionFilteredSnapshot(roles);

    if (!useRegistry || registry.isError) {
      return {
        snapshot: fallback,
        widgetIds: fallback.widgetIds,
        isRegistrySource: false,
        isLoading: registry.isLoading,
        branchSnapshotVersion,
        activeBranchId,
      };
    }

    if (registry.isLoading && registry.modules.length === 0) {
      return {
        snapshot: fallback,
        widgetIds: fallback.widgetIds,
        isRegistrySource: false,
        isLoading: true,
        branchSnapshotVersion,
        activeBranchId,
      };
    }

    const profile = fallback.profile;
    const cacheKey = buildDashboardCacheKey({
      tenantId,
      userId,
      rolesHash,
      profile,
      catalogGeneration: registry.snapshot?.catalogGeneration ?? null,
      entitlementVersion: registry.snapshot?.entitlementVersion ?? null,
      moduleCount: registry.modules.length,
      source: 'registry',
      branchSnapshotVersion,
    });

    const cached = readDashboardCache(cacheKey);
    const snapshot =
      cached ??
      resolveRegistrySnapshot(
        roles,
        registry.modules,
        registry.snapshot?.catalogGeneration ?? null,
        registry.snapshot?.entitlementVersion ?? null,
      );

    if (!cached) {
      writeDashboardCache(cacheKey, snapshot);
    }

    return {
      snapshot,
      widgetIds: snapshot.widgetIds,
      isRegistrySource: true,
      isLoading: registry.isLoading,
      branchSnapshotVersion,
      activeBranchId,
    };
  }, [
    registry.isError,
    registry.isLoading,
    registry.modules,
    registry.snapshot?.catalogGeneration,
    registry.snapshot?.entitlementVersion,
    roles,
    rolesHash,
    tenantId,
    userId,
    useRegistry,
    branchSnapshotVersion,
    activeBranchId,
    refreshNonce,
  ]);

  return (
    <DynamicDashboardContext.Provider value={value}>{children}</DynamicDashboardContext.Provider>
  );
}

export function useDynamicDashboard(): DynamicDashboardContextValue {
  const ctx = useContext(DynamicDashboardContext);
  if (!ctx) {
    throw new Error('useDynamicDashboard must be used within DynamicDashboardProvider');
  }
  return ctx;
}

export function useOptionalDynamicDashboard(): DynamicDashboardContextValue | null {
  return useContext(DynamicDashboardContext);
}
