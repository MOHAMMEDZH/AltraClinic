/** @vitest-environment jsdom */
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { DynamicActivityProvider, useActivity } from './context/DynamicActivityProvider';
import { buildStaticActivitySnapshot } from './lib/activity-snapshot-builder';
import { STATIC_ACTIVITY_CATALOG } from './lib/static-activity-catalog';
import { isRegistryActivityEnabled } from './lib/activity-flags';
import { assertActivitySnapshotValid } from './lib/activity-validation';

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

const IDENTITY = { tenantId: 'tenant-1', userId: 'user-1', rolesHash: 'owner', branchId: null };

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
  return createElement(DynamicActivityProvider, null, children);
}

describe('dynamic activity rollback', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { roles: ['owner'], tenantId: 'tenant-1', userId: 'user-1' },
    } as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('disables registry activity when VITE_USE_STATIC_ACTIVITY_ONLY=true', () => {
    vi.stubEnv('VITE_USE_STATIC_ACTIVITY_ONLY', 'true');
    expect(isRegistryActivityEnabled()).toBe(false);
  });

  it('enables registry activity by default', () => {
    vi.stubEnv('VITE_USE_STATIC_ACTIVITY_ONLY', undefined);
    expect(isRegistryActivityEnabled()).toBe(true);
  });

  it('bypasses registry path and builds static-only snapshot from STATIC_ACTIVITY_CATALOG', () => {
    vi.stubEnv('VITE_USE_STATIC_ACTIVITY_ONLY', 'true');
    expect(isRegistryActivityEnabled()).toBe(false);

    const snapshot = buildStaticActivitySnapshot(
      ['owner'],
      STATIC_ACTIVITY_CATALOG,
      IDENTITY,
      'static-only',
    );

    expect(snapshot.source).toBe('static-only');
    expect(
      assertActivitySnapshotValid(snapshot),
      assertActivitySnapshotValid(snapshot).join('\n'),
    ).toEqual([]);
    expect(snapshot.feeds.length).toBe(7);
    expect(snapshot.hubs.length).toBe(3);
  });

  it('keeps provider functional without registry modules when rollback is active', () => {
    vi.stubEnv('VITE_USE_STATIC_ACTIVITY_ONLY', 'true');
    vi.mocked(useModuleRegistry).mockReturnValue(EMPTY_REGISTRY);

    const { result } = renderHook(() => useActivity(), { wrapper });

    expect(result.current.isRegistrySource).toBe(false);
    expect(result.current.source).toBe('static-only');
    expect(result.current.feeds.length).toBe(7);
    expect(result.current.canViewActivity).toBe(true);
    expect(result.current.registryStatus).toBe('loading');
  });
});
