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
  JOURNEY_CACHE_VERSION,
  buildJourneyCacheKey,
  clearJourneyCache,
  readJourneyCache,
  readJourneyCacheForIdentity,
  writeJourneyCache,
} from '../lib/journey-cache';
import {
  buildRegistryJourneySnapshot,
  buildRestrictedJourneySnapshot,
  buildStaticJourneySnapshot,
} from '../lib/journey-snapshot-builder';
import { STATIC_JOURNEY_CATALOG } from '../lib/static-journey-catalog';
import { isRegistryJourneyEnabled } from '../lib/journey-flags';
import { assertJourneyCatalogLoaded } from '../lib/journey-validation';
import type {
  JourneyCapabilityFlags,
  JourneyCatalogSource,
  JourneyCategorySnapshot,
  JourneyDefinitionSnapshot,
  JourneyEscalationSnapshot,
  JourneyGuardSnapshot,
  JourneyPackSnapshot,
  JourneySnapshot,
  JourneyStageSnapshot,
  JourneySurfaceSnapshot,
  JourneyTimerSnapshot,
  JourneyTransitionSnapshot,
  JourneyAutomationSnapshot,
  JourneyApprovalSnapshot,
  EffectiveJourneyView,
} from '../lib/journey-types';

assertJourneyCatalogLoaded();

function resolveRegistrySnapshot(
  roles: string[],
  modules: ReturnType<typeof useModuleRegistry>['modules'],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
  identity: JourneySnapshot['identity'],
): JourneySnapshot {
  return buildRegistryJourneySnapshot(
    roles,
    STATIC_JOURNEY_CATALOG,
    modules,
    catalogGeneration,
    entitlementVersion,
    identity,
    'ready',
  );
}

