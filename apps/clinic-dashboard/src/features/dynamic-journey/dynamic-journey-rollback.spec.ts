/** @vitest-environment jsdom */
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { DynamicJourneyProvider, useJourney } from './context/DynamicJourneyProvider';
import { buildStaticJourneySnapshot } from './lib/journey-snapshot-builder';
import { STATIC_JOURNEY_CATALOG } from './lib/static-journey-catalog';
import { isRegistryJourneyEnabled } from './lib/journey-flags';
import { assertJourneySnapshotValid } from './lib/journey-validation';

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

const IDENTITY = { tenantId: 'tenant-1', userId: 'user-1', rolesHash: 'owner', branchId: 'branch-1' };

const EMPTY_REGISTRY = {
  isLoading: true,
  isError: false,
  error: null,
  snapshot: {
    schemaVersion: '1.0',
    platformVersion: '1.0.0',
    generatedAt: '2026-07-16T00:00:00.000Z',
    catalogGeneration: 1,
    moduleCount: 0,
    dependencyOrder: [],
    entitlementVersion: 'active|w:true|m:true|lm:|mf:',
  },
  modules: [],
  refresh: vi.fn(),
  getModule: vi.fn(),
};

function wrapper({ children }: { children: ReactNode }) {
  return createElement(DynamicJourneyProvider, null, children);
}

describe('dynamic journey rollback', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { roles: ['owner'], tenantId: 'tenant-1', userId: 'user-1' },
    } as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('disables registry journey when VITE_USE_STATIC_JOURNEY_ONLY=true', () => {
    vi.stubEnv('VITE_USE_STATIC_JOURNEY_ONLY', 'true');
    expect(isRegistryJourneyEnabled()).toBe(false);
  });

  it('enables registry journey by default', () => {
    vi.stubEnv('VITE_USE_STATIC_JOURNEY_ONLY', undefined);
    expect(isRegistryJourneyEnabled()).toBe(true);
  });

  it('bypasses registry path and builds static-only snapshot from STATIC_JOURNEY_CATALOG', () => {
    vi.stubEnv('VITE_USE_STATIC_JOURNEY_ONLY', 'true');
    expect(isRegistryJourneyEnabled()).toBe(false);

    const snapshot = buildStaticJourneySnapshot(
      ['owner'],
      STATIC_JOURNEY_CATALOG,
      IDENTITY,
      'static-only',
    );

    expect(snapshot.source).toBe('static-only');
    expect(
      assertJourneySnapshotValid(snapshot),
      assertJourneySnapshotValid(snapshot).join('\n'),
    ).toEqual([]);
    expect(snapshot.stages.length).toBeGreaterThan(0);
    expect(snapshot.surfaces.length).toBeGreaterThanOrEqual(1);
  });

  it('keeps provider functional without registry modules when rollback is active', () => {
    vi.stubEnv('VITE_USE_STATIC_JOURNEY_ONLY', 'true');
    vi.mocked(useModuleRegistry).mockReturnValue(EMPTY_REGISTRY);

    const { result } = renderHook(() => useJourney(), { wrapper });

    expect(result.current.isRegistrySource).toBe(false);
    expect(result.current.source).toBe('static-only');
    expect(result.current.stages.length).toBeGreaterThan(0);
    expect(result.current.canViewJourney).toBe(true);
    expect(result.current.registryStatus).toBe('loading');
  });
});
