import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useTheme } from '@/app/providers/ThemeProvider';
import { readRegistryCache } from '@/features/module-registry/lib/registry-cache';
import { useOptionalModuleRegistry } from '@/features/module-registry/context/ModuleRegistryProvider';
import { buildRolesHash } from '@/features/module-registry/lib/registry-cache-identity';
import { useIdentityFeatures, useTenantSettings } from '@/features/settings/hooks/useSettings';
import { useOptionalBranch } from '@/features/dynamic-branch/context/DynamicBranchProvider';
import { useRegisterBranchConsumer } from '@/features/dynamic-branch/hooks/useRegisterBranchConsumer';
import { WhiteLabelThemeSync } from '../components/WhiteLabelThemeSync';
import {
  buildWhiteLabelCacheKey,
  clearWhiteLabelCache,
  readWhiteLabelCache,
  readWhiteLabelCacheForIdentity,
  writeWhiteLabelCache,
} from '../lib/white-label-cache';
import { buildTenantBrandingReadModel } from '../lib/white-label-branding-read-model';
import {
  buildRegistryWhiteLabelSnapshot,
  buildRestrictedWhiteLabelSnapshot,
  buildStaticWhiteLabelSnapshot,
} from '../lib/white-label-snapshot-builder';
import { STATIC_WHITE_LABEL_CATALOG } from '../lib/static-white-label-catalog';
import { isRegistryWhiteLabelEnabled } from '../lib/static-white-label-flags';
import { assertWhiteLabelCatalogLoaded } from '../lib/white-label-validation';
import { hashBrandingGeneration } from '../lib/white-label-merge';
import type {
  BrandAssetsSnapshot,
  EffectiveWhiteLabelSnapshot,
  LayoutSnapshot,
  LocalizationSnapshot,
  ThemeSnapshot,
  WhiteLabelCapabilities,
  WhiteLabelResolutionSource,
  WhiteLabelSnapshot,
  WhiteLabelSurfaceSnapshot,
} from '../lib/white-label-types';

assertWhiteLabelCatalogLoaded();

function toContextValue(
  snapshot: WhiteLabelSnapshot,
  options: {
    isRegistrySource: boolean;
    isLoading: boolean;
    error: Error | null;
    registryStatus: DynamicWhiteLabelContextValue['registryStatus'];
    refresh: () => Promise<void>;
    branchSnapshotVersion: string | null;
  },
): DynamicWhiteLabelContextValue {
  return {
    view: snapshot.view,
    snapshot,
    effective: {
      kind: 'effective',
      view: snapshot.view,
      assets: snapshot.assets,
      theme: snapshot.theme,
      layout: snapshot.layout,
      localization: snapshot.localization,
      capabilities: snapshot.capabilities,
      settingsVersion: snapshot.settingsVersion,
      assetGeneration: snapshot.assetGeneration,
      brandingGeneration: snapshot.brandingGeneration,
    },
    theme: snapshot.theme,
    assets: snapshot.assets,
    layout: snapshot.layout,
    localization: snapshot.localization,
    capabilities: snapshot.capabilities,
    entries: snapshot.entries,
    canCustomizeBranding: snapshot.capabilities.canCustomizeBranding,
    canCustomizeTheme: snapshot.capabilities.canCustomizeTheme,
    canCustomizeLayout: snapshot.capabilities.canCustomizeLayout,
    canCustomizeLocalization: snapshot.capabilities.canCustomizeLocalization,
    canUseCustomDomain: snapshot.capabilities.canUseCustomDomain,
    source: snapshot.source,
    isRegistrySource: options.isRegistrySource,
    isLoading: options.isLoading,
    error: options.error,
    registryStatus: options.registryStatus,
    settingsVersion: snapshot.settingsVersion,
    brandingGeneration: snapshot.brandingGeneration,
    catalogGeneration: snapshot.view.catalogGeneration,
    branchSnapshotVersion: options.branchSnapshotVersion,
    refresh: options.refresh,
  };
}

