import { describe, expect, it, afterEach } from 'vitest';
import {
  BUILTIN_MODULE_MANIFESTS,
  resolveDependencyGraph,
  resolveEffectiveModuleViews,
} from '@booking/module-registry';
import { hasPermission } from '@booking/permissions';
import {
  buildWhiteLabelCacheKey,
  clearWhiteLabelCache,
  readWhiteLabelCache,
  readWhiteLabelCacheForIdentity,
  writeWhiteLabelCache,
} from './lib/white-label-cache';
import {
  extractWhiteLabelContributions,
  isCatalogWhiteLabelEntryIncluded,
  resolveWhiteLabelCapabilities,
} from './lib/white-label-resolver';
import {
  buildRegistryWhiteLabelSnapshot,
  buildRestrictedWhiteLabelSnapshot,
  buildStaticWhiteLabelSnapshot,
} from './lib/white-label-snapshot-builder';
import { enabledFeaturesFromIdentityFeatures } from './lib/white-label-branding-read-model';
import { hashBrandingGeneration } from './lib/white-label-merge';
import { STATIC_WHITE_LABEL_CATALOG } from './lib/static-white-label-catalog';
import {
  assertWhiteLabelCatalogValid,
  assertWhiteLabelSnapshotValid,
} from './lib/white-label-validation';

const ALL_ENABLED = Object.fromEntries(
  BUILTIN_MODULE_MANIFESTS.map((manifest) => [manifest.moduleId, 'enabled' as const]),
);

const IDENTITY = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  rolesHash: 'owner',
  locale: 'en-US',
  themePreference: 'light' as const,
  branchId: null,
};

const READ_MODEL = {
  tenantId: 'tenant-1',
  tenantName: 'Demo Clinic',
  customDomain: null,
  timezone: 'UTC',
  locale: 'en-US',
  branding: {
    primaryColor: '#2563eb',
    accentColor: '#0ea5e9',
    logoStorageKey: 'logo-1',
    faviconStorageKey: 'fav-1',
    themePreference: 'system',
    invoiceBranding: true,
    reportBranding: true,
    emailBranding: true,
    patientPortalBranding: true,
  },
  clinicProfile: { displayName: 'Demo Clinic' },
  localizationSettings: {},
  enabledFeatures: ['customBranding', 'whiteLabel'],
};

function buildViews(roles: string[]) {
  const graph = resolveDependencyGraph(BUILTIN_MODULE_MANIFESTS);
  return resolveEffectiveModuleViews({
    manifests: BUILTIN_MODULE_MANIFESTS,
    licenseModules: ALL_ENABLED,
    moduleFlags: {},
    canWrite: true,
    canMutate: true,
    licenseStatus: 'active',
    permissionEvaluator: {
      hasPermission: (resourceId, action = 'view') => hasPermission(roles, resourceId, action),
    },
    dependencyOrder: graph.order,
    dependencyHealthByModule: graph.healthByModule,
  });
}

describe('white label catalog', () => {
  it('validates catalog integrity', () => {
    expect(assertWhiteLabelCatalogValid(), assertWhiteLabelCatalogValid().join('\n')).toEqual([]);
  });
});

describe('white label resolver', () => {
  it('extracts white label contributions from effective views only', () => {
    const views = buildViews(['owner']);
    const contributions = extractWhiteLabelContributions(views);
    expect(contributions.length).toBe(10);
    expect(contributions.every((entry) => entry.extensionId.includes('/whiteLabel/'))).toBe(true);
  });

  it('gates catalog entries by extension-level accessibility', () => {
    const ownerViews = buildViews(['owner']);
    const receptionistViews = buildViews(['receptionist']);
    const ownerContributions = extractWhiteLabelContributions(ownerViews);
    const receptionistContributions = extractWhiteLabelContributions(receptionistViews);
    const themeAdvanced = STATIC_WHITE_LABEL_CATALOG.find((entry) => entry.localId === 'theme-advanced')!;
    expect(
      isCatalogWhiteLabelEntryIncluded(themeAdvanced, receptionistViews, receptionistContributions),
    ).toBe(false);
    expect(isCatalogWhiteLabelEntryIncluded(themeAdvanced, ownerViews, ownerContributions)).toBe(true);
  });

  it('derives aggregate capabilities from accessible surfaces', () => {
    const snapshot = buildStaticWhiteLabelSnapshot(
      STATIC_WHITE_LABEL_CATALOG,
      READ_MODEL,
      IDENTITY,
      'light',
      'static-only',
    );
    const capabilities = resolveWhiteLabelCapabilities(snapshot.view);
    expect(capabilities.canCustomizeBranding).toBe(true);
    expect(capabilities.canCustomizeTheme).toBe(true);
    expect(capabilities.canUseCustomDomain).toBe(true);
  });
});

