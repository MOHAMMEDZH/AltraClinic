/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import {
  BUILTIN_MODULE_MANIFESTS,
  resolveDependencyGraph,
  resolveEffectiveModuleViews,
} from '@booking/module-registry';
import { hasPermission } from '@booking/permissions';
import { DynamicNotificationProvider, useNotification } from './context/DynamicNotificationProvider';
import { clearNotificationCache } from './lib/notification-cache';
import { buildStaticNotificationSnapshot } from './lib/notification-snapshot-builder';
import { STATIC_NOTIFICATION_CATALOG } from './lib/static-notification-catalog';

vi.mock('@/features/module-registry/context/ModuleRegistryProvider', () => ({
  useModuleRegistry: vi.fn(),
}));

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/features/dynamic-branch/context/DynamicBranchProvider', () => ({
  useOptionalBranch: vi.fn(() => null),
}));

vi.mock('@/features/dynamic-branch/hooks/useRegisterBranchConsumer', () => ({
  useRegisterBranchConsumer: vi.fn(),
}));

vi.mock('@/features/dynamic-white-label/context/DynamicWhiteLabelProvider', () => ({
  useOptionalWhiteLabel: vi.fn(() => null),
}));

vi.mock('@booking/i18n/react', () => ({
  useI18n: vi.fn(() => ({ locale: 'en', t: (key: string) => key })),
}));

import { useModuleRegistry } from '@/features/module-registry/context/ModuleRegistryProvider';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOptionalBranch } from '@/features/dynamic-branch/context/DynamicBranchProvider';
import { useRegisterBranchConsumer } from '@/features/dynamic-branch/hooks/useRegisterBranchConsumer';
import { useOptionalWhiteLabel } from '@/features/dynamic-white-label/context/DynamicWhiteLabelProvider';

const ALL_ENABLED = Object.fromEntries(
  BUILTIN_MODULE_MANIFESTS.map((manifest) => [manifest.moduleId, 'enabled' as const]),
);

const REGISTRY_SNAPSHOT = {
  schemaVersion: '1.0',
  platformVersion: '1.0.0',
  generatedAt: '2026-07-16T00:00:00.000Z',
  catalogGeneration: 1,
  moduleCount: 43,
  dependencyOrder: [],
  entitlementVersion: 'active|w:true|m:true|lm:|mf:',
};

function buildModulesForRole(roles: string[]) {
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

function wrapper({ children }: { children: ReactNode }) {
  return createElement(DynamicNotificationProvider, null, children);
}

describe('DynamicNotificationProvider integration', () => {
  const refresh = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.unstubAllEnvs();
    clearNotificationCache();
    vi.mocked(useAuth).mockReturnValue({
      user: { roles: ['owner'], tenantId: 'tenant-1', userId: 'user-1' },
    } as ReturnType<typeof useAuth>);
    vi.mocked(useOptionalBranch).mockReturnValue({
      activeBranchId: 'branch-1',
      branchSnapshotVersion: 'bv1',
    } as ReturnType<typeof useOptionalBranch>);
    vi.mocked(useOptionalWhiteLabel).mockReturnValue(null);
  });

  afterEach(() => {
    clearNotificationCache();
    vi.unstubAllEnvs();
  });

  it('registers as a branch refresh consumer', () => {
    vi.mocked(useModuleRegistry).mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      snapshot: REGISTRY_SNAPSHOT,
      modules: buildModulesForRole(['owner']),
      refresh,
      getModule: vi.fn(),
    });

    renderHook(() => useNotification(), { wrapper });
    expect(useRegisterBranchConsumer).toHaveBeenCalledWith('notification', expect.any(Function));
  });

  it('transitions loading → registry without widening restricted capabilities', () => {
    vi.mocked(useModuleRegistry).mockReturnValue({
      isLoading: true,
      isError: false,
      error: null,
      snapshot: REGISTRY_SNAPSHOT,
      modules: [],
      refresh,
      getModule: vi.fn(),
    });

    const { result, rerender } = renderHook(() => useNotification(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isRegistrySource).toBe(true);
    expect(result.current.source).toBe('restricted');
    expect(result.current.canViewNotificationCenter).toBe(false);
    expect(result.current.channels).toEqual([]);
    expect(result.current.types).toEqual([]);

    vi.mocked(useModuleRegistry).mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      snapshot: REGISTRY_SNAPSHOT,
      modules: buildModulesForRole(['owner']),
      refresh,
      getModule: vi.fn(),
    });
    rerender();

    expect(result.current.isRegistrySource).toBe(true);
    expect(result.current.source).toBe('registry');
    expect(result.current.canViewNotificationCenter).toBe(true);
    expect(result.current.channels.length).toBeGreaterThan(0);
    expect(result.current.providerKey).toBe('notification.builtin');
    expect(result.current.branchSnapshotVersion).toBe('bv1');
    expect(result.current.activeBranchId).toBe('branch-1');
  });

  it('refresh() clears notification cache and rebuilds', async () => {
    vi.mocked(useModuleRegistry).mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      snapshot: REGISTRY_SNAPSHOT,
      modules: buildModulesForRole(['owner']),
      refresh,
      getModule: vi.fn(),
    });

    const { result } = renderHook(() => useNotification(), { wrapper });
    const before = result.current.notificationSnapshotVersion;
    await act(async () => {
      await result.current.refresh();
    });
    expect(refresh).toHaveBeenCalled();
    expect(result.current.notificationSnapshotVersion).toBe(before);
  });

  it('registry owner snapshot never exceeds static catalog channel vocabulary', () => {
    const catalogChannelCount = STATIC_NOTIFICATION_CATALOG.filter((entry) => entry.notificationKind === 'channel').length;
    vi.mocked(useModuleRegistry).mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      snapshot: REGISTRY_SNAPSHOT,
      modules: buildModulesForRole(['owner']),
      refresh,
      getModule: vi.fn(),
    });

    const { result } = renderHook(() => useNotification(), { wrapper });
    expect(result.current.channels.length).toBeGreaterThan(0);
    expect(result.current.channels.length).toBeLessThanOrEqual(catalogChannelCount);

    const staticPermittedChannelCount = buildStaticNotificationSnapshot(
      ['owner'],
      STATIC_NOTIFICATION_CATALOG,
      { tenantId: 'tenant-1', userId: 'user-1', rolesHash: 'owner', branchId: 'branch-1', locale: 'en' },
      null,
      'static-fallback',
    ).channels.length;
    expect(staticPermittedChannelCount).toBeLessThanOrEqual(catalogChannelCount);
  });

  it('passes through whiteLabelSnapshotVersion from optional white label context', () => {
    vi.mocked(useOptionalWhiteLabel).mockReturnValue({
      settingsVersion: 'wl-v7',
    } as ReturnType<typeof useOptionalWhiteLabel>);
    vi.mocked(useModuleRegistry).mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      snapshot: REGISTRY_SNAPSHOT,
      modules: buildModulesForRole(['owner']),
      refresh,
      getModule: vi.fn(),
    });

    const { result } = renderHook(() => useNotification(), { wrapper });
    expect(result.current.whiteLabelSnapshotVersion).toBe('wl-v7');
  });

  it('defaults whiteLabelSnapshotVersion to null when white label provider is absent', () => {
    vi.mocked(useModuleRegistry).mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      snapshot: REGISTRY_SNAPSHOT,
      modules: buildModulesForRole(['owner']),
      refresh,
      getModule: vi.fn(),
    });

    const { result } = renderHook(() => useNotification(), { wrapper });
    expect(result.current.whiteLabelSnapshotVersion).toBeNull();
  });
});