export interface DynamicWhiteLabelContextValue {
  view: WhiteLabelSnapshot['view'];
  snapshot: WhiteLabelSnapshot;
  effective: EffectiveWhiteLabelSnapshot;
  theme: ThemeSnapshot;
  assets: BrandAssetsSnapshot;
  layout: LayoutSnapshot;
  localization: LocalizationSnapshot;
  capabilities: WhiteLabelCapabilities;
  entries: WhiteLabelSurfaceSnapshot[];
  canCustomizeBranding: boolean;
  canCustomizeTheme: boolean;
  canCustomizeLayout: boolean;
  canCustomizeLocalization: boolean;
  canUseCustomDomain: boolean;
  source: WhiteLabelResolutionSource;
  isRegistrySource: boolean;
  isLoading: boolean;
  error: Error | null;
  registryStatus: 'idle' | 'loading' | 'ready' | 'error' | 'disabled';
  settingsVersion: string;
  brandingGeneration: string;
  catalogGeneration: number | null;
  /** Observed branch snapshot version from DynamicBranchProvider (config sync). */
  branchSnapshotVersion: string | null;
  refresh: () => Promise<void>;
}

const DynamicWhiteLabelContext = createContext<DynamicWhiteLabelContextValue | null>(null);

export function DynamicWhiteLabelProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { locale } = useI18n();
  const { mode: userThemeMode } = useTheme();
  const queryClient = useQueryClient();
  const registry = useOptionalModuleRegistry();
  const branchCtx = useOptionalBranch();
  const useRegistry = isRegistryWhiteLabelEnabled() && registry != null;
  const [refreshNonce, setRefreshNonce] = useState(0);

  const roles = user?.roles ?? [];
  const rolesHash = buildRolesHash(roles);
  const tenantId = user?.tenantId ?? '';
  const userId = user?.userId ?? '';
  const isAuthenticated = Boolean(tenantId && userId);

  const tenantSettings = useTenantSettings(isAuthenticated);
  const identityFeatures = useIdentityFeatures(isAuthenticated);

  const lastRegistrySnapshotRef = useRef<{
    identityKey: string;
    snapshot: WhiteLabelSnapshot;
  } | null>(null);
  const lastIdentityKeyRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    clearWhiteLabelCache();
    lastRegistrySnapshotRef.current = null;
    setRefreshNonce((value) => value + 1);
    await queryClient.invalidateQueries({ queryKey: ['settings'] });
    await registry?.refresh();
  }, [queryClient, registry]);

  useRegisterBranchConsumer('whiteLabel', () => {
    clearWhiteLabelCache();
    lastRegistrySnapshotRef.current = null;
    setRefreshNonce((value) => value + 1);
  });

  const branchSnapshotVersion = branchCtx?.branchSnapshotVersion ?? null;

  const value = useMemo<DynamicWhiteLabelContextValue>(() => {
    void refreshNonce;

    const readModel = buildTenantBrandingReadModel(
      tenantId || 'guest',
      tenantSettings.data,
      identityFeatures.data,
      locale,
    );
    const brandingGeneration = hashBrandingGeneration(readModel.branding);
    const assetGeneration = Object.keys(readModel.branding).length;

    const identity = {
      tenantId: tenantId || 'guest',
      userId: userId || 'guest',
      rolesHash: rolesHash || 'guest',
      locale,
      themePreference: userThemeMode,
      branchId: branchCtx?.activeBranchId ?? null,
    };

    const identityKey = [
      tenantId,
      userId,
      rolesHash,
      locale,
      userThemeMode,
      brandingGeneration,
      branchCtx?.activeBranchId ?? 'none',
      branchSnapshotVersion ?? 'none',
    ].join(':');

    const catalogGeneration = registry?.snapshot?.catalogGeneration ?? null;
    const entitlementVersion = registry?.snapshot?.entitlementVersion ?? null;

    const registryStatus: DynamicWhiteLabelContextValue['registryStatus'] =
      !useRegistry
        ? 'disabled'
        : registry?.isError
          ? 'error'
          : registry?.isLoading
            ? 'loading'
            : registry
              ? 'ready'
              : 'idle';

    if (lastIdentityKeyRef.current && lastIdentityKeyRef.current !== identityKey) {
      clearWhiteLabelCache();
      lastRegistrySnapshotRef.current = null;
    }
    lastIdentityKeyRef.current = identityKey;

    const staticSnapshot = buildStaticWhiteLabelSnapshot(
      STATIC_WHITE_LABEL_CATALOG,
      readModel,
      identity,
      userThemeMode,
      useRegistry ? 'static-fallback' : 'static-only',
    );

    if (!useRegistry || registry?.isError) {
      return toContextValue(staticSnapshot, {
        isRegistrySource: false,
        isLoading: Boolean(tenantSettings.isLoading || identityFeatures.isLoading),
        error: registry?.error ?? null,
        registryStatus,
        refresh,
        branchSnapshotVersion,
      });
    }

    const resolveKnownRegistrySnapshot = (): WhiteLabelSnapshot | null => {
      const last = lastRegistrySnapshotRef.current;
      if (last?.identityKey === identityKey) {
        return last.snapshot;
      }

      const cached = readWhiteLabelCacheForIdentity({
        tenantId: identity.tenantId,
        userId: identity.userId,
        rolesHash: identity.rolesHash,
        locale: identity.locale,
        themePreference: identity.themePreference,
        catalogGeneration,
        entitlementVersion,
        brandingGeneration,
        assetGeneration,
      });
      if (cached) return cached;

      const registryCached = readRegistryCache({
        tenantId: identity.tenantId,
        userId: identity.userId,
        rolesHash: identity.rolesHash,
      });
      if (registryCached?.data.modules.length) {
        return buildRegistryWhiteLabelSnapshot(
          STATIC_WHITE_LABEL_CATALOG,
          registryCached.data.modules,
          readModel,
          registryCached.data.snapshot.catalogGeneration,
          registryCached.data.snapshot.entitlementVersion,
          identity,
          userThemeMode,
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
        });
      }

      return toContextValue(
        buildRestrictedWhiteLabelSnapshot(
          identity,
          userThemeMode,
          catalogGeneration,
          entitlementVersion,
        ),
        {
          isRegistrySource: true,
          isLoading: true,
          error: null,
          registryStatus,
          refresh,
          branchSnapshotVersion,
        },
      );
    }

    const cacheKey = buildWhiteLabelCacheKey({
      tenantId: identity.tenantId,
      userId: identity.userId,
      rolesHash: identity.rolesHash,
      locale: identity.locale,
      themePreference: identity.themePreference,
      catalogGeneration,
      entitlementVersion,
      brandingGeneration,
      assetGeneration,
      source: 'registry',
      moduleCount: registry.modules.length,
      branchSnapshotVersion,
    });

    const cached = readWhiteLabelCache(cacheKey);
    const snapshot =
      cached ??
      buildRegistryWhiteLabelSnapshot(
        STATIC_WHITE_LABEL_CATALOG,
        registry.modules,
        readModel,
        catalogGeneration,
        entitlementVersion,
        identity,
        userThemeMode,
      );

    if (!cached) {
      writeWhiteLabelCache(cacheKey, snapshot);
    }

    lastRegistrySnapshotRef.current = { identityKey, snapshot };

    return toContextValue(snapshot, {
      isRegistrySource: true,
      isLoading: registry.isLoading || tenantSettings.isLoading,
      error: null,
      registryStatus,
      refresh,
      branchSnapshotVersion,
    });
  }, [
    refresh,
    refreshNonce,
    registry,
    rolesHash,
    tenantId,
    tenantSettings.data,
    tenantSettings.isLoading,
    identityFeatures.data,
    identityFeatures.isLoading,
    locale,
    userId,
    userThemeMode,
    useRegistry,
    branchCtx?.activeBranchId,
    branchSnapshotVersion,
  ]);

  return (
    <DynamicWhiteLabelContext.Provider value={value}>
      <WhiteLabelThemeSync effective={value.effective} />
      {children}
    </DynamicWhiteLabelContext.Provider>
  );
}

export function useWhiteLabel(): DynamicWhiteLabelContextValue {
  const ctx = useContext(DynamicWhiteLabelContext);
  if (!ctx) {
    throw new Error('useWhiteLabel must be used within DynamicWhiteLabelProvider');
  }
  return ctx;
}

export function useOptionalWhiteLabel(): DynamicWhiteLabelContextValue | null {
  return useContext(DynamicWhiteLabelContext);
}
