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
import { DynamicJourneyProvider, useJourney } from './context/DynamicJourneyProvider';
import { clearJourneyCache } from './lib/journey-cache';
import { buildStaticJourneySnapshot } from './lib/journey-snapshot-builder';
import { STATIC_JOURNEY_CATALOG } from './lib/static-journey-catalog';

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
import { useOptionalBranch } from '@/features/dynamic-branch/context/DynamicBranchProvider';
import { useRegisterBranchConsumer } from '@/features/dynamic-branch/hooks/useRegisterBranchConsumer';

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
  return createElement(DynamicJourneyProvider, null, children);
}

describe('DynamicJourneyProvider integration', () => {
  const refresh = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.unstubAllEnvs();
    clearJourneyCache();
    vi.mocked(useAuth).mockReturnValue({
      user: { roles: ['owner'], tenantId: 'tenant-1', userId: 'user-1' },
    } as ReturnType<typeof useAuth>);
    vi.mocked(useOptionalBranch).mockReturnValue({
      activeBranchId: 'branch-1',
      branchSnapshotVersion: 'bv1',
    } as ReturnType<typeof useOptionalBranch>);
  });

  afterEach(() => {
    clearJourneyCache();
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

    renderHook(() => useJourney(), { wrapper });
    expect(useRegisterBranchConsumer).toHaveBeenCalledWith('journey', expect.any(Function));
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

    const { result, rerender } = renderHook(() => useJourney(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isRegistrySource).toBe(true);
    expect(result.current.source).toBe('restricted');
    expect(result.current.canViewJourney).toBe(false);
    expect(result.current.stages).toEqual([]);
    expect(result.current.transitions).toEqual([]);

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
    expect(result.current.canViewJourney).toBe(true);
    expect(result.current.stages.length).toBeGreaterThan(0);
    expect(result.current.providerKey).toBe('journey.builtin');
    expect(result.current.branchSnapshotVersion).toBe('bv1');
    expect(result.current.activeBranchId).toBe('branch-1');
  });

  it('refresh() clears journey cache and rebuilds', async () => {
    vi.mocked(useModuleRegistry).mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      snapshot: REGISTRY_SNAPSHOT,
      modules: buildModulesForRole(['owner']),
      refresh,
      getModule: vi.fn(),
    });

    const { result } = renderHook(() => useJourney(), { wrapper });
    const before = result.current.journeySnapshotVersion;
    await act(async () => {
      await result.current.refresh();
    });
    expect(refresh).toHaveBeenCalled();
    expect(result.current.journeySnapshotVersion).toBe(before);
  });

  it('registry owner snapshot never exceeds static catalog stage vocabulary', () => {
    const catalogStageCount = STATIC_JOURNEY_CATALOG.filter((entry) => entry.journeyKind === 'stage').length;
    vi.mocked(useModuleRegistry).mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      snapshot: REGISTRY_SNAPSHOT,
      modules: buildModulesForRole(['owner']),
      refresh,
      getModule: vi.fn(),
    });

    const { result } = renderHook(() => useJourney(), { wrapper });
    expect(result.current.stages.length).toBeGreaterThan(0);
    expect(result.current.stages.length).toBeLessThanOrEqual(catalogStageCount);

    const staticPermittedStageCount = buildStaticJourneySnapshot(
      ['owner'],
      STATIC_JOURNEY_CATALOG,
      { tenantId: 'tenant-1', userId: 'user-1', rolesHash: 'owner', branchId: 'branch-1' },
      'static-fallback',
    ).stages.length;
    expect(staticPermittedStageCount).toBeLessThanOrEqual(catalogStageCount);
  });
});
