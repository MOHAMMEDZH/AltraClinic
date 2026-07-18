import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { CLINIC_NAV_ITEMS, filterNavItems } from '@booking/permissions';
import { useAuth } from '@/app/providers/AuthProvider';
import { useModuleRegistry } from '@/features/module-registry/context/ModuleRegistryProvider';
import { useOptionalBranch } from '@/features/dynamic-branch/context/DynamicBranchProvider';
import { useRegisterBranchConsumer } from '@/features/dynamic-branch/hooks/useRegisterBranchConsumer';
import { buildRolesHash } from '@/features/module-registry/lib/registry-cache-identity';
import {
  buildNavigationCacheKey,
  clearNavigationCache,
  readNavigationCache,
  writeNavigationCache,
} from '../lib/navigation-cache';
import { buildNavigationSnapshot, toSidebarNavItems } from '../lib/navigation-builder';
import { resolveNavigationItems } from '../lib/navigation-resolver';
import {
  isRegistryNavigationEnabled,
  STATIC_NAV_ROLE_BY_PATH,
} from '../lib/static-nav-role-map';
import type { NavigationSnapshot, SidebarNavItem } from '../lib/navigation-types';

export interface DynamicNavigationContextValue {
  snapshot: NavigationSnapshot;
  sidebarItems: SidebarNavItem[];
  isRegistrySource: boolean;
  isLoading: boolean;
  branchSnapshotVersion: string | null;
  activeBranchId: string | null;
}

const DynamicNavigationContext = createContext<DynamicNavigationContextValue | null>(null);

function buildStaticFallbackSnapshot(roles: string[]): NavigationSnapshot {
  const sidebar = filterNavItems(CLINIC_NAV_ITEMS, roles);
  return buildNavigationSnapshot({
    catalogGeneration: null,
    source: 'static-fallback',
    sidebar: sidebar.map((item) => ({
      id: item.id,
      extensionId: `static/${item.id}`,
      moduleId: 'static',
      path: item.path,
      labelKey: item.labelKey,
      icon: item.icon,
      placement: 'sidebar' as const,
      sortOrder: CLINIC_NAV_ITEMS.findIndex((n) => n.id === item.id),
      resourceId: item.resourceId,
      userAccessible: true,
    })),
    settings: [],
    topNav: [],
    quickNav: [],
  });
}

function resolveRegistrySnapshot(
  modules: ReturnType<typeof useModuleRegistry>['modules'],
  catalogGeneration: number | null,
  roles: string[],
): NavigationSnapshot {
  const resolveOptions = {
    roles,
    roleConstraintsByPath: STATIC_NAV_ROLE_BY_PATH,
    accessibleOnly: true,
  };

  const sidebar = resolveNavigationItems(modules, 'sidebar', resolveOptions);
  const settings = resolveNavigationItems(modules, 'settings', resolveOptions);
  const topNav = resolveNavigationItems(modules, 'topNav', resolveOptions);
  const quickNav = resolveNavigationItems(modules, 'quickNav', resolveOptions);

  return buildNavigationSnapshot({
    catalogGeneration,
    source: 'registry',
    sidebar,
    settings,
    topNav,
    quickNav,
  });
}

export function DynamicNavigationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const rolesHash = buildRolesHash(roles);
  const tenantId = user?.tenantId ?? '';
  const userId = user?.userId ?? '';
  const registry = useModuleRegistry();
  const branchCtx = useOptionalBranch();
  const useRegistry = isRegistryNavigationEnabled();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const branchSnapshotVersion = branchCtx?.branchSnapshotVersion ?? null;
  const activeBranchId = branchCtx?.activeBranchId ?? null;

  useRegisterBranchConsumer('navigation', () => {
    clearNavigationCache();
    setRefreshNonce((value) => value + 1);
  });

  const value = useMemo<DynamicNavigationContextValue>(() => {
    void refreshNonce;
    const fallback = buildStaticFallbackSnapshot(roles);

    if (!useRegistry || registry.isError) {
      return {
        snapshot: fallback,
        sidebarItems: toSidebarNavItems(fallback.sidebar),
        isRegistrySource: false,
        isLoading: registry.isLoading,
        branchSnapshotVersion,
        activeBranchId,
      };
    }

    if (registry.isLoading && registry.modules.length === 0) {
      return {
        snapshot: fallback,
        sidebarItems: toSidebarNavItems(fallback.sidebar),
        isRegistrySource: false,
        isLoading: true,
        branchSnapshotVersion,
        activeBranchId,
      };
    }

    const cacheKey = buildNavigationCacheKey({
      tenantId,
      userId,
      rolesHash,
      catalogGeneration: registry.snapshot?.catalogGeneration ?? null,
      entitlementVersion: registry.snapshot?.entitlementVersion ?? null,
      moduleCount: registry.modules.length,
      source: 'registry',
      branchSnapshotVersion,
    });

    const cached = readNavigationCache(cacheKey);
    const snapshot =
      cached ??
      resolveRegistrySnapshot(
        registry.modules,
        registry.snapshot?.catalogGeneration ?? null,
        roles,
      );

    if (!cached) {
      writeNavigationCache(cacheKey, snapshot);
    }

    return {
      snapshot,
      sidebarItems: toSidebarNavItems(snapshot.sidebar),
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
    <DynamicNavigationContext.Provider value={value}>{children}</DynamicNavigationContext.Provider>
  );
}

export function useDynamicNavigation(): DynamicNavigationContextValue {
  const ctx = useContext(DynamicNavigationContext);
  if (!ctx) {
    throw new Error('useDynamicNavigation must be used within DynamicNavigationProvider');
  }
  return ctx;
}

/** Sidebar hook — returns NavItemDefinition-compatible items. */
export function useSidebarNavigation(): SidebarNavItem[] {
  return useDynamicNavigation().sidebarItems;
}

export function useOptionalDynamicNavigation(): DynamicNavigationContextValue | null {
  return useContext(DynamicNavigationContext);
}
