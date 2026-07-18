import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { EffectiveModuleView } from '@booking/module-registry';
import { useAuth } from '@/app/providers/AuthProvider';
import { useModuleRegistry } from '@/features/module-registry/context/ModuleRegistryProvider';
import { useOptionalBranch } from '@/features/dynamic-branch/context/DynamicBranchProvider';
import { useRegisterBranchConsumer } from '@/features/dynamic-branch/hooks/useRegisterBranchConsumer';
import { buildRolesHash } from '@/features/module-registry/lib/registry-cache-identity';
import {
  STATIC_ROUTE_CATALOG,
  collectKioskRoutes,
  collectShellRoutes,
} from '../lib/static-route-catalog';
import { isRegistryRoutingEnabled } from '../lib/static-route-flags';
import {
  buildRouteCacheKey,
  clearRouteCache,
  readRouteCache,
  writeRouteCache,
} from '../lib/route-cache';
import {
  buildRegistryRouteSnapshot,
  buildStaticRouteSnapshot,
} from '../lib/route-tree-builder';
import type { RouteSnapshot } from '../lib/route-types';
import { assertRouteCatalogValid } from '../lib/route-validation';

assertRouteCatalogValid(STATIC_ROUTE_CATALOG);

const STATIC_SHELL_SNAPSHOT = buildStaticRouteSnapshot(collectShellRoutes(STATIC_ROUTE_CATALOG));
const STATIC_KIOSK_SNAPSHOT = buildStaticRouteSnapshot(collectKioskRoutes(STATIC_ROUTE_CATALOG));

export interface DynamicRouteContextValue {
  shellSnapshot: RouteSnapshot;
  kioskSnapshot: RouteSnapshot;
  isRegistrySource: boolean;
  isLoading: boolean;
  branchSnapshotVersion: string | null;
  activeBranchId: string | null;
}

const DynamicRouteContext = createContext<DynamicRouteContextValue | null>(null);

function resolveRegistrySnapshot(
  modules: EffectiveModuleView[],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
): RouteSnapshot {
  return buildRegistryRouteSnapshot(
    collectShellRoutes(STATIC_ROUTE_CATALOG),
    modules,
    catalogGeneration,
    entitlementVersion,
  );
}

export function DynamicRouteProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const rolesHash = buildRolesHash(roles);
  const tenantId = user?.tenantId ?? '';
  const userId = user?.userId ?? '';
  const registry = useModuleRegistry();
  const branchCtx = useOptionalBranch();
  const useRegistry = isRegistryRoutingEnabled();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const branchSnapshotVersion = branchCtx?.branchSnapshotVersion ?? null;
  const activeBranchId = branchCtx?.activeBranchId ?? null;

  useRegisterBranchConsumer('routing', () => {
    clearRouteCache();
    setRefreshNonce((value) => value + 1);
  });

  const value = useMemo<DynamicRouteContextValue>(() => {
    void refreshNonce;
    if (!useRegistry || registry.isError) {
      return {
        shellSnapshot: STATIC_SHELL_SNAPSHOT,
        kioskSnapshot: STATIC_KIOSK_SNAPSHOT,
        isRegistrySource: false,
        isLoading: registry.isLoading,
        branchSnapshotVersion,
        activeBranchId,
      };
    }

    if (registry.isLoading && registry.modules.length === 0) {
      return {
        shellSnapshot: STATIC_SHELL_SNAPSHOT,
        kioskSnapshot: STATIC_KIOSK_SNAPSHOT,
        isRegistrySource: false,
        isLoading: true,
        branchSnapshotVersion,
        activeBranchId,
      };
    }

    const cacheKey = buildRouteCacheKey({
      tenantId,
      userId,
      rolesHash,
      catalogGeneration: registry.snapshot?.catalogGeneration ?? null,
      entitlementVersion: registry.snapshot?.entitlementVersion ?? null,
      moduleCount: registry.modules.length,
      source: 'registry',
      branchSnapshotVersion,
    });

    const cached = readRouteCache(cacheKey);
    const shellSnapshot =
      cached ??
      resolveRegistrySnapshot(
        registry.modules,
        registry.snapshot?.catalogGeneration ?? null,
        registry.snapshot?.entitlementVersion ?? null,
      );

    if (!cached) {
      writeRouteCache(cacheKey, shellSnapshot);
    }

    return {
      shellSnapshot,
      kioskSnapshot: STATIC_KIOSK_SNAPSHOT,
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
    rolesHash,
    tenantId,
    userId,
    useRegistry,
    branchSnapshotVersion,
    activeBranchId,
    refreshNonce,
  ]);

  return <DynamicRouteContext.Provider value={value}>{children}</DynamicRouteContext.Provider>;
}

export function useDynamicRoutes(): DynamicRouteContextValue {
  const ctx = useContext(DynamicRouteContext);
  if (!ctx) {
    throw new Error('useDynamicRoutes must be used within DynamicRouteProvider');
  }
  return ctx;
}

export function useOptionalDynamicRoutes(): DynamicRouteContextValue | null {
  return useContext(DynamicRouteContext);
}
