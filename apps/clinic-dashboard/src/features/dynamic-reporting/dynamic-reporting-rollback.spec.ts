/** @vitest-environment jsdom */
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import {
  DynamicReportingProvider,
  useDynamicReporting,
} from './context/DynamicReportingProvider';
import { buildStaticReportingSnapshot } from './lib/reporting-snapshot-builder';
import { STATIC_REPORT_CATALOG } from './lib/static-report-catalog';
import { isRegistryReportingEnabled } from './lib/static-report-flags';
import { assertReportingSnapshotValid } from './lib/reporting-validation';

vi.mock('@/features/module-registry/context/ModuleRegistryProvider', () => ({
  useModuleRegistry: vi.fn(),
}));

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

import { useModuleRegistry } from '@/features/module-registry/context/ModuleRegistryProvider';

import { useAuth } from '@/app/providers/AuthProvider';

const IDENTITY = { tenantId: 'tenant-1', userId: 'user-1', rolesHash: 'owner' };

const EMPTY_REGISTRY = {
  isLoading: true,
  isError: false,
  error: null,
  snapshot: {
    schemaVersion: '1.0' as const,
    platformVersion: '1.0.0',
    generatedAt: '2026-07-14T00:00:00.000Z',
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
  return createElement(DynamicReportingProvider, null, children);
}

describe('dynamic reporting rollback', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { roles: ['owner'], tenantId: 'tenant-1', userId: 'user-1' },
    } as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('disables registry reporting when VITE_USE_STATIC_REPORTING_ONLY=true', () => {
    vi.stubEnv('VITE_USE_STATIC_REPORTING_ONLY', 'true');
    expect(isRegistryReportingEnabled()).toBe(false);
  });

  it('enables registry reporting by default', () => {
    vi.stubEnv('VITE_USE_STATIC_REPORTING_ONLY', '');
    expect(isRegistryReportingEnabled()).toBe(true);
  });

  it('bypasses registry path and builds static-only snapshot from STATIC_REPORT_CATALOG', () => {
    vi.stubEnv('VITE_USE_STATIC_REPORTING_ONLY', 'true');
    expect(isRegistryReportingEnabled()).toBe(false);

    const snapshot = buildStaticReportingSnapshot(
      ['owner'],
      STATIC_REPORT_CATALOG,
      IDENTITY,
      'static-only',
    );

    expect(snapshot.source).toBe('static-only');
    expect(
      assertReportingSnapshotValid(snapshot),
      assertReportingSnapshotValid(snapshot).join('\n'),
    ).toEqual([]);
    expect(snapshot.templates.length).toBeGreaterThan(20);
    expect(snapshot.hubEntries.length).toBe(3);
    expect(
      snapshot.templates.every((template) =>
        STATIC_REPORT_CATALOG.some((entry) => entry.reportId === template.reportId),
      ),
    ).toBe(true);
  });

  it('keeps provider functional without registry modules when rollback is active', () => {
    vi.stubEnv('VITE_USE_STATIC_REPORTING_ONLY', 'true');
    vi.mocked(useModuleRegistry).mockReturnValue(EMPTY_REGISTRY);

    const { result } = renderHook(() => useDynamicReporting(), { wrapper });

    expect(result.current.isRegistrySource).toBe(false);
    expect(result.current.source).toBe('static-only');
    expect(result.current.templates.length).toBeGreaterThan(20);
    expect(result.current.canViewReporting).toBe(true);
    expect(result.current.registryStatus).toBe('loading');
  });
});
