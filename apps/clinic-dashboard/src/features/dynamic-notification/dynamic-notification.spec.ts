import { describe, expect, it, afterEach, vi } from 'vitest';
import {
  BUILTIN_MODULE_MANIFESTS,
  resolveDependencyGraph,
  resolveEffectiveModuleViews,
} from '@booking/module-registry';
import { hasPermission } from '@booking/permissions';
import {
  STATIC_NOTIFICATION_CATALOG,
  STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY,
} from './lib/static-notification-catalog';
import {
  buildNotificationCacheKey,
  clearNotificationCache,
  NOTIFICATION_CACHE_VERSION,
  readNotificationCache,
  readNotificationCacheForIdentity,
  writeNotificationCache,
} from './lib/notification-cache';
import { extractNotificationContributions, resolveAccessibleNotificationCatalog } from './lib/notification-resolver';
import {
  buildRegistryNotificationSnapshot,
  buildRestrictedNotificationSnapshot,
  buildStaticNotificationSnapshot,
} from './lib/notification-snapshot-builder';
import { assertNotificationCatalogLoaded, assertNotificationSnapshotValid } from './lib/notification-validation';
import { isRegistryNotificationEnabled } from './lib/notification-flags';
import { resolveNotificationCenterConfig, resolveNotificationChannelsDisplay } from './lib/notification-read-model';
import { resolveNotificationCapabilitiesFromSnapshot } from './lib/notification-capabilities';

const ALL_ENABLED = Object.fromEntries(
  BUILTIN_MODULE_MANIFESTS.map((manifest) => [manifest.moduleId, 'enabled' as const]),
);

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

const IDENTITY = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  rolesHash: 'owner',
  branchId: 'branch-1' as string | null,
  locale: 'en',
};

