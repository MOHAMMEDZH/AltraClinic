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
  AUDIT_CACHE_VERSION,
  buildAuditCacheKey,
  clearAuditCache,
  readAuditCache,
  readAuditCacheForIdentity,
  writeAuditCache,
} from '../lib/audit-cache';
import {
  buildRegistryAuditSnapshot,
  buildRestrictedAuditSnapshot,
  buildStaticAuditSnapshot,
} from '../lib/audit-snapshot-builder';
import { STATIC_AUDIT_CATALOG } from '../lib/static-audit-catalog';
import { isRegistryAuditEnabled } from '../lib/audit-flags';
import { assertAuditCatalogLoaded } from '../lib/audit-validation';
import type {
  AuditCapabilityFlags,
  AuditCatalogSource,
  AuditCategorySnapshot,
  AuditEventTypeSnapshot,
  AuditFeedSnapshot,
  AuditPolicySnapshot,
  AuditRiskSnapshot,
  AuditSeveritySnapshot,
  AuditSnapshot,
  AuditSurfaceSnapshot,
  EffectiveAuditView,
} from '../lib/audit-types';

assertAuditCatalogLoaded();

function resolveRegistrySnapshot(
  roles: string[],
  modules: ReturnType<typeof useModuleRegistry>['modules'],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
  identity: AuditSnapshot['identity'],
): AuditSnapshot {
  return buildRegistryAuditSnapshot(
    roles,
    STATIC_AUDIT_CATALOG,
    modules,
    catalogGeneration,
    entitlementVersion,
    identity,
    'ready',
  );
}

