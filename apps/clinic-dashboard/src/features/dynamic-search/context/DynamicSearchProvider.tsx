import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { readRegistryCache } from '@/features/module-registry/lib/registry-cache';
import { useModuleRegistry } from '@/features/module-registry/context/ModuleRegistryProvider';
import { useOptionalBranch } from '@/features/dynamic-branch/context/DynamicBranchProvider';
import { useRegisterBranchConsumer } from '@/features/dynamic-branch/hooks/useRegisterBranchConsumer';
import { buildRolesHash } from '@/features/module-registry/lib/registry-cache-identity';
import {
  buildSearchCacheKey,
  clearSearchCache,
  readSearchCache,
  readSearchCacheForIdentity,
  writeSearchCache,
} from '../lib/search-cache';
import {
  buildRegistrySearchSnapshot,
  buildRestrictedSearchSnapshot,
  buildStaticSearchSnapshot,
} from '../lib/search-snapshot-builder';
import { STATIC_SEARCH_CATALOG } from '../lib/static-search-catalog';
import { isRegistrySearchEnabled } from '../lib/static-search-flags';
import { assertSearchCatalogLoaded } from '../lib/search-validation';
import type { SearchSnapshot } from '../lib/search-types';

assertSearchCatalogLoaded();

function resolveRegistrySnapshot(
  roles: string[],
  modules: ReturnType<typeof useModuleRegistry>['modules'],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
): SearchSnapshot {
  return buildRegistrySearchSnapshot(
    roles,
    STATIC_SEARCH_CATALOG,
    modules,
    catalogGeneration,
    entitlementVersion,
  );
}

function toContextValue(
  snapshot: SearchSnapshot,
  options: {
    isRegistrySource: boolean;
    isLoading: boolean;
    error: Error | null;
    branchSnapshotVersion: string | null;
    activeBranchId: string | null;
  },
): DynamicSearchContextValue {
  return {
    snapshot,
    entityTypes: snapshot.entityTypes,
    typesParam: snapshot.typesParam,
    enabledModuleIds: snapshot.enabledModuleIds,
    canSearch: snapshot.canSearch,
    isRegistrySource: options.isRegistrySource,
    isLoading: options.isLoading,
    error: options.error,
    branchSnapshotVersion: options.branchSnapshotVersion,
    activeBranchId: options.activeBranchId,
  };
}

export interface DynamicSearchContextValue {
  snapshot: SearchSnapshot;
  entityTypes: string[];
  typesParam: string;
  enabledModuleIds: string[];
  canSearch: boolean;
  isRegistrySource: boolean;
  isLoading: boolean;
  error: Error | null;
  branchSnapshotVersion: string | null;
  activeBranchId: string | null;
}

const DynamicSearchContext = createContext<DynamicSearchContextValue | null>(null);

export function DynamicSearchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const rolesHash = buildRolesHash(roles);
  const tenantId = user?.tenantId ?? '';
  const userId = user?.userId ?? '';
  const registry = useModuleRegistry();
  const branchCtx = useOptionalBranch();
  const useRegistry = isRegistrySearchEnabled();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const lastRegistrySnapshotRef = useRef<{
    identityKey: string;
    snapshot: SearchSnapshot;
  } | null>(null);

  const branchSnapshotVersion = branchCtx?.branchSnapshotVersion ?? null;
  const activeBranchId = branchCtx?.activeBranchId ?? null;

  useRegisterBranchConsumer('search', () => {
    clearSearchCache();
    lastRegistrySnapshotRef.current = null;
    setRefreshNonce((value) => value + 1);
  });

  const value = useMemo<DynamicSearchContextValue>(() => {
    void refreshNonce;
    const identityKey = `${tenantId}:${userId}:${rolesHash}:${branchSnapshotVersion ?? 'none'}`;
    const catalogGeneration = registry.snapshot?.catalogGeneration ?? null;
    const entitlementVersion = registry.snapshot?.entitlementVersion ?? null;

    if (
      lastRegistrySnapshotRef.current &&
      lastRegistrySnapshotRef.current.identityKey !== identityKey
    ) {
      lastRegistrySnapshotRef.current = null;
    }

    const staticSnapshot = buildStaticSearchSnapshot(
      roles,
      STATIC_SEARCH_CATALOG,
      useRegistry ? 'static-fallback' : 'static-only',
    );

    if (!useRegistry || registry.isError) {
      return toContextValue(staticSnapshot, {
        isRegistrySource: false,
        isLoading: registry.isLoading,
        error: registry.error,
        branchSnapshotVersion,
        activeBranchId,
      });
    }

    const resolveKnownRegistrySnapshot = (): SearchSnapshot | null => {
      const last = lastRegistrySnapshotRef.current;
      if (last?.identityKey === identityKey) {
        return last.snapshot;
      }

      const searchCached = readSearchCacheForIdentity({
        tenantId,
        userId,
        rolesHash,
        catalogGeneration,
        entitlementVersion,
      });
      if (searchCached) {
        return searchCached;
      }

      const registryCached = readRegistryCache({ tenantId, userId, rolesHash });
      if (registryCached?.data.modules.length) {
        return resolveRegistrySnapshot(
          roles,
          registryCached.data.modules,
          registryCached.data.snapshot.catalogGeneration,
          registryCached.data.snapshot.entitlementVersion,
        );
      }

      return null;
    };

    if (registry.isLoading && registry.modules.length === 0) {
      const knownSnapshot = resolveKnownRegistrySnapshot();
      if (knownSnapshot) {
        return toContextValue(knownSnapshot, {
          isRegistrySource: true,
          isLoading: true,
          error: null,
          branchSnapshotVersion,
          activeBranchId,
        });
      }

      return toContextValue(buildRestrictedSearchSnapshot(catalogGeneration, entitlementVersion), {
        isRegistrySource: true,
        isLoading: true,
        error: null,
        branchSnapshotVersion,
        activeBranchId,
      });
    }

    const cacheKey = buildSearchCacheKey({
      tenantId,
      userId,
      rolesHash,
      catalogGeneration,
      entitlementVersion,
      moduleCount: registry.modules.length,
      source: 'registry',
      branchSnapshotVersion,
    });

    const cached = readSearchCache(cacheKey);
    const snapshot =
      cached ??
      resolveRegistrySnapshot(
        roles,
        registry.modules,
        catalogGeneration,
        entitlementVersion,
      );

    if (!cached) {
      writeSearchCache(cacheKey, snapshot);
    }

    lastRegistrySnapshotRef.current = { identityKey, snapshot };

    return toContextValue(snapshot, {
      isRegistrySource: true,
      isLoading: registry.isLoading,
      error: null,
      branchSnapshotVersion,
      activeBranchId,
    });
  }, [
    registry.error,
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
    <DynamicSearchContext.Provider value={value}>{children}</DynamicSearchContext.Provider>
  );
}

export function useDynamicSearch(): DynamicSearchContextValue {
  const ctx = useContext(DynamicSearchContext);
  if (!ctx) {
    throw new Error('useDynamicSearch must be used within DynamicSearchProvider');
  }
  return ctx;
}

export function useOptionalDynamicSearch(): DynamicSearchContextValue | null {
  return useContext(DynamicSearchContext);
}
