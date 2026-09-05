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
import {
  DynamicReportingProvider,
  useDynamicReporting,
} from './context/DynamicReportingProvider';
import { clearReportingCache } from './lib/reporting-cache';
import { buildStaticReportingSnapshot } from './lib/reporting-snapshot-builder';
import { STATIC_REPORT_CATALOG } from './lib/static-report-catalog';

vi.mock('@/features/module-registry/context/ModuleRegistryProvider', () => ({
  useModuleRegistry: vi.fn(),
}));

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

import { useModuleRegistry } from '@/features/module-registry/context/ModuleRegistryProvider';
import { useAuth } from '@/app/providers/AuthProvider';

const ALL_ENABLED = Object.fromEntries(
  BUILTIN_MODULE_MANIFESTS.map((manifest) => [manifest.moduleId, 'enabled' as const]),
);

const REGISTRY_SNAPSHOT = {
  schemaVersion: '1.0' as const,
  platformVersion: '1.0.0',
  generatedAt: '2026-07-14T00:00:00.000Z',
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
  return createElement(DynamicReportingProvider, null, children);
}

describe('DynamicReportingProvider integration', () => {
  const refresh = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.unstubAllEnvs();
    clearReportingCache();
    vi.mocked(useAuth).mockReturnValue({
      user: { roles: ['owner'], tenantId: 'tenant-1', userId: 'user-1' },
    } as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    clearReportingCache();
    vi.unstubAllEnvs();
  });

  it('transitions loading → registry → refresh → restricted → rollback without widening permissions', async () => {
    const ownerModules = buildModulesForRole(['owner']);
    const staticPermittedIds = new Set(
      buildStaticReportingSnapshot(
        ['owner'],
        STATIC_REPORT_CATALOG,
        { tenantId: 'tenant-1', userId: 'user-1', rolesHash: 'owner' },
        'static-fallback',
      ).templates.map((template) => template.reportId),
    );

    vi.mocked(useModuleRegistry).mockReturnValue({
      isLoading: true,
      isError: false,
      error: null,
      snapshot: REGISTRY_SNAPSHOT,
      modules: [],
      refresh,
      getModule: vi.fn(),
    });

    const { result, rerender } = renderHook(() => useDynamicReporting(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isRegistrySource).toBe(true);
    expect(result.current.canViewReporting).toBe(false);
    expect(result.current.templates).toEqual([]);

    vi.mocked(useModuleRegistry).mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      snapshot: REGISTRY_SNAPSHOT,
      modules: ownerModules,
      refresh,
      getModule: vi.fn(),
    });
    rerender();

    expect(result.current.isRegistrySource).toBe(true);
    expect(result.current.source).toBe('registry');
    expect(result.current.templates.length).toBeGreaterThan(0);
    const registryTemplateCount = result.current.templates.length;
    for (const template of result.current.templates) {
      expect(staticPermittedIds.has(template.reportId), template.reportId).toBe(true);
    }

    await act(async () => {
      await result.current.refresh();
    });
    expect(refresh).toHaveBeenCalled();
    rerender();
    expect(result.current.templates.length).toBe(registryTemplateCount);

    vi.mocked(useModuleRegistry).mockReturnValue({
      isLoading: true,
      isError: false,
      error: null,
      snapshot: REGISTRY_SNAPSHOT,
      modules: [],
      refresh,
      getModule: vi.fn(),
    });
    vi.mocked(useAuth).mockReturnValue({
      user: { roles: ['owner'], tenantId: 'tenant-1', userId: 'user-2' },
    } as ReturnType<typeof useAuth>);
    rerender();
    expect(result.current.canViewReporting).toBe(false);
    expect(result.current.templates).toEqual([]);

    vi.mocked(useModuleRegistry).mockReturnValue({
      isLoading: false,
      isError: true,
      error: new Error('registry unavailable'),
      snapshot: null,
      modules: [],
      refresh,
      getModule: vi.fn(),
    });
    rerender();
    expect(result.current.isRegistrySource).toBe(false);
    expect(result.current.source).toBe('static-fallback');
    expect(result.current.registryStatus).toBe('error');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.templates.length).toBeGreaterThan(5);
    for (const template of result.current.templates) {
      expect(staticPermittedIds.has(template.reportId), template.reportId).toBe(true);
    }

    vi.stubEnv('VITE_USE_STATIC_REPORTING_ONLY', 'true');
    rerender();
    expect(result.current.isRegistrySource).toBe(false);
    expect(result.current.source).toBe('static-only');
    expect(result.current.templates.length).toBeGreaterThan(0);
    for (const template of result.current.templates) {
      expect(staticPermittedIds.has(template.reportId), template.reportId).toBe(true);
    }
  });
});
