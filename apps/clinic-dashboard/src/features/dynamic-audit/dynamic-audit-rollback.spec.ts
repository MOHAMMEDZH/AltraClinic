/** @vitest-environment jsdom */
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { DynamicAuditProvider, useAudit } from './context/DynamicAuditProvider';
import { buildStaticAuditSnapshot } from './lib/audit-snapshot-builder';
import { STATIC_AUDIT_CATALOG } from './lib/static-audit-catalog';
import { isRegistryAuditEnabled } from './lib/audit-flags';
import { assertAuditSnapshotValid } from './lib/audit-validation';

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
    schemaVersion: '1.0' as const,
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
  return createElement(DynamicAuditProvider, null, children);
}

describe('dynamic audit rollback', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { roles: ['owner'], tenantId: 'tenant-1', userId: 'user-1' },
    } as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('disables registry audit when VITE_USE_STATIC_AUDIT_ONLY=true', () => {
    vi.stubEnv('VITE_USE_STATIC_AUDIT_ONLY', 'true');
    expect(isRegistryAuditEnabled()).toBe(false);
  });

  it('enables registry audit by default', () => {
    vi.stubEnv('VITE_USE_STATIC_AUDIT_ONLY', '');
    expect(isRegistryAuditEnabled()).toBe(true);
  });

  it('bypasses registry path and builds static-only snapshot from STATIC_AUDIT_CATALOG', () => {
    vi.stubEnv('VITE_USE_STATIC_AUDIT_ONLY', 'true');
    expect(isRegistryAuditEnabled()).toBe(false);

    const snapshot = buildStaticAuditSnapshot(
      ['owner'],
      STATIC_AUDIT_CATALOG,
      IDENTITY,
      'static-only',
    );

    expect(snapshot.source).toBe('static-only');
    expect(
      assertAuditSnapshotValid(snapshot),
      assertAuditSnapshotValid(snapshot).join('\n'),
    ).toEqual([]);
    expect(snapshot.feeds.length).toBeGreaterThanOrEqual(12);
    expect(snapshot.surfaces.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps provider functional without registry modules when rollback is active', () => {
    vi.stubEnv('VITE_USE_STATIC_AUDIT_ONLY', 'true');
    vi.mocked(useModuleRegistry).mockReturnValue(EMPTY_REGISTRY);

    const { result } = renderHook(() => useAudit(), { wrapper });

    expect(result.current.isRegistrySource).toBe(false);
    expect(result.current.source).toBe('static-only');
    expect(result.current.feeds.length).toBeGreaterThanOrEqual(12);
    expect(result.current.canViewAuditCenter).toBe(true);
    expect(result.current.registryStatus).toBe('loading');
  });
});
