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

  DynamicAnalyticsProvider,

  useDynamicAnalytics,

} from './context/DynamicAnalyticsProvider';

import { clearAnalyticsCache } from './lib/analytics-cache';

import { buildStaticAnalyticsSnapshot } from './lib/analytics-snapshot-builder';

import { STATIC_ANALYTICS_CATALOG } from './lib/static-analytics-catalog';



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

  return createElement(DynamicAnalyticsProvider, null, children);

}



describe('DynamicAnalyticsProvider integration', () => {

  const refresh = vi.fn().mockResolvedValue(undefined);



  beforeEach(() => {

    vi.unstubAllEnvs();

    clearAnalyticsCache();

    vi.mocked(useAuth).mockReturnValue({

      user: { roles: ['owner'], tenantId: 'tenant-1', userId: 'user-1' },

    } as ReturnType<typeof useAuth>);

  });



  afterEach(() => {

    clearAnalyticsCache();

    vi.unstubAllEnvs();

  });



  it('transitions loading → registry → refresh → restricted → rollback without widening permissions', async () => {

    const ownerModules = buildModulesForRole(['owner']);

    const staticPermittedIds = new Set(

      buildStaticAnalyticsSnapshot(

        ['owner'],

        STATIC_ANALYTICS_CATALOG,

        { tenantId: 'tenant-1', userId: 'user-1', rolesHash: 'owner' },

        'static-fallback',

      ).domains.map((domain) => domain.domainId),

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



    const { result, rerender } = renderHook(() => useDynamicAnalytics(), { wrapper });



    expect(result.current.isLoading).toBe(true);

    expect(result.current.isRegistrySource).toBe(true);

    expect(result.current.canViewAnalytics).toBe(false);

    expect(result.current.domains).toEqual([]);



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

    expect(result.current.domains.length).toBeGreaterThan(0);

    const registryDomainCount = result.current.domains.length;

    for (const domain of result.current.domains) {

      expect(staticPermittedIds.has(domain.domainId), domain.domainId).toBe(true);

    }

    expect(result.current.canViewAnalytics).toBe(true);

    expect(result.current.canCreateDashboards).toBe(true);

    expect(result.current.canExportAnalytics).toBe(true);



    await act(async () => {

      await result.current.refresh();

    });

    expect(refresh).toHaveBeenCalled();

    rerender();

    expect(result.current.domains.length).toBe(registryDomainCount);



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

    expect(result.current.canViewAnalytics).toBe(false);

    expect(result.current.domains).toEqual([]);



    vi.stubEnv('VITE_USE_STATIC_ANALYTICS_ONLY', 'true');

    rerender();

    expect(result.current.isRegistrySource).toBe(false);

    expect(result.current.source).toBe('static-only');

    expect(result.current.domains.length).toBeGreaterThan(0);

    for (const domain of result.current.domains) {

      expect(staticPermittedIds.has(domain.domainId), domain.domainId).toBe(true);

    }

  });

});