describe('white label snapshot builder', () => {
  it('builds registry snapshot with catalog join', () => {
    const views = buildViews(['owner']);
    const snapshot = buildRegistryWhiteLabelSnapshot(
      STATIC_WHITE_LABEL_CATALOG,
      views,
      READ_MODEL,
      1,
      'active',
      IDENTITY,
      'light',
    );
    expect(snapshot.source).toBe('registry');
    expect(snapshot.entries.length).toBeGreaterThan(0);
    expect(assertWhiteLabelSnapshotValid(snapshot), assertWhiteLabelSnapshotValid(snapshot).join('\n')).toEqual([]);
  });

  it('builds static-only snapshot from catalog and tenant read model', () => {
    const snapshot = buildStaticWhiteLabelSnapshot(
      STATIC_WHITE_LABEL_CATALOG,
      READ_MODEL,
      IDENTITY,
      'light',
      'static-only',
    );
    expect(snapshot.source).toBe('static-only');
    expect(snapshot.entries.length).toBe(10);
    expect(snapshot.theme.cssVariables['--color-primary']).toBe('#2563eb');
  });

  it('builds restricted snapshot fail-closed with zero surfaces', () => {
    const snapshot = buildRestrictedWhiteLabelSnapshot(IDENTITY, 'light', 1, 'active');
    expect(snapshot.source).toBe('restricted');
    expect(snapshot.entries).toEqual([]);
    expect(snapshot.capabilities.canCustomizeBranding).toBe(false);
    expect(assertWhiteLabelSnapshotValid(snapshot), assertWhiteLabelSnapshotValid(snapshot).join('\n')).toEqual([]);
  });

  it('registry snapshot is subset of static snapshot for same role', () => {
    const views = buildViews(['owner']);
    const registry = buildRegistryWhiteLabelSnapshot(
      STATIC_WHITE_LABEL_CATALOG,
      views,
      READ_MODEL,
      1,
      'active',
      IDENTITY,
      'light',
    );
    const staticSnapshot = buildStaticWhiteLabelSnapshot(
      STATIC_WHITE_LABEL_CATALOG,
      READ_MODEL,
      IDENTITY,
      'light',
      'static-fallback',
    );
    const registryIds = new Set(registry.entries.map((entry) => entry.surfaceId));
    for (const surfaceId of registryIds) {
      expect(staticSnapshot.entries.some((entry) => entry.surfaceId === surfaceId), surfaceId).toBe(true);
    }
  });
});

describe('white label cache', () => {
  afterEach(() => clearWhiteLabelCache());

  it('stores and reads identity-scoped cache entries', () => {
    const snapshot = buildRestrictedWhiteLabelSnapshot(IDENTITY, 'light', 1, 'active');
    const key = buildWhiteLabelCacheKey({
      tenantId: IDENTITY.tenantId,
      userId: IDENTITY.userId,
      rolesHash: IDENTITY.rolesHash,
      locale: IDENTITY.locale,
      themePreference: IDENTITY.themePreference,
      catalogGeneration: 1,
      entitlementVersion: 'active',
      brandingGeneration: hashBrandingGeneration(READ_MODEL.branding),
      assetGeneration: 1,
      source: 'registry',
      moduleCount: 21,
    });
    writeWhiteLabelCache(key, snapshot);
    expect(readWhiteLabelCache(key)).toBe(snapshot);
  });

  it('matches cache by identity prefix during loading', () => {
    const views = buildViews(['owner']);
    const snapshot = buildRegistryWhiteLabelSnapshot(
      STATIC_WHITE_LABEL_CATALOG,
      views,
      READ_MODEL,
      1,
      'active',
      IDENTITY,
      'light',
    );
    const key = buildWhiteLabelCacheKey({
      tenantId: IDENTITY.tenantId,
      userId: IDENTITY.userId,
      rolesHash: IDENTITY.rolesHash,
      locale: IDENTITY.locale,
      themePreference: IDENTITY.themePreference,
      catalogGeneration: 1,
      entitlementVersion: 'active',
      brandingGeneration: hashBrandingGeneration(READ_MODEL.branding),
      assetGeneration: 1,
      source: 'registry',
      moduleCount: 21,
    });
    writeWhiteLabelCache(key, snapshot);
    expect(
      readWhiteLabelCacheForIdentity({
        tenantId: IDENTITY.tenantId,
        userId: IDENTITY.userId,
        rolesHash: IDENTITY.rolesHash,
        locale: IDENTITY.locale,
        themePreference: IDENTITY.themePreference,
        catalogGeneration: 1,
        entitlementVersion: 'active',
        brandingGeneration: hashBrandingGeneration(READ_MODEL.branding),
        assetGeneration: 1,
      }),
    ).toBe(snapshot);
  });
});

describe('white label branding read model', () => {
  it('maps identity features to enabled feature ids', () => {
    expect(
      enabledFeaturesFromIdentityFeatures({ customBranding: true, whiteLabel: false }),
    ).toEqual(['customBranding']);
  });
});
