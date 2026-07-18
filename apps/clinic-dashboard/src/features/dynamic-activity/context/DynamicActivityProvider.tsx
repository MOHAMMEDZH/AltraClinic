import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  buildActivityCacheKey,
  clearActivityCache,
  readActivityCache,
  readActivityCacheForIdentity,
  writeActivityCache,
} from '../lib/activity-cache';
import {
  buildRegistryActivitySnapshot,
  buildRestrictedActivitySnapshot,
  buildStaticActivitySnapshot,
} from '../lib/activity-snapshot-builder';
import { STATIC_ACTIVITY_CATALOG } from '../lib/static-activity-catalog';
import { isRegistryActivityEnabled } from '../lib/activity-flags';
import { assertActivityCatalogLoaded } from '../lib/activity-validation';
import type {
  ActivityCapabilityFlags,
  ActivityCatalogSource,
  ActivityCategorySnapshot,
  ActivityFeedSnapshot,
  ActivityHubSnapshot,
  ActivitySeveritySnapshot,
  ActivitySnapshot,
  ActivityTypeSnapshot,
  EffectiveActivityView,
} from '../lib/activity-types';

assertActivityCatalogLoaded();

function resolveRegistrySnapshot(
  roles: string[],
  modules: ReturnType<typeof useModuleRegistry>['modules'],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
  identity: ActivitySnapshot['identity'],
): ActivitySnapshot {
  return buildRegistryActivitySnapshot(
    roles,
    STATIC_ACTIVITY_CATALOG,
    modules,
    catalogGeneration,
    entitlementVersion,
    identity,
  );
}

