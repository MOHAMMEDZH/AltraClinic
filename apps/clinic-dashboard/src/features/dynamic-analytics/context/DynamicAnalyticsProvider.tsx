import {
  createContext,
  useCallback,
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
  buildAnalyticsCacheKey,
  clearAnalyticsCache,
  readAnalyticsCache,
  readAnalyticsCacheForIdentity,
  writeAnalyticsCache,
} from '../lib/analytics-cache';
import {
  buildRegistryAnalyticsSnapshot,
  buildRestrictedAnalyticsSnapshot,
  buildStaticAnalyticsSnapshot,
} from '../lib/analytics-snapshot-builder';
import { STATIC_ANALYTICS_CATALOG } from '../lib/static-analytics-catalog';
import { isRegistryAnalyticsEnabled } from '../lib/static-analytics-flags';
import { assertAnalyticsCatalogLoaded } from '../lib/analytics-validation';
import type {
  AnalyticsCapabilities,
  AnalyticsCatalogSource,
  AnalyticsCategorySnapshot,
  AnalyticsDomainSnapshot,
  AnalyticsHubSnapshot,
  AnalyticsMetricDefinitionSnapshot,
  AnalyticsSnapshot,
  AnalyticsSnapshotEntry,
  AnalyticsWidgetSnapshot,
} from '../lib/analytics-types';

assertAnalyticsCatalogLoaded();

function resolveRegistrySnapshot(
  roles: string[],
  modules: ReturnType<typeof useModuleRegistry>['modules'],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
  identity: AnalyticsSnapshot['identity'],
): AnalyticsSnapshot {
  return buildRegistryAnalyticsSnapshot(
    roles,
    STATIC_ANALYTICS_CATALOG,
    modules,
    catalogGeneration,
    entitlementVersion,
    identity,
  );
}

function toContextValue(
  snapshot: AnalyticsSnapshot,
  options: {
    isRegistrySource: boolean;
    isLoading: boolean;
    error: Error | null;
    registryStatus: DynamicAnalyticsContextValue['registryStatus'];
    refresh: () => Promise<void>;
    branchSnapshotVersion: string | null;
    activeBranchId: string | null;
  },
): DynamicAnalyticsContextValue {
  return {
    snapshot,
    entries: snapshot.entries,
    domains: snapshot.domains,
    widgets: snapshot.widgets,
    hubs: snapshot.hubs,
    categories: snapshot.categories,
    metrics: snapshot.metrics,
    capabilities: snapshot.capabilities,
    canViewAnalytics: snapshot.canViewAnalytics,
    canCreateDashboards: snapshot.canCreateDashboards,
    canExportAnalytics: snapshot.canExportAnalytics,
    canScheduleAnalytics: snapshot.canScheduleAnalytics,
    source: snapshot.source,
    isRegistrySource: options.isRegistrySource,
    isLoading: options.isLoading,
    error: options.error,
    registryStatus: options.registryStatus,
    catalogGeneration: snapshot.catalogGeneration,
    entitlementVersion: snapshot.entitlementVersion,
    refresh: options.refresh,
    branchSnapshotVersion: options.branchSnapshotVersion,
    activeBranchId: options.activeBranchId,
  };
}

export interface DynamicAnalyticsContextValue {
  snapshot: AnalyticsSnapshot;
  entries: AnalyticsSnapshotEntry[];
  domains: AnalyticsDomainSnapshot[];
  widgets: AnalyticsWidgetSnapshot[];
  hubs: AnalyticsHubSnapshot[];
  categories: AnalyticsCategorySnapshot[];
  metrics: AnalyticsMetricDefinitionSnapshot[];
  capabilities: AnalyticsCapabilities;
  canViewAnalytics: boolean;
  canCreateDashboards: boolean;
  canExportAnalytics: boolean;
  canScheduleAnalytics: boolean;
  source: AnalyticsCatalogSource;
  isRegistrySource: boolean;
  isLoading: boolean;
  error: Error | null;
  registryStatus: 'loading' | 'ready' | 'error';
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  refresh: () => Promise<void>;
  branchSnapshotVersion: string | null;
  activeBranchId: string | null;
}

const DynamicAnalyticsContext = createContext<DynamicAnalyticsContextValue | null>(null);