function toContextValue(
  snapshot: AuditSnapshot,
  options: {
    isRegistrySource: boolean;
    isLoading: boolean;
    error: Error | null;
    registryStatus: DynamicAuditContextValue['registryStatus'];
    refresh: () => Promise<void>;
    branchSnapshotVersion: string | null;
    activeBranchId: string | null;
  },
): DynamicAuditContextValue {
  return {
    snapshot,
    view: snapshot.view,
    categories: snapshot.categories,
    severities: snapshot.severities,
    risks: snapshot.risks,
    policies: snapshot.policies,
    eventTypes: snapshot.eventTypes,
    feeds: snapshot.feeds,
    surfaces: snapshot.surfaces,
    capabilities: snapshot.capabilities,
    canViewAuditCenter: snapshot.canViewAuditCenter,
    canViewSecurityAudit: snapshot.canViewSecurityAudit,
    canViewClinicalAudit: snapshot.canViewClinicalAudit,
    canViewFinancialAudit: snapshot.canViewFinancialAudit,
    canViewCrossBranchAudit: snapshot.canViewCrossBranchAudit,
    canSearchAudit: snapshot.canSearchAudit,
    canExportAudit: snapshot.canExportAudit,
    canVerifyAuditIntegrity: snapshot.canVerifyAuditIntegrity,
    canManageRetentionPolicies: snapshot.canManageRetentionPolicies,
    canPlaceLegalHold: snapshot.canPlaceLegalHold,
    canViewSensitiveAuditDetails: snapshot.canViewSensitiveAuditDetails,
    source: snapshot.source,
    auditSnapshotVersion: snapshot.auditSnapshotVersion,
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

export interface DynamicAuditContextValue {
  snapshot: AuditSnapshot;
  view: EffectiveAuditView;
  categories: AuditCategorySnapshot[];
  severities: AuditSeveritySnapshot[];
  risks: AuditRiskSnapshot[];
  policies: AuditPolicySnapshot[];
  eventTypes: AuditEventTypeSnapshot[];
  feeds: AuditFeedSnapshot[];
  surfaces: AuditSurfaceSnapshot[];
  capabilities: AuditCapabilityFlags;
  canViewAuditCenter: boolean;
  canViewSecurityAudit: boolean;
  canViewClinicalAudit: boolean;
  canViewFinancialAudit: boolean;
  canViewCrossBranchAudit: boolean;
  canSearchAudit: boolean;
  canExportAudit: boolean;
  canVerifyAuditIntegrity: boolean;
  canManageRetentionPolicies: boolean;
  canPlaceLegalHold: boolean;
  canViewSensitiveAuditDetails: boolean;
  source: AuditCatalogSource;
  auditSnapshotVersion: string;
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

const DynamicAuditContext = createContext<DynamicAuditContextValue | null>(null);

export function DynamicAuditProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const rolesHash = buildRolesHash(roles);
  const tenantId = user?.tenantId ?? '';
  const userId = user?.userId ?? '';
  const registry = useModuleRegistry();
  const branchCtx = useOptionalBranch();
  const useRegistry = isRegistryAuditEnabled();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const lastRegistrySnapshotRef = useRef<{
    identityKey: string;
    snapshot: AuditSnapshot;
  } | null>(null);
  const lastIdentityKeyRef = useRef<string | null>(null);
  const branchSnapshotVersion = branchCtx?.branchSnapshotVersion ?? null;
  const activeBranchId = branchCtx?.activeBranchId ?? null;

  const refresh = useCallback(async () => {
    clearAuditCache();
    lastRegistrySnapshotRef.current = null;
    setRefreshNonce((value) => value + 1);
    await registry.refresh();
  }, [registry]);

  useRegisterBranchConsumer('audit', () => {
    clearAuditCache();
    lastRegistrySnapshotRef.current = null;
    setRefreshNonce((value) => value + 1);
  });

  const value = useMemo<DynamicAuditContextValue>(() => {
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
    const registryStatus: DynamicAuditContextValue['registryStatus'] = registry.isError
      ? 'error'
      : registry.isLoading
        ? 'loading'
        : 'ready';

    if (lastIdentityKeyRef.current && lastIdentityKeyRef.current !== identityKey) {
      clearAuditCache();
      lastRegistrySnapshotRef.current = null;
    }
    lastIdentityKeyRef.current = identityKey;

    const staticSnapshot = buildStaticAuditSnapshot(
      roles,
      STATIC_AUDIT_CATALOG,
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

    const resolveKnownRegistrySnapshot = (): AuditSnapshot | null => {
      const last = lastRegistrySnapshotRef.current;
      if (last?.identityKey === identityKey) {
        return last.snapshot;
      }

      const auditCached = readAuditCacheForIdentity({
        tenantId,
        userId,
        rolesHash,
        branchId: activeBranchId,
        branchSnapshotVersion,
        catalogGeneration,
        entitlementVersion,
      });
      if (auditCached) {
        return auditCached;
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
        buildRestrictedAuditSnapshot(identity, catalogGeneration, entitlementVersion),
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

    const cacheKey = buildAuditCacheKey({
      tenantId,
      userId,
      rolesHash,
      branchId: activeBranchId,
      branchSnapshotVersion,
      catalogGeneration,
      entitlementVersion,
      auditSnapshotVersion: provisionalVersion,
      cacheVersion: AUDIT_CACHE_VERSION,
      moduleCount: registry.modules.length,
      source: 'registry',
    });

    const cached = readAuditCache(cacheKey);
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
      const versionedKey = buildAuditCacheKey({
        tenantId,
        userId,
        rolesHash,
        branchId: activeBranchId,
        branchSnapshotVersion,
        catalogGeneration,
        entitlementVersion,
        auditSnapshotVersion: snapshot.auditSnapshotVersion,
        cacheVersion: AUDIT_CACHE_VERSION,
        moduleCount: registry.modules.length,
        source: 'registry',
      });
      writeAuditCache(versionedKey, snapshot);
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

  // Phase 39c acceptance probe — publishes snapshot metadata only (no business logic).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (
      window as Window & {
        __BOOKING_AUDIT_RUNTIME__?: {
          source: string;
          isRegistrySource: boolean;
          auditSnapshotVersion: string;
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
          surfaceCount: number;
          policyCount: number;
          canViewAuditCenter: boolean;
          canViewSecurityAudit: boolean;
          canViewClinicalAudit: boolean;
          canViewFinancialAudit: boolean;
          canViewCrossBranchAudit: boolean;
          canSearchAudit: boolean;
          canExportAudit: boolean;
          canVerifyAuditIntegrity: boolean;
          canManageRetentionPolicies: boolean;
          canPlaceLegalHold: boolean;
          canViewSensitiveAuditDetails: boolean;
          feedIds: string[];
        };
        __BOOKING_AUDIT_ACTIONS__?: {
          refresh: () => Promise<void>;
        };
      }
    ).__BOOKING_AUDIT_RUNTIME__ = {
      source: value.source,
      isRegistrySource: value.isRegistrySource,
      auditSnapshotVersion: value.auditSnapshotVersion,
      providerKey: value.providerKey,
      tenantId: value.snapshot.identity.tenantId,
      userId: value.snapshot.identity.userId,
      branchId: value.activeBranchId,
      branchSnapshotVersion: value.branchSnapshotVersion,
      catalogGeneration: value.catalogGeneration,
      entitlementVersion: value.entitlementVersion,
      registryStatus: value.registryStatus,
      feedCount: value.feeds.length,
      typeCount: value.eventTypes.length,
      surfaceCount: value.surfaces.length,
      policyCount: value.policies.length,
      canViewAuditCenter: value.canViewAuditCenter,
      canViewSecurityAudit: value.canViewSecurityAudit,
      canViewClinicalAudit: value.canViewClinicalAudit,
      canViewFinancialAudit: value.canViewFinancialAudit,
      canViewCrossBranchAudit: value.canViewCrossBranchAudit,
      canSearchAudit: value.canSearchAudit,
      canExportAudit: value.canExportAudit,
      canVerifyAuditIntegrity: value.canVerifyAuditIntegrity,
      canManageRetentionPolicies: value.canManageRetentionPolicies,
      canPlaceLegalHold: value.canPlaceLegalHold,
      canViewSensitiveAuditDetails: value.canViewSensitiveAuditDetails,
      feedIds: value.feeds.map((feed) => feed.feedId),
    };
    (
      window as Window & {
        __BOOKING_AUDIT_ACTIONS__?: { refresh: () => Promise<void> };
      }
    ).__BOOKING_AUDIT_ACTIONS__ = {
      refresh: value.refresh,
    };
  }, [value]);

  return <DynamicAuditContext.Provider value={value}>{children}</DynamicAuditContext.Provider>;
}

export function useAudit(): DynamicAuditContextValue {
  const ctx = useContext(DynamicAuditContext);
  if (!ctx) {
    throw new Error('useAudit must be used within DynamicAuditProvider');
  }
  return ctx;
}

export function useOptionalAudit(): DynamicAuditContextValue | null {
  return useContext(DynamicAuditContext);
}