function toContextValue(
  snapshot: ActivitySnapshot,
  options: {
    isRegistrySource: boolean;
    isLoading: boolean;
    error: Error | null;
    registryStatus: DynamicActivityContextValue['registryStatus'];
    refresh: () => Promise<void>;
    branchSnapshotVersion: string | null;
    activeBranchId: string | null;
  },
): DynamicActivityContextValue {
  return {
    snapshot,
    view: snapshot.view,
    categories: snapshot.categories,
    severities: snapshot.severities,
    activityTypes: snapshot.activityTypes,
    feeds: snapshot.feeds,
    hubs: snapshot.hubs,
    capabilities: snapshot.capabilities,
    canViewActivity: snapshot.canViewActivity,
    canViewClinicalFeed: snapshot.canViewClinicalFeed,
    canViewFinancialFeed: snapshot.canViewFinancialFeed,
    canViewInventoryFeed: snapshot.canViewInventoryFeed,
    canViewSecurityFeed: snapshot.canViewSecurityFeed,
    canViewBranchFeed: snapshot.canViewBranchFeed,
    canViewMyFeed: snapshot.canViewMyFeed,
    source: snapshot.source,
    activitySnapshotVersion: snapshot.activitySnapshotVersion,
    providerKey: snapshot.providerKey,
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

export interface DynamicActivityContextValue {
  snapshot: ActivitySnapshot;
  view: EffectiveActivityView;
  categories: ActivityCategorySnapshot[];
  severities: ActivitySeveritySnapshot[];
  activityTypes: ActivityTypeSnapshot[];
  feeds: ActivityFeedSnapshot[];
  hubs: ActivityHubSnapshot[];
  capabilities: ActivityCapabilityFlags;
  canViewActivity: boolean;
  canViewClinicalFeed: boolean;
  canViewFinancialFeed: boolean;
  canViewInventoryFeed: boolean;
  canViewSecurityFeed: boolean;
  canViewBranchFeed: boolean;
  canViewMyFeed: boolean;
  source: ActivityCatalogSource;
  activitySnapshotVersion: string;
  providerKey: string;
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

const DynamicActivityContext = createContext<DynamicActivityContextValue | null>(null);

export function DynamicActivityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const rolesHash = buildRolesHash(roles);
  const tenantId = user?.tenantId ?? '';
  const userId = user?.userId ?? '';
  const registry = useModuleRegistry();
  const branchCtx = useOptionalBranch();
  const useRegistry = isRegistryActivityEnabled();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const lastRegistrySnapshotRef = useRef<{
    identityKey: string;
    snapshot: ActivitySnapshot;
  } | null>(null);
  const lastIdentityKeyRef = useRef<string | null>(null);
  const branchSnapshotVersion = branchCtx?.branchSnapshotVersion ?? null;
  const activeBranchId = branchCtx?.activeBranchId ?? null;

  const refresh = useCallback(async () => {
    clearActivityCache();
    lastRegistrySnapshotRef.current = null;
    setRefreshNonce((value) => value + 1);
    await registry.refresh();
  }, [registry]);

  useRegisterBranchConsumer('activity', () => {
    clearActivityCache();
    lastRegistrySnapshotRef.current = null;
    setRefreshNonce((value) => value + 1);
  });

  const value = useMemo<DynamicActivityContextValue>(() => {
    void refreshNonce;

    const identity = {
      tenantId,
      userId,
      rolesHash,
      branchId: activeBranchId,
    };
    const identityKey = `${tenantId}:${userId}:${rolesHash}:${activeBranchId ?? 'none'}:${branchSnapshotVersion ?? 'none'}`;
    const catalogGeneration = registry.snapshot?.catalogGeneration ?? null;
    const entitlementVersion = registry.snapshot?.entitlementVersion ?? null;
    const registryStatus: DynamicActivityContextValue['registryStatus'] = registry.isError
      ? 'error'
      : registry.isLoading
        ? 'loading'
        : 'ready';

    if (lastIdentityKeyRef.current && lastIdentityKeyRef.current !== identityKey) {
      clearActivityCache();
      lastRegistrySnapshotRef.current = null;
    }
    lastIdentityKeyRef.current = identityKey;

    const staticSnapshot = buildStaticActivitySnapshot(
      roles,
      STATIC_ACTIVITY_CATALOG,
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

    const resolveKnownRegistrySnapshot = (): ActivitySnapshot | null => {
      const last = lastRegistrySnapshotRef.current;
      if (last?.identityKey === identityKey) {
        return last.snapshot;
      }

      const activityCached = readActivityCacheForIdentity({
        tenantId,
        userId,
        rolesHash,
        branchId: activeBranchId,
        catalogGeneration,
        entitlementVersion,
      });
      if (activityCached) {
        return activityCached;
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
        buildRestrictedActivitySnapshot(identity, catalogGeneration, entitlementVersion),
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

    const provisionalVersion = [
      catalogGeneration ?? 'none',
      entitlementVersion ?? 'none',
      activeBranchId ?? 'none',
      'registry',
    ].join('#');

    const cacheKey = buildActivityCacheKey({
      tenantId,
      userId,
      rolesHash,
      branchId: activeBranchId,
      catalogGeneration,
      entitlementVersion,
      activitySnapshotVersion: provisionalVersion,
      moduleCount: registry.modules.length,
      source: 'registry',
    });

    const cached = readActivityCache(cacheKey);
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
      const versionedKey = buildActivityCacheKey({
        tenantId,
        userId,
        rolesHash,
        branchId: activeBranchId,
        catalogGeneration,
        entitlementVersion,
        activitySnapshotVersion: snapshot.activitySnapshotVersion,
        moduleCount: registry.modules.length,
        source: 'registry',
      });
      writeActivityCache(versionedKey, snapshot);
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

  // Phase 38c acceptance probe — publishes snapshot metadata only (no business logic).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (
      window as Window & {
        __BOOKING_ACTIVITY_RUNTIME__?: {
          source: string;
          isRegistrySource: boolean;
          activitySnapshotVersion: string;
          providerKey: string;
          tenantId: string;
          userId: string;
          branchId: string | null;
          branchSnapshotVersion: string | null;
          catalogGeneration: number | null;
          entitlementVersion: string | null;
          registryStatus: string;
          feedCount: number;
          typeCount: number;
          hubCount: number;
          canViewActivity: boolean;
          canViewClinicalFeed: boolean;
          canViewFinancialFeed: boolean;
          canViewInventoryFeed: boolean;
          canViewSecurityFeed: boolean;
          canViewBranchFeed: boolean;
          canViewMyFeed: boolean;
          feedIds: string[];
        };
        __BOOKING_ACTIVITY_ACTIONS__?: {
          refresh: () => Promise<void>;
        };
      }
    ).__BOOKING_ACTIVITY_RUNTIME__ = {
      source: value.source,
      isRegistrySource: value.isRegistrySource,
      activitySnapshotVersion: value.activitySnapshotVersion,
      providerKey: value.providerKey,
      tenantId: value.snapshot.identity.tenantId,
      userId: value.snapshot.identity.userId,
      branchId: value.activeBranchId,
      branchSnapshotVersion: value.branchSnapshotVersion,
      catalogGeneration: value.catalogGeneration,
      entitlementVersion: value.entitlementVersion,
      registryStatus: value.registryStatus,
      feedCount: value.feeds.length,
      typeCount: value.activityTypes.length,
      hubCount: value.hubs.length,
      canViewActivity: value.canViewActivity,
      canViewClinicalFeed: value.canViewClinicalFeed,
      canViewFinancialFeed: value.canViewFinancialFeed,
      canViewInventoryFeed: value.canViewInventoryFeed,
      canViewSecurityFeed: value.canViewSecurityFeed,
      canViewBranchFeed: value.canViewBranchFeed,
      canViewMyFeed: value.canViewMyFeed,
      feedIds: value.feeds.map((feed) => feed.feedId),
    };
    (
      window as Window & {
        __BOOKING_ACTIVITY_ACTIONS__?: { refresh: () => Promise<void> };
      }
    ).__BOOKING_ACTIVITY_ACTIONS__ = {
      refresh: value.refresh,
    };
  }, [value]);

  return (
    <DynamicActivityContext.Provider value={value}>{children}</DynamicActivityContext.Provider>
  );
}

export function useActivity(): DynamicActivityContextValue {
  const ctx = useContext(DynamicActivityContext);
  if (!ctx) {
    throw new Error('useActivity must be used within DynamicActivityProvider');
  }
  return ctx;
}

export function useOptionalActivity(): DynamicActivityContextValue | null {
  return useContext(DynamicActivityContext);
}