function toContextValue(
  snapshot: JourneySnapshot,
  options: {
    isRegistrySource: boolean;
    isLoading: boolean;
    error: Error | null;
    registryStatus: DynamicJourneyContextValue['registryStatus'];
    refresh: () => Promise<void>;
    branchSnapshotVersion: string | null;
    activeBranchId: string | null;
  },
): DynamicJourneyContextValue {
  return {
    snapshot,
    view: snapshot.view,
    categories: snapshot.categories,
    stages: snapshot.stages,
    transitions: snapshot.transitions,
    guards: snapshot.guards,
    approvals: snapshot.approvals,
    escalations: snapshot.escalations,
    timers: snapshot.timers,
    automations: snapshot.automations,
    definitions: snapshot.definitions,
    packs: snapshot.packs,
    surfaces: snapshot.surfaces,
    capabilities: snapshot.capabilities,
    canViewJourney: snapshot.canViewJourney,
    canViewPatientTimeline: snapshot.canViewPatientTimeline,
    canViewClinicalStages: snapshot.canViewClinicalStages,
    canViewFinancialStages: snapshot.canViewFinancialStages,
    canViewOperationalStages: snapshot.canViewOperationalStages,
    canViewCrossBranchJourney: snapshot.canViewCrossBranchJourney,
    canConfigureJourney: snapshot.canConfigureJourney,
    canUseJourneyPacks: snapshot.canUseJourneyPacks,
    canViewAutomationMetadata: snapshot.canViewAutomationMetadata,
    canViewSLAStatus: snapshot.canViewSLAStatus,
    canViewApprovalMetadata: snapshot.canViewApprovalMetadata,
    source: snapshot.source,
    journeySnapshotVersion: snapshot.journeySnapshotVersion,
    journeyConfigurationVersion: snapshot.journeyConfigurationVersion,
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

export interface DynamicJourneyContextValue {
  snapshot: JourneySnapshot;
  view: EffectiveJourneyView;
  categories: JourneyCategorySnapshot[];
  stages: JourneyStageSnapshot[];
  transitions: JourneyTransitionSnapshot[];
  guards: JourneyGuardSnapshot[];
  approvals: JourneyApprovalSnapshot[];
  escalations: JourneyEscalationSnapshot[];
  timers: JourneyTimerSnapshot[];
  automations: JourneyAutomationSnapshot[];
  definitions: JourneyDefinitionSnapshot[];
  packs: JourneyPackSnapshot[];
  surfaces: JourneySurfaceSnapshot[];
  capabilities: JourneyCapabilityFlags;
  canViewJourney: boolean;
  canViewPatientTimeline: boolean;
  canViewClinicalStages: boolean;
  canViewFinancialStages: boolean;
  canViewOperationalStages: boolean;
  canViewCrossBranchJourney: boolean;
  canConfigureJourney: boolean;
  canUseJourneyPacks: boolean;
  canViewAutomationMetadata: boolean;
  canViewSLAStatus: boolean;
  canViewApprovalMetadata: boolean;
  source: JourneyCatalogSource;
  journeySnapshotVersion: string;
  journeyConfigurationVersion: string;
  providerKey: string;
  isRegistrySource: boolean;
  isLoading: boolean;
  error: Error | null;
  registryStatus: 'loading' | 'ready' | 'error' | 'restricted';
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  refresh: () => Promise<void>;
  branchSnapshotVersion: string | null;
  activeBranchId: string | null;
}

const DynamicJourneyContext = createContext<DynamicJourneyContextValue | null>(null);

export function DynamicJourneyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const rolesHash = buildRolesHash(roles);
  const tenantId = user?.tenantId ?? '';
  const userId = user?.userId ?? '';
  const registry = useModuleRegistry();
  const branchCtx = useOptionalBranch();
  const useRegistry = isRegistryJourneyEnabled();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const lastRegistrySnapshotRef = useRef<{
    identityKey: string;
    snapshot: JourneySnapshot;
  } | null>(null);
  const lastIdentityKeyRef = useRef<string | null>(null);
  const branchSnapshotVersion = branchCtx?.branchSnapshotVersion ?? null;
  const activeBranchId = branchCtx?.activeBranchId ?? null;

  const refresh = useCallback(async () => {
    clearJourneyCache();
    lastRegistrySnapshotRef.current = null;
    setRefreshNonce((value) => value + 1);
    await registry.refresh();
  }, [registry]);

  useRegisterBranchConsumer('journey', () => {
    clearJourneyCache();
    lastRegistrySnapshotRef.current = null;
    setRefreshNonce((value) => value + 1);
  });

  const value = useMemo<DynamicJourneyContextValue>(() => {
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
    const registryStatus: DynamicJourneyContextValue['registryStatus'] = registry.isError
      ? 'error'
      : registry.isLoading
        ? 'loading'
        : 'ready';

    if (lastIdentityKeyRef.current && lastIdentityKeyRef.current !== identityKey) {
      clearJourneyCache();
      lastRegistrySnapshotRef.current = null;
    }
    lastIdentityKeyRef.current = identityKey;

    const staticSnapshot = buildStaticJourneySnapshot(
      roles,
      STATIC_JOURNEY_CATALOG,
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

    const journeyConfigurationVersion = [
      'journey-config',
      catalogGeneration ?? 'none',
      entitlementVersion ?? 'none',
      activeBranchId ?? 'none',
    ].join('#');

    const resolveKnownRegistrySnapshot = (): JourneySnapshot | null => {
      const last = lastRegistrySnapshotRef.current;
      if (last?.identityKey === identityKey) {
        return last.snapshot;
      }

      const journeyCached = readJourneyCacheForIdentity({
        tenantId,
        userId,
        rolesHash,
        activeBranchId,
        branchSnapshotVersion,
        catalogGeneration,
        entitlementVersion,
        journeyConfigurationVersion,
      });
      if (journeyCached) {
        return journeyCached;
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
        buildRestrictedJourneySnapshot(identity, catalogGeneration, entitlementVersion),
        {
          isRegistrySource: true,
          isLoading: true,
          error: null,
          registryStatus: 'restricted',
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
      branchSnapshotVersion ?? 'none',
      'registry',
    ].join('#');

    const cacheKey = buildJourneyCacheKey({
      tenantId,
      userId,
      rolesHash,
      activeBranchId,
      branchSnapshotVersion,
      catalogGeneration,
      entitlementVersion,
      journeyConfigurationVersion,
      journeySnapshotVersion: provisionalVersion,
      cacheVersion: JOURNEY_CACHE_VERSION,
      moduleCount: registry.modules.length,
      source: 'registry',
    });

    const cached = readJourneyCache(cacheKey);
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
      const versionedKey = buildJourneyCacheKey({
        tenantId,
        userId,
        rolesHash,
        activeBranchId,
        branchSnapshotVersion,
        catalogGeneration,
        entitlementVersion,
        journeyConfigurationVersion: snapshot.journeyConfigurationVersion,
        journeySnapshotVersion: snapshot.journeySnapshotVersion,
        cacheVersion: JOURNEY_CACHE_VERSION,
        moduleCount: registry.modules.length,
        source: 'registry',
      });
      writeJourneyCache(versionedKey, snapshot);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (
      window as Window & {
        __BOOKING_JOURNEY_RUNTIME__?: {
          source: string;
          isRegistrySource: boolean;
          journeySnapshotVersion: string;
          providerKey: string;
          tenantId: string;
          userId: string;
          branchId: string | null;
          branchSnapshotVersion: string | null;
          catalogGeneration: number | null;
          entitlementVersion: string | null;
          registryStatus: string;
          stageCount: number;
          transitionCount: number;
          surfaceCount: number;
          packCount: number;
          canViewJourney: boolean;
          canViewPatientTimeline: boolean;
          canConfigureJourney: boolean;
          canUseJourneyPacks: boolean;
        };
        __BOOKING_JOURNEY_ACTIONS__?: {
          refresh: () => Promise<void>;
        };
      }
    ).__BOOKING_JOURNEY_RUNTIME__ = {
      source: value.source,
      isRegistrySource: value.isRegistrySource,
      journeySnapshotVersion: value.journeySnapshotVersion,
      providerKey: value.providerKey,
      tenantId: value.snapshot.identity.tenantId,
      userId: value.snapshot.identity.userId,
      branchId: value.activeBranchId,
      branchSnapshotVersion: value.branchSnapshotVersion,
      catalogGeneration: value.catalogGeneration,
      entitlementVersion: value.entitlementVersion,
      registryStatus: value.registryStatus,
      stageCount: value.stages.length,
      transitionCount: value.transitions.length,
      surfaceCount: value.surfaces.length,
      packCount: value.packs.length,
      canViewJourney: value.canViewJourney,
      canViewPatientTimeline: value.canViewPatientTimeline,
      canConfigureJourney: value.canConfigureJourney,
      canUseJourneyPacks: value.canUseJourneyPacks,
    };
    (
      window as Window & {
        __BOOKING_JOURNEY_ACTIONS__?: { refresh: () => Promise<void> };
      }
    ).__BOOKING_JOURNEY_ACTIONS__ = {
      refresh: value.refresh,
    };
  }, [value]);

  return <DynamicJourneyContext.Provider value={value}>{children}</DynamicJourneyContext.Provider>;
}

export function useJourney(): DynamicJourneyContextValue {
  const ctx = useContext(DynamicJourneyContext);
  if (!ctx) {
    throw new Error('useJourney must be used within DynamicJourneyProvider');
  }
  return ctx;
}

export function useOptionalJourney(): DynamicJourneyContextValue | null {
  return useContext(DynamicJourneyContext);
}
