/** @vitest-environment jsdom */

import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';

import { renderHook } from '@testing-library/react';

import { createElement, type ReactNode } from 'react';

import {

  DynamicAnalyticsProvider,

  useDynamicAnalytics,

} from './context/DynamicAnalyticsProvider';

import { buildStaticAnalyticsSnapshot } from './lib/analytics-snapshot-builder';

import { STATIC_ANALYTICS_CATALOG } from './lib/static-analytics-catalog';

import { isRegistryAnalyticsEnabled } from './lib/static-analytics-flags';

import { assertAnalyticsSnapshotValid } from './lib/analytics-validation';



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

  return createElement(DynamicAnalyticsProvider, null, children);

}



describe('dynamic analytics rollback', () => {

  beforeEach(() => {

    vi.mocked(useAuth).mockReturnValue({

      user: { roles: ['owner'], tenantId: 'tenant-1', userId: 'user-1' },

    } as ReturnType<typeof useAuth>);

  });



  afterEach(() => {

    vi.unstubAllEnvs();

  });



  it('disables registry analytics when VITE_USE_STATIC_ANALYTICS_ONLY=true', () => {

    vi.stubEnv('VITE_USE_STATIC_ANALYTICS_ONLY', 'true');

    expect(isRegistryAnalyticsEnabled()).toBe(false);

  });



  it('enables registry analytics by default', () => {

    vi.stubEnv('VITE_USE_STATIC_ANALYTICS_ONLY', '');

    expect(isRegistryAnalyticsEnabled()).toBe(true);

  });



  it('bypasses registry path and builds static-only snapshot from STATIC_ANALYTICS_CATALOG', () => {

    vi.stubEnv('VITE_USE_STATIC_ANALYTICS_ONLY', 'true');

    expect(isRegistryAnalyticsEnabled()).toBe(false);



    const snapshot = buildStaticAnalyticsSnapshot(

      ['owner'],

      STATIC_ANALYTICS_CATALOG,

      IDENTITY,

      'static-only',

    );



    expect(snapshot.source).toBe('static-only');

    expect(

      assertAnalyticsSnapshotValid(snapshot),

      assertAnalyticsSnapshotValid(snapshot).join('\n'),

    ).toEqual([]);

    expect(snapshot.domains.length).toBe(11);

    expect(snapshot.hubs.length).toBe(3);

    expect(

      snapshot.domains.every((domain) =>

        STATIC_ANALYTICS_CATALOG.some((entry) => entry.analyticsId === domain.analyticsId),

      ),

    ).toBe(true);

  });



  it('keeps provider functional without registry modules when rollback is active', () => {

    vi.stubEnv('VITE_USE_STATIC_ANALYTICS_ONLY', 'true');

    vi.mocked(useModuleRegistry).mockReturnValue(EMPTY_REGISTRY);



    const { result } = renderHook(() => useDynamicAnalytics(), { wrapper });



    expect(result.current.isRegistrySource).toBe(false);

    expect(result.current.source).toBe('static-only');

    expect(result.current.domains.length).toBe(11);

    expect(result.current.canViewAnalytics).toBe(true);

    expect(result.current.registryStatus).toBe('loading');

  });

});
