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
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { readRegistryCache } from '@/features/module-registry/lib/registry-cache';
import { useOptionalModuleRegistry } from '@/features/module-registry/context/ModuleRegistryProvider';
import { buildRolesHash } from '@/features/module-registry/lib/registry-cache-identity';
import { fetchDashboardBranches } from '@/features/dashboard/api/dashboard-api';
import { canSelectDashboardBranch } from '@/features/dashboard/config/dashboard-branch-scope';
import { useTenantSettings } from '@/features/settings/hooks/useSettings';
import {
  buildBranchCacheKey,
  clearBranchCache,
  readBranchCache,
  readBranchCacheForIdentity,
  writeBranchCache,
} from '../lib/branch-cache';
import {
  clearPublishedBranchContext,
  getPublishedBranchContext,
  publishBranchContext,
} from '../lib/branch-context-bus';
import {
  runBranchContextRefresh,
  toBranchContextPayload,
  type BranchTransactionSnapshot,
} from '../lib/branch-context-refresh-contract';
import { buildBranchSettingsReadModel } from '../lib/branch-read-model';
import {
  buildRegistryBranchSnapshot,
  buildRestrictedBranchSnapshot,
  buildStaticBranchSnapshot,
} from '../lib/branch-snapshot-builder';
import { STATIC_BRANCH_CATALOG } from '../lib/static-branch-catalog';
import { isRegistryBranchEnabled } from '../lib/static-branch-flags';
import { assertBranchCatalogLoaded, assertBranchSnapshotValid } from '../lib/branch-validation';
import {
  clearActiveBranchSession,
  readActiveBranchSession,
  writeActiveBranchSession,
} from '../lib/branch-session';
import type {
  BranchCapabilityFlags,
  BranchResolutionSource,
  BranchSnapshot,
  BranchSummarySnapshot,
} from '../lib/branch-types';

assertBranchCatalogLoaded();

function toSummaries(
  branches: Array<{ id: string; name: string; nameAr: string | null }> | undefined,
  primaryBranchId: string | null,
): BranchSummarySnapshot[] {
  if (branches?.length) {
    return branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      nameAr: branch.nameAr,
      isActive: true,
    }));
  }
  if (primaryBranchId) {
    return [{ id: primaryBranchId, name: 'Primary', nameAr: null, isActive: true }];
  }
  return [];
}

function toContextValue(
  snapshot: BranchSnapshot,
  options: {
    isRegistrySource: boolean;
    isLoading: boolean;
    error: Error | null;
    registryStatus: DynamicBranchContextValue['registryStatus'];
    refresh: () => Promise<void>;
    setActiveBranchId: (branchId: string | null) => Promise<void>;
    isRefreshing: boolean;
  },
): DynamicBranchContextValue {
  const validationErrors = assertBranchSnapshotValid(snapshot);
  if (validationErrors.length > 0 && snapshot.source === 'registry') {
    console.error('[DynamicBranchProvider] invalid snapshot', validationErrors);
  }

  return {
    snapshot,
    view: snapshot.view,
    activeBranchId: snapshot.activeBranchId,
    accessibleBranchIds: snapshot.accessibleBranchIds,
    branches: snapshot.view.branches,
    activeBranch: snapshot.view.activeBranch,
    configuration: snapshot.view.configuration,
    capabilities: snapshot.capabilities,
    canAccessBranch: snapshot.capabilities.canAccessBranch,
    canSwitchBranch: snapshot.capabilities.canSwitchBranch,
    canViewCrossBranch: snapshot.capabilities.canViewCrossBranch,
    canManageBranchSettings: snapshot.capabilities.canManageBranchSettings,
    canUseBranchBranding: snapshot.capabilities.canUseBranchBranding,
    source: snapshot.source,
    isRegistrySource: options.isRegistrySource,
    isLoading: options.isLoading,
    isError: Boolean(options.error) || validationErrors.length > 0,
    error: options.error,
    registryStatus: options.registryStatus,
    catalogGeneration: snapshot.catalogGeneration,
    settingsVersion: snapshot.settingsVersion,
    branchSnapshotVersion: snapshot.branchSnapshotVersion,
    isRefreshing: options.isRefreshing,
    refresh: options.refresh,
    setActiveBranchId: options.setActiveBranchId,
  };
}