export function DynamicAnalyticsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const rolesHash = buildRolesHash(roles);
  const tenantId = user?.tenantId ?? '';
  const userId = user?.userId ?? '';
  const registry = useModuleRegistry();
  const branchCtx = useOptionalBranch();
  const useRegistry = isRegistryAnalyticsEnabled();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const lastRegistrySnapshotRef = useRef<{
    identityKey: string;
    snapshot: AnalyticsSnapshot;
  } | null>(null);
  const lastIdentityKeyRef = useRef<string | null>(null);
  const branchSnapshotVersion = branchCtx?.branchSnapshotVersion ?? null;
  const activeBranchId = branchCtx?.activeBranchId ?? null;

  const refresh = useCallback(async () => {
    clearAnalyticsCache();
    lastRegistrySnapshotRef.current = null;
    setRefreshNonce((value) => value + 1);
    await registry.refresh();
  }, [registry]);

  useRegisterBranchConsumer('analytics', () => {
    clearAnalyticsCache();
    lastRegistrySnapshotRef.current = null;
    setRefreshNonce((value) => value + 1);
  });

  const value = useMemo<DynamicAnalyticsContextValue>(() => {
    void refreshNonce;

    const identity = { tenantId, userId, rolesHash };
    const identityKey = `${tenantId}:${userId}:${rolesHash}:${branchSnapshotVersion ?? 'none'}`;
    const catalogGeneration = registry.snapshot?.catalogGeneration ?? null;
    const entitlementVersion = registry.snapshot?.entitlementVersion ?? null;
    const registryStatus: DynamicAnalyticsContextValue['registryStatus'] = registry.isError
      ? 'error'
      : registry.isLoading
        ? 'loading'
        : 'ready';

    if (lastIdentityKeyRef.current && lastIdentityKeyRef.current !== identityKey) {
      clearAnalyticsCache();
      lastRegistrySnapshotRef.current = null;
    }
    lastIdentityKeyRef.current = identityKey;

    const staticSnapshot = buildStaticAnalyticsSnapshot(
      roles,
      STATIC_ANALYTICS_CATALOG,
      identity,
      useRegistry ? 'static-fallback' : 'static-only',
    );

    if (!useRegistry || registry.isError) {
      return toContextValue(staticSnapshot, {
        isRegistrySource: false,
        isLoading: registry.isLoading,
        error: registry.error,
        registryStatus,
        refresh,
        branchSnapshotVersion,
        activeBranchId,
      });
    }

    const resolveKnownRegistrySnapshot = (): AnalyticsSnapshot | null => {
      const last = lastRegistrySnapshotRef.current;
      if (last?.identityKey === identityKey) {
        return last.snapshot;
      }

      const analyticsCached = readAnalyticsCacheForIdentity({
        tenantId,
        userId,
        rolesHash,
        catalogGeneration,
        entitlementVersion,
      });
      if (analyticsCached) {
        return analyticsCached;
      }

      const registryCached = readRegistryCache({ tenantId, userId, rolesHash });
      if (registryCached?.data.modules.length) {
        return resolveRegistrySnapshot(
          roles,
          registryCached.data.modules,
          registryCached.data.snapshot.catalogGeneration,
          registryCached.data.snapshot.entitlementVersion,
          identity,
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
          registryStatus,
          refresh,
          branchSnapshotVersion,
          activeBranchId,
        });
      }

      return toContextValue(
        buildRestrictedAnalyticsSnapshot(identity, catalogGeneration, entitlementVersion),
        {
          isRegistrySource: true,
          isLoading: true,
          error: null,
          registryStatus,
          refresh,
          branchSnapshotVersion,
          activeBranchId,
        },
      );
    }

    const cacheKey = buildAnalyticsCacheKey({
      tenantId,
      userId,
      rolesHash,
      catalogGeneration,
      entitlementVersion,
      moduleCount: registry.modules.length,
      source: 'registry',
      branchSnapshotVersion,
    });

    const cached = readAnalyticsCache(cacheKey);
    const snapshot =
      cached ??
      resolveRegistrySnapshot(
        roles,
        registry.modules,
        catalogGeneration,
        entitlementVersion,
        identity,
      );

    if (!cached) {
      writeAnalyticsCache(cacheKey, snapshot);
    }

    lastRegistrySnapshotRef.current = { identityKey, snapshot };

    return toContextValue(snapshot, {
      isRegistrySource: true,
      isLoading: registry.isLoading,
      error: null,
      registryStatus,
      refresh,
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
    refresh,
    refreshNonce,
    roles,
    rolesHash,
    tenantId,
    userId,
    useRegistry,
    branchSnapshotVersion,
    activeBranchId,
  ]);

  return (
    <DynamicAnalyticsContext.Provider value={value}>{children}</DynamicAnalyticsContext.Provider>
  );
}

export function useDynamicAnalytics(): DynamicAnalyticsContextValue {
  const ctx = useContext(DynamicAnalyticsContext);
  if (!ctx) {
    throw new Error('useDynamicAnalytics must be used within DynamicAnalyticsProvider');
  }
  return ctx;
}

export function useOptionalDynamicAnalytics(): DynamicAnalyticsContextValue | null {
  return useContext(DynamicAnalyticsContext);
}

