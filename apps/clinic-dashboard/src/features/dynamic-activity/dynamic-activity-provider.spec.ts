/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import {
  BUILTIN_MODULE_MANIFESTS,
  resolveDependencyGraph,
  resolveEffectiveModuleViews,
} from '@booking/module-registry';
import { hasPermission } from '@booking/permissions';
import { DynamicActivityProvider, useActivity } from './context/DynamicActivityProvider';
import { clearActivityCache } from './lib/activity-cache';
import { buildStaticActivitySnapshot } from './lib/activity-snapshot-builder';
import { STATIC_ACTIVITY_CATALOG } from './lib/static-activity-catalog';

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

import { useModuleRegistry } from '@/features/module-registry/context/ModuleRegistryProvider';
import { useAuth } from '@/app/providers/AuthProvider';

const ALL_ENABLED = Object.fromEntries(
  BUILTIN_MODULE_MANIFESTS.map((manifest) => [manifest.moduleId, 'enabled' as const]),
);

const REGISTRY_SNAPSHOT = {
  schemaVersion: '1.0' as const,
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
  return createElement(DynamicActivityProvider, null, children);
}

describe('DynamicActivityProvider integration', () => {
  const refresh = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.unstubAllEnvs();
    clearActivityCache();
    vi.mocked(useAuth).mockReturnValue({
      user: { roles: ['owner'], tenantId: 'tenant-1', userId: 'user-1' },
    } as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    clearActivityCache();
    vi.unstubAllEnvs();
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

    const { result, rerender } = renderHook(() => useActivity(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isRegistrySource).toBe(true);
    expect(result.current.canViewActivity).toBe(false);
    expect(result.current.feeds).toEqual([]);

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
    expect(result.current.canViewActivity).toBe(true);
    expect(result.current.feeds.length).toBeGreaterThan(0);
    expect(result.current.providerKey).toBe('activity.builtin');
  });

  it('static permitted count is a subset of registry owner snapshot', () => {
    const ownerModules = buildModulesForRole(['owner']);
    const staticPermittedFeedCount = buildStaticActivitySnapshot(
      ['owner'],
      STATIC_ACTIVITY_CATALOG,
      { tenantId: 'tenant-1', userId: 'user-1', rolesHash: 'owner', branchId: null },
      'static-fallback',
    ).feeds.length;

    vi.mocked(useModuleRegistry).mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      snapshot: REGISTRY_SNAPSHOT,
      modules: ownerModules,
      refresh,
      getModule: vi.fn(),
    });

    const { result } = renderHook(() => useActivity(), { wrapper });
    expect(result.current.feeds.length).toBeLessThanOrEqual(staticPermittedFeedCount);
  });
});