export interface DynamicBranchContextValue {
  snapshot: BranchSnapshot;
  view: BranchSnapshot['view'];
  activeBranchId: string | null;
  accessibleBranchIds: string[];
  branches: BranchSummarySnapshot[];
  activeBranch: BranchSnapshot['view']['activeBranch'];
  configuration: BranchSnapshot['view']['configuration'];
  capabilities: BranchCapabilityFlags;
  canAccessBranch: boolean;
  canSwitchBranch: boolean;
  canViewCrossBranch: boolean;
  canManageBranchSettings: boolean;
  canUseBranchBranding: boolean;
  source: BranchResolutionSource;
  isRegistrySource: boolean;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  registryStatus: 'idle' | 'loading' | 'ready' | 'error' | 'disabled';
  catalogGeneration: number | null;
  settingsVersion: string;
  branchSnapshotVersion: string;
  /** True while BranchContextRefreshContract transaction is in flight. */
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  /** Client authority — validates access, runs §20 transaction. No server mutation. */
  setActiveBranchId: (branchId: string | null) => Promise<void>;
}

const DynamicBranchContext = createContext<DynamicBranchContextValue | null>(null);

export function DynamicBranchProvider({ children }: { children: ReactNode }) {
  const { user, getValidAccessToken } = useAuth();
  const { locale } = useI18n();
  const queryClient = useQueryClient();
  const registry = useOptionalModuleRegistry();
  const useRegistry = isRegistryBranchEnabled() && registry != null;
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const roles = user?.roles ?? [];
  const rolesHash = buildRolesHash(roles);
  const tenantId = user?.tenantId ?? '';
  const userId = user?.userId ?? '';
  const primaryBranchId = user?.branchId ?? null;
  const isAuthenticated = Boolean(tenantId && userId);
  const canSelectBranches = canSelectDashboardBranch(roles);

  const branchesQuery = useQuery({
    queryKey: ['dashboard', 'branches', tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !tenantId) throw new Error('Not authenticated');
      return fetchDashboardBranches(token, tenantId);
    },
    enabled: isAuthenticated && canSelectBranches,
    staleTime: 300_000,
  });

  const tenantSettings = useTenantSettings(isAuthenticated);

  const lastRegistrySnapshotRef = useRef<{
    identityKey: string;
    snapshot: BranchSnapshot;
  } | null>(null);
  const lastIdentityKeyRef = useRef<string | null>(null);
  const publishedReadyKeyRef = useRef<string | null>(null);

  const rebuildInputsRef = useRef({
    locale,
    roles,
    rolesHash,
    tenantId,
    userId,
    primaryBranchId,
    useRegistry,
    branchSummaries: [] as BranchSummarySnapshot[],
    settingsVersionSeed: '',
    timezone: 'UTC',
    tenantName: 'Clinic',
    clinicProfile: {} as Record<string, unknown>,
    catalogGeneration: null as number | null,
    entitlementVersion: null as string | null,
    modules: [] as NonNullable<typeof registry>['modules'],
  });

  rebuildInputsRef.current = {
    locale,
    roles,
    rolesHash,
    tenantId: tenantId || 'guest',
    userId: userId || 'guest',
    primaryBranchId,
    useRegistry,
    branchSummaries: toSummaries(branchesQuery.data, primaryBranchId),
    settingsVersionSeed: [
      tenantId,
      primaryBranchId ?? 'none',
      toSummaries(branchesQuery.data, primaryBranchId).length,
      tenantSettings.dataUpdatedAt ?? 0,
    ].join('|'),
    timezone: tenantSettings.data?.timezone ?? 'UTC',
    tenantName: tenantSettings.data?.name ?? 'Clinic',
    clinicProfile: tenantSettings.data?.clinicProfile ?? {},
    catalogGeneration: registry?.snapshot?.catalogGeneration ?? null,
    entitlementVersion: registry?.snapshot?.entitlementVersion ?? null,
    modules: registry?.modules ?? [],
  };

  const rebuildEffectiveBranchView = useCallback((): BranchSnapshot => {
    const input = rebuildInputsRef.current;
    const sessionBranchId = readActiveBranchSession();
    const readModel = buildBranchSettingsReadModel({
      tenantId: input.tenantId,
      locale: input.locale,
      timezone: input.timezone,
      tenantName: input.tenantName,
      clinicProfile: input.clinicProfile,
      settingsVersion: input.settingsVersionSeed,
    });
    const identity = {
      tenantId: input.tenantId,
      userId: input.userId,
      rolesHash: input.rolesHash || 'guest',
      locale: input.locale,
      activeBranchId: sessionBranchId,
      primaryBranchId: input.primaryBranchId,
    };
    const access = {
      roles: input.roles,
      primaryBranchId: input.primaryBranchId,
      branches: input.branchSummaries,
      sessionBranchId,
    };
    const identityKey = [
      input.tenantId,
      input.userId,
      input.rolesHash,
      input.locale,
      input.primaryBranchId ?? 'none',
    ].join(':');

    if (!input.useRegistry) {
      const snapshot = buildStaticBranchSnapshot(
        STATIC_BRANCH_CATALOG,
        readModel,
        access,
        identity,
        input.roles,
        'static-only',
      );
      lastRegistrySnapshotRef.current = { identityKey, snapshot };
      return snapshot;
    }

    if (!input.modules.length) {
      const snapshot = buildRestrictedBranchSnapshot(
        identity,
        input.roles,
        input.catalogGeneration,
        input.entitlementVersion,
      );
      lastRegistrySnapshotRef.current = { identityKey, snapshot };
      return snapshot;
    }

    const snapshot = buildRegistryBranchSnapshot(
      STATIC_BRANCH_CATALOG,
      input.modules,
      readModel,
      access,
      input.catalogGeneration,
      input.entitlementVersion,
      identity,
      input.roles,
    );

    const cacheKey = buildBranchCacheKey({
      tenantId: identity.tenantId,
      userId: identity.userId,
      rolesHash: identity.rolesHash,
      activeBranchId: snapshot.activeBranchId,
      catalogGeneration: input.catalogGeneration,
      entitlementVersion: input.entitlementVersion,
      settingsVersion: input.settingsVersionSeed,
      source: 'registry',
      moduleCount: input.modules.length,
    });
    writeBranchCache(cacheKey, snapshot);
    if (snapshot.activeBranchId !== sessionBranchId) {
      writeActiveBranchSession(snapshot.activeBranchId);
    }
    lastRegistrySnapshotRef.current = { identityKey, snapshot };
    return snapshot;
  }, []);

  const capturePrevious = useCallback((): BranchTransactionSnapshot => {
    const snapshot = lastRegistrySnapshotRef.current?.snapshot ?? null;
    return {
      activeBranchId: readActiveBranchSession(),
      branchSnapshot: snapshot,
      payload: snapshot
        ? toBranchContextPayload(snapshot, 'branch.context.changed')
        : getPublishedBranchContext(),
    };
  }, []);

  const runContract = useCallback(
    async (options: {
      event: Parameters<typeof runBranchContextRefresh>[0]['event'];
      nextActiveBranchId?: string | null;
      skipPersist?: boolean;
    }) => {
      setIsRefreshing(true);
      try {
        const previous = capturePrevious();
        const result = await runBranchContextRefresh({
          event: options.event,
          previous,
          nextActiveBranchId: options.nextActiveBranchId,
          skipPersist: options.skipPersist,
          hooks: {
            invalidateBranchCache: () => {
              clearBranchCache();
            },
            persistActiveBranchId: (branchId) => {
              writeActiveBranchSession(branchId);
            },
            restoreActiveBranchId: (branchId) => {
              writeActiveBranchSession(branchId);
            },
            restoreBranchSnapshot: (snapshot) => {
              if (!snapshot) {
                lastRegistrySnapshotRef.current = null;
                clearBranchCache();
                return;
              }
              const identityKey = [
                snapshot.identity.tenantId,
                snapshot.identity.userId,
                snapshot.identity.rolesHash,
                snapshot.identity.locale,
                snapshot.identity.primaryBranchId ?? 'none',
              ].join(':');
              lastRegistrySnapshotRef.current = { identityKey, snapshot };
              const cacheKey = buildBranchCacheKey({
                tenantId: snapshot.identity.tenantId,
                userId: snapshot.identity.userId,
                rolesHash: snapshot.identity.rolesHash,
                activeBranchId: snapshot.activeBranchId,
                catalogGeneration: snapshot.catalogGeneration,
                entitlementVersion: snapshot.entitlementVersion,
                settingsVersion: snapshot.settingsVersion,
                source: snapshot.source === 'registry' ? 'registry' : snapshot.source,
                moduleCount: snapshot.entries.length,
              });
              writeBranchCache(cacheKey, snapshot);
            },
            rebuildEffectiveBranchView,
          },
        });

        setRefreshNonce((value) => value + 1);

        if (!result.ok) {
          throw result.error ?? new Error('BranchContextRefreshContract failed');
        }
      } finally {
        setIsRefreshing(false);
      }
    },
    [capturePrevious, rebuildEffectiveBranchView],
  );

  const refresh = useCallback(async () => {
    lastRegistrySnapshotRef.current = null;
    await queryClient.invalidateQueries({ queryKey: ['dashboard', 'branches'] });
    await queryClient.invalidateQueries({ queryKey: ['settings'] });
    await registry?.refresh();
    await runContract({
      event: 'branch.config.changed',
      skipPersist: true,
    });
  }, [queryClient, registry, runContract]);

  const setActiveBranchId = useCallback(
    async (branchId: string | null) => {
      const snapshot = lastRegistrySnapshotRef.current?.snapshot;
      const accessible = snapshot?.accessibleBranchIds ?? [];
      const canSelect = snapshot?.view.canSelectBranch ?? false;

      if (branchId != null) {
        if (!canSelect || !accessible.includes(branchId)) {
          throw new Error('BranchAccessDeniedError');
        }
      } else if (!snapshot?.view.canViewCrossBranch) {
        throw new Error('BranchAccessDeniedError');
      }

      await runContract({
        event: 'branch.context.changed',
        nextActiveBranchId: branchId,
      });
    },
    [runContract],
  );

  const value = useMemo<DynamicBranchContextValue>(() => {
    void refreshNonce;

    const sessionBranchId = readActiveBranchSession();
    const branchSummaries = toSummaries(branchesQuery.data, primaryBranchId);
    const settingsVersionSeed = [
      tenantId,
      primaryBranchId ?? 'none',
      branchSummaries.length,
      tenantSettings.dataUpdatedAt ?? 0,
    ].join('|');

    const readModel = buildBranchSettingsReadModel({
      tenantId: tenantId || 'guest',
      locale,
      timezone: tenantSettings.data?.timezone ?? 'UTC',
      tenantName: tenantSettings.data?.name ?? 'Clinic',
      clinicProfile: tenantSettings.data?.clinicProfile ?? {},
      settingsVersion: settingsVersionSeed,
    });

    const identity = {
      tenantId: tenantId || 'guest',
      userId: userId || 'guest',
      rolesHash: rolesHash || 'guest',
      locale,
      activeBranchId: sessionBranchId,
      primaryBranchId,
    };

    const access = {
      roles,
      primaryBranchId,
      branches: branchSummaries,
      sessionBranchId,
    };

    const identityKey = [tenantId, userId, rolesHash, locale, primaryBranchId ?? 'none'].join(':');

    const catalogGeneration = registry?.snapshot?.catalogGeneration ?? null;
    const entitlementVersion = registry?.snapshot?.entitlementVersion ?? null;

    const registryStatus: DynamicBranchContextValue['registryStatus'] = !useRegistry
      ? 'disabled'
      : registry?.isError
        ? 'error'
        : registry?.isLoading
          ? 'loading'
          : registry
            ? 'ready'
            : 'idle';

    if (lastIdentityKeyRef.current && lastIdentityKeyRef.current !== identityKey) {
      clearBranchCache();
      clearActiveBranchSession();
      clearPublishedBranchContext('branch.context.cleared');
      lastRegistrySnapshotRef.current = null;
      publishedReadyKeyRef.current = null;
    }
    lastIdentityKeyRef.current = identityKey;

    const staticSnapshot = buildStaticBranchSnapshot(
      STATIC_BRANCH_CATALOG,
      readModel,
      access,
      identity,
      roles,
      useRegistry ? 'static-fallback' : 'static-only',
    );

    if (staticSnapshot.activeBranchId !== sessionBranchId) {
      writeActiveBranchSession(staticSnapshot.activeBranchId);
    }

    if (!useRegistry || registry?.isError) {
      return toContextValue(staticSnapshot, {
        isRegistrySource: false,
        isLoading: Boolean(tenantSettings.isLoading || branchesQuery.isLoading),
        error: registry?.error ?? null,
        registryStatus,
        refresh,
        setActiveBranchId,
        isRefreshing,
      });
    }

    const resolveKnownRegistrySnapshot = (): BranchSnapshot | null => {
      const last = lastRegistrySnapshotRef.current;
      if (last?.identityKey === identityKey) {
        return last.snapshot;
      }

      const cached = readBranchCacheForIdentity({
        tenantId: identity.tenantId,
        userId: identity.userId,
        rolesHash: identity.rolesHash,
        activeBranchId: readActiveBranchSession(),
        catalogGeneration,
        entitlementVersion,
        settingsVersion: settingsVersionSeed,
      });
      if (cached) return cached;

      const registryCached = readRegistryCache({
        tenantId: identity.tenantId,
        userId: identity.userId,
        rolesHash: identity.rolesHash,
      });
      if (registryCached?.data.modules.length) {
        return buildRegistryBranchSnapshot(
          STATIC_BRANCH_CATALOG,
          registryCached.data.modules,
          readModel,
          { ...access, sessionBranchId: readActiveBranchSession() },
          registryCached.data.snapshot.catalogGeneration,
          registryCached.data.snapshot.entitlementVersion,
          identity,
          roles,
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
          setActiveBranchId,
          isRefreshing,
        });
      }

      return toContextValue(
        buildRestrictedBranchSnapshot(identity, roles, catalogGeneration, entitlementVersion),
        {
          isRegistrySource: true,
          isLoading: true,
          error: null,
          registryStatus,
          refresh,
          setActiveBranchId,
          isRefreshing,
        },
      );
    }

    const resolvedSessionId = readActiveBranchSession();
    const cacheKey = buildBranchCacheKey({
      tenantId: identity.tenantId,
      userId: identity.userId,
      rolesHash: identity.rolesHash,
      activeBranchId: resolvedSessionId,
      catalogGeneration,
      entitlementVersion,
      settingsVersion: settingsVersionSeed,
      source: 'registry',
      moduleCount: registry.modules.length,
    });

    const cached = readBranchCache(cacheKey);
    const snapshot =
      cached ??
      buildRegistryBranchSnapshot(
        STATIC_BRANCH_CATALOG,
        registry.modules,
        readModel,
        { ...access, sessionBranchId: resolvedSessionId },
        catalogGeneration,
        entitlementVersion,
        identity,
        roles,
      );

    if (!cached) {
      writeBranchCache(cacheKey, snapshot);
    }

    if (snapshot.activeBranchId !== resolvedSessionId) {
      writeActiveBranchSession(snapshot.activeBranchId);
    }

    lastRegistrySnapshotRef.current = { identityKey, snapshot };

    return toContextValue(snapshot, {
      isRegistrySource: true,
      isLoading: registry.isLoading || tenantSettings.isLoading || branchesQuery.isLoading,
      error: null,
      registryStatus,
      refresh,
      setActiveBranchId,
      isRefreshing,
    });
  }, [
    refresh,
    refreshNonce,
    registry,
    roles,
    rolesHash,
    tenantId,
    tenantSettings.data,
    tenantSettings.dataUpdatedAt,
    tenantSettings.isLoading,
    locale,
    userId,
    primaryBranchId,
    useRegistry,
    branchesQuery.data,
    branchesQuery.isLoading,
    setActiveBranchId,
    isRefreshing,
  ]);

  // Initial / identity-ready publish — synchronized branchSnapshotVersion for consumers (§21.2 ready)
  useEffect(() => {
    if (value.isLoading || value.isRefreshing) return;
    const key = `${value.branchSnapshotVersion}:${value.activeBranchId ?? 'none'}`;
    if (publishedReadyKeyRef.current === key) return;
    publishedReadyKeyRef.current = key;
    publishBranchContext(
      toBranchContextPayload(value.snapshot, 'branch.context.ready'),
    );
  }, [
    value.isLoading,
    value.isRefreshing,
    value.branchSnapshotVersion,
    value.activeBranchId,
    value.snapshot,
  ]);

  // Phase 36c acceptance probe — invokes existing provider APIs only (no new business logic).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (
      window as Window & {
        __BOOKING_BRANCH_ACTIONS__?: {
          setActiveBranchId: (branchId: string | null) => Promise<void>;
          refresh: () => Promise<void>;
        };
      }
    ).__BOOKING_BRANCH_ACTIONS__ = {
      setActiveBranchId: value.setActiveBranchId,
      refresh: value.refresh,
    };
  }, [value.setActiveBranchId, value.refresh]);

  return <DynamicBranchContext.Provider value={value}>{children}</DynamicBranchContext.Provider>;
}

export function useBranch(): DynamicBranchContextValue {
  const ctx = useContext(DynamicBranchContext);
  if (!ctx) {
    throw new Error('useBranch must be used within DynamicBranchProvider');
  }
  return ctx;
}

export function useOptionalBranch(): DynamicBranchContextValue | null {
  return useContext(DynamicBranchContext);
}