describe('dynamic notification runtime (Phase 41b)', () => {
  afterEach(() => {
    clearNotificationCache();
    vi.unstubAllEnvs();
  });

  it('keeps static catalog as non-authority', () => {
    expect(STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
    expect(() => assertNotificationCatalogLoaded()).not.toThrow();
  });

  it('extracts notification contributions from EffectiveModuleView only', () => {
    const views = buildViews(['owner']);
    const contributions = extractNotificationContributions(views);
    expect(contributions.length).toBe(STATIC_NOTIFICATION_CATALOG.length);
    expect(contributions.every((c) => c.notificationKind)).toBe(true);
  });

  it('joins catalog and validates template/pack references fail-closed', () => {
    const views = buildViews(['owner']);
    const contributions = extractNotificationContributions(views);
    const resolved = resolveAccessibleNotificationCatalog({
      catalog: STATIC_NOTIFICATION_CATALOG,
      identity: IDENTITY,
      modules: views,
      contributions,
    });
    expect(resolved.channels.length).toBeGreaterThan(0);
    expect(resolved.types.length).toBeGreaterThan(0);
    for (const template of resolved.templates) {
      expect(resolved.typeIds.has(template.typeId!)).toBe(true);
    }
    for (const pack of resolved.packs) {
      for (const typeId of pack.includedTypeIds ?? []) {
        expect(resolved.typeIds.has(typeId)).toBe(true);
      }
    }
  });

  it('builds registry snapshot with capability projection', () => {
    const views = buildViews(['owner']);
    const snapshot = buildRegistryNotificationSnapshot(
      ['owner'],
      STATIC_NOTIFICATION_CATALOG,
      views,
      1,
      'active',
      IDENTITY,
      null,
    );
    expect(
      assertNotificationSnapshotValid(snapshot),
      assertNotificationSnapshotValid(snapshot).join('\n'),
    ).toEqual([]);
    expect(snapshot.source).toBe('registry');
    expect(snapshot.channels.length).toBeGreaterThan(0);
    expect(snapshot.canViewNotificationCenter).toBe(true);
    expect(snapshot.capabilities.canViewNotificationCenter).toBe(snapshot.canViewNotificationCenter);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('builds static-only and static-fallback snapshots without widening', () => {
    const staticOnly = buildStaticNotificationSnapshot(['owner'], STATIC_NOTIFICATION_CATALOG, IDENTITY, null, 'static-only');
    const staticFallback = buildStaticNotificationSnapshot(
      ['owner'],
      STATIC_NOTIFICATION_CATALOG,
      IDENTITY,
      null,
      'static-fallback',
    );
    expect(staticOnly.source).toBe('static-only');
    expect(staticFallback.source).toBe('static-fallback');
    expect(assertNotificationSnapshotValid(staticOnly)).toEqual([]);
    expect(assertNotificationSnapshotValid(staticFallback)).toEqual([]);
    expect(staticOnly.channels.length).toBeLessThanOrEqual(
      STATIC_NOTIFICATION_CATALOG.filter((e) => e.notificationKind === 'channel').length,
    );
  });

  it('builds restricted snapshot with all capabilities false', () => {
    const snapshot = buildRestrictedNotificationSnapshot(IDENTITY, null, 1, 'active');
    expect(snapshot.source).toBe('restricted');
    expect(snapshot.channels).toEqual([]);
    expect(snapshot.types).toEqual([]);
    expect(snapshot.surfaces).toEqual([]);
    expect(snapshot.packs).toEqual([]);
    expect(snapshot.view.deliveryPolicies).toEqual([]);
    expect(Object.values(snapshot.capabilities).every((value) => value === false)).toBe(true);
    expect(assertNotificationSnapshotValid(snapshot)).toEqual([]);
  });

  it('registry owner channels/types never exceed static catalog vocabulary', () => {
    const views = buildViews(['owner']);
    const registry = buildRegistryNotificationSnapshot(
      ['owner'],
      STATIC_NOTIFICATION_CATALOG,
      views,
      1,
      'active',
      IDENTITY,
      null,
    );
    const catalogChannelIds = new Set(
      STATIC_NOTIFICATION_CATALOG.filter((e) => e.notificationKind === 'channel').map((e) => e.channelId),
    );
    for (const channel of registry.channels) {
      expect(catalogChannelIds.has(channel.channelId)).toBe(true);
    }
  });

  it('never claims delivery works for not-implemented channels (webhook always false)', () => {
    const views = buildViews(['owner']);
    const snapshot = buildRegistryNotificationSnapshot(
      ['owner'],
      STATIC_NOTIFICATION_CATALOG,
      views,
      1,
      'active',
      IDENTITY,
      null,
    );
    expect(snapshot.canUseWebhook).toBe(false);
  });

  it('capability resolver derives canUseEmail only when channel and provider are both runtime-implemented', () => {
    const capabilities = resolveNotificationCapabilitiesFromSnapshot({
      source: 'registry',
      surfaces: [],
      channels: [
        {
          kind: 'channel',
          extensionId: 'x',
          moduleId: 'notifications',
          ownerModuleId: 'notifications',
          channelId: 'email',
          labelKey: 'l',
          sortOrder: 1,
          runtimeImplemented: true,
          implementationStatus: 'partial',
          supportsRichContent: true,
          requiresRecipientAddress: true,
          permissionResource: 'api.notifications',
          permissionAction: 'view',
          deepLinkTemplate: '/x',
        },
      ],
      providers: [],
      types: [],
      consentPolicies: [],
      redactionPolicies: [],
    });
    expect(capabilities.canUseEmail).toBe(false);
  });

  it('identity cache includes branch + white label + locale key participation and clears without PHI', () => {
    const views = buildViews(['owner']);
    const snapshot = buildRegistryNotificationSnapshot(
      ['owner'],
      STATIC_NOTIFICATION_CATALOG,
      views,
      1,
      'active',
      IDENTITY,
      'wl-v1',
    );
    const key = buildNotificationCacheKey({
      tenantId: IDENTITY.tenantId,
      userId: IDENTITY.userId,
      rolesHash: IDENTITY.rolesHash,
      activeBranchId: IDENTITY.branchId,
      branchSnapshotVersion: 'bv1',
      whiteLabelSnapshotVersion: 'wl-v1',
      locale: IDENTITY.locale,
      catalogGeneration: 1,
      entitlementVersion: 'active',
      notificationConfigurationVersion: snapshot.notificationConfigurationVersion,
      notificationSnapshotVersion: snapshot.notificationSnapshotVersion,
      cacheVersion: NOTIFICATION_CACHE_VERSION,
      moduleCount: views.length,
      source: 'registry',
    });
    writeNotificationCache(key, snapshot);
    expect(readNotificationCache(key)?.notificationSnapshotVersion).toBe(snapshot.notificationSnapshotVersion);
    expect(
      readNotificationCacheForIdentity({
        tenantId: IDENTITY.tenantId,
        userId: IDENTITY.userId,
        rolesHash: IDENTITY.rolesHash,
        activeBranchId: IDENTITY.branchId,
        branchSnapshotVersion: 'bv1',
        whiteLabelSnapshotVersion: 'wl-v1',
        locale: IDENTITY.locale,
        catalogGeneration: 1,
        entitlementVersion: 'active',
        notificationConfigurationVersion: snapshot.notificationConfigurationVersion,
      })?.source,
    ).toBe('registry');
    expect(
      readNotificationCacheForIdentity({
        tenantId: IDENTITY.tenantId,
        userId: IDENTITY.userId,
        rolesHash: IDENTITY.rolesHash,
        activeBranchId: IDENTITY.branchId,
        branchSnapshotVersion: 'bv2',
        whiteLabelSnapshotVersion: 'wl-v1',
        locale: IDENTITY.locale,
        catalogGeneration: 1,
        entitlementVersion: 'active',
        notificationConfigurationVersion: snapshot.notificationConfigurationVersion,
      }),
    ).toBeNull();
    clearNotificationCache();
    expect(readNotificationCache(key)).toBeNull();
    // phiClassification is legitimate vocabulary metadata (e.g. 'phi'/'limited'/'none') — assert
    // no actual identifier-shaped leakage instead of banning the classification tag itself.
    expect(JSON.stringify(snapshot)).not.toMatch(/patientId|ssn|mrn|dateOfBirth/i);
  });

  it('notification center config prefers provider snapshot', () => {
    const views = buildViews(['owner']);
    const snapshot = buildRegistryNotificationSnapshot(
      ['owner'],
      STATIC_NOTIFICATION_CATALOG,
      views,
      1,
      'active',
      IDENTITY,
      null,
    );
    const config = resolveNotificationCenterConfig(snapshot);
    expect(config.showCenter).toBe(true);
    expect(config.surfaceId).toBe('notification-center');
    expect(config.accessibleChannelIds.length).toBeGreaterThan(0);
  });

  it('notification center config fails closed when snapshot is null', () => {
    const config = resolveNotificationCenterConfig(null);
    expect(config.showCenter).toBe(false);
    expect(config.accessibleChannelIds).toEqual([]);
  });

  it('channel display never widens disabled channels to enabled', () => {
    const views = buildViews(['owner']);
    const snapshot = buildRegistryNotificationSnapshot(
      ['owner'],
      STATIC_NOTIFICATION_CATALOG,
      views,
      1,
      'active',
      IDENTITY,
      null,
    );
    const rows = resolveNotificationChannelsDisplay(snapshot);
    for (const disabled of snapshot.view.disabledChannels) {
      const row = rows.find((r) => r.channelId === disabled.channelId);
      expect(row?.enabled).toBe(false);
    }
  });

  it('enables registry notification by default', () => {
    expect(isRegistryNotificationEnabled()).toBe(true);
  });

  it('branch fail-closed: missing branch never widens cross-branch capability', () => {
    const views = buildViews(['owner']);
    const identityNoBranch = { ...IDENTITY, branchId: null };
    const snapshot = buildRegistryNotificationSnapshot(
      ['owner'],
      STATIC_NOTIFICATION_CATALOG,
      views,
      1,
      'active',
      identityNoBranch,
      null,
    );
    expect(snapshot.canSendCrossBranchMessages).toBe(false);
    expect(assertNotificationSnapshotValid(snapshot)).toEqual([]);
  });

  it('restricted role never receives channel/type vocabulary', () => {
    const views = buildViews([]);
    const snapshot = buildRegistryNotificationSnapshot(['viewer-none'], STATIC_NOTIFICATION_CATALOG, views, 1, 'active', IDENTITY, null);
    expect(snapshot.channels).toEqual([]);
    expect(snapshot.types).toEqual([]);
  });
});
