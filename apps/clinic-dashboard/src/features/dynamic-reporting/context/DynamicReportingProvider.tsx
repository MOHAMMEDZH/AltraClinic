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
  buildReportingCacheKey,
  clearReportingCache,
  readReportingCache,
  readReportingCacheForIdentity,
  writeReportingCache,
} from '../lib/reporting-cache';
import {
  buildRegistryReportingSnapshot,
  buildRestrictedReportSnapshot,
  buildStaticReportingSnapshot,
} from '../lib/reporting-snapshot-builder';
import { STATIC_REPORT_CATALOG } from '../lib/static-report-catalog';
import { isRegistryReportingEnabled } from '../lib/static-report-flags';
import { assertReportingCatalogLoaded } from '../lib/reporting-validation';
import type {
  ReportCatalogSource,
  ReportCategorySnapshot,
  ReportHubSnapshot,
  ReportSnapshot,
  ReportTemplateSnapshot,
} from '../lib/reporting-types';

assertReportingCatalogLoaded();

function resolveRegistrySnapshot(
  roles: string[],
  modules: ReturnType<typeof useModuleRegistry>['modules'],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
  identity: ReportSnapshot['identity'],
): ReportSnapshot {
  return buildRegistryReportingSnapshot(
    roles,
    STATIC_REPORT_CATALOG,
    modules,
    catalogGeneration,
    entitlementVersion,
    identity,
  );
}

function toContextValue(
  snapshot: ReportSnapshot,
  options: {
    isRegistrySource: boolean;
    isLoading: boolean;
    error: Error | null;
    registryStatus: DynamicReportingContextValue['registryStatus'];
    refresh: () => Promise<void>;
    branchSnapshotVersion: string | null;
    activeBranchId: string | null;
  },
): DynamicReportingContextValue {
  return {
    snapshot,
    categories: snapshot.categories,
    templates: snapshot.templates,
    featuredTemplates: snapshot.featuredTemplates,
    templatesByCategory: snapshot.templatesByCategory,
    hubEntries: snapshot.hubEntries,
    canViewReporting: snapshot.canViewReporting,
    canCreateReports: snapshot.canCreateReports,
    canExportReports: snapshot.canExportReports,
    source: snapshot.source,
    isRegistrySource: options.isRegistrySource,
    isLoading: options.isLoading,
    error: options.error,
    registryStatus: options.registryStatus,
    refresh: options.refresh,
    branchSnapshotVersion: options.branchSnapshotVersion,
    activeBranchId: options.activeBranchId,
  };
}

export interface DynamicReportingContextValue {
  snapshot: ReportSnapshot;
  categories: ReportCategorySnapshot[];
  templates: ReportTemplateSnapshot[];
  featuredTemplates: ReportTemplateSnapshot[];
  templatesByCategory: Partial<Record<string, ReportTemplateSnapshot[]>>;
  hubEntries: ReportHubSnapshot[];
  canViewReporting: boolean;
  canCreateReports: boolean;
  canExportReports: boolean;
  source: ReportCatalogSource;
  isRegistrySource: boolean;
  isLoading: boolean;
  error: Error | null;
  registryStatus: 'loading' | 'ready' | 'error';
  refresh: () => Promise<void>;
  branchSnapshotVersion: string | null;
  activeBranchId: string | null;
}

const DynamicReportingContext = createContext<DynamicReportingContextValue | null>(null);

export function DynamicReportingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const rolesHash = buildRolesHash(roles);
  const tenantId = user?.tenantId ?? '';
  const userId = user?.userId ?? '';
  const registry = useModuleRegistry();
  const branchCtx = useOptionalBranch();
  const useRegistry = isRegistryReportingEnabled();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const lastRegistrySnapshotRef = useRef<{
    identityKey: string;
    snapshot: ReportSnapshot;
  } | null>(null);
  const lastIdentityKeyRef = useRef<string | null>(null);
  const branchSnapshotVersion = branchCtx?.branchSnapshotVersion ?? null;
  const activeBranchId = branchCtx?.activeBranchId ?? null;

  const refresh = useCallback(async () => {
    clearReportingCache();
    lastRegistrySnapshotRef.current = null;
    setRefreshNonce((value) => value + 1);
    await registry.refresh();
  }, [registry]);

  useRegisterBranchConsumer('reporting', () => {
    clearReportingCache();
    lastRegistrySnapshotRef.current = null;
    setRefreshNonce((value) => value + 1);
  });

  const value = useMemo<DynamicReportingContextValue>(() => {
    void refreshNonce;

    const identity = { tenantId, userId, rolesHash };
    const identityKey = `${tenantId}:${userId}:${rolesHash}:${branchSnapshotVersion ?? 'none'}`;
    const catalogGeneration = registry.snapshot?.catalogGeneration ?? null;
    const entitlementVersion = registry.snapshot?.entitlementVersion ?? null;
    const registryStatus: DynamicReportingContextValue['registryStatus'] = registry.isError
      ? 'error'
      : registry.isLoading
        ? 'loading'
        : 'ready';

    if (lastIdentityKeyRef.current && lastIdentityKeyRef.current !== identityKey) {
      clearReportingCache();
      lastRegistrySnapshotRef.current = null;
    }
    lastIdentityKeyRef.current = identityKey;

    const staticSnapshot = buildStaticReportingSnapshot(
      roles,
      STATIC_REPORT_CATALOG,
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

    const resolveKnownRegistrySnapshot = (): ReportSnapshot | null => {
      const last = lastRegistrySnapshotRef.current;
      if (last?.identityKey === identityKey) {
        return last.snapshot;
      }

      const reportingCached = readReportingCacheForIdentity({
        tenantId,
        userId,
        rolesHash,
        catalogGeneration,
        entitlementVersion,
      });
      if (reportingCached) {
        return reportingCached;
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
        buildRestrictedReportSnapshot(identity, catalogGeneration, entitlementVersion),
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

    const cacheKey = buildReportingCacheKey({
      tenantId,
      userId,
      rolesHash,
      catalogGeneration,
      entitlementVersion,
      moduleCount: registry.modules.length,
      source: 'registry',
      branchSnapshotVersion,
    });

    const cached = readReportingCache(cacheKey);
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
      writeReportingCache(cacheKey, snapshot);
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
    <DynamicReportingContext.Provider value={value}>{children}</DynamicReportingContext.Provider>
  );
}

export function useDynamicReporting(): DynamicReportingContextValue {
  const ctx = useContext(DynamicReportingContext);
  if (!ctx) {
    throw new Error('useDynamicReporting must be used within DynamicReportingProvider');
  }
  return ctx;
}

export function useOptionalDynamicReporting(): DynamicReportingContextValue | null {
  return useContext(DynamicReportingContext);
}
