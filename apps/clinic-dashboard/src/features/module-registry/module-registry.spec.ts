/** @vitest-environment jsdom */

import { describe, expect, it, vi, beforeEach } from 'vitest';

import { renderHook, waitFor } from '@testing-library/react';

import { createElement, type ReactNode } from 'react';

import { ModuleRegistryProvider, useModuleRegistry } from './context/ModuleRegistryProvider';



vi.mock('./api/module-registry-api', () => ({

  fetchModuleRegistryBootstrap: vi.fn(),

}));



vi.mock('@/app/providers/AuthProvider', () => ({

  useAuth: vi.fn(),

}));



import { fetchModuleRegistryBootstrap } from './api/module-registry-api';

import { useAuth } from '@/app/providers/AuthProvider';

import { readRegistryCache } from './lib/registry-cache';



const bootstrapPayload = {

  snapshot: {

    schemaVersion: '1.0' as const,

    platformVersion: '1.0.0',

    generatedAt: '2026-07-12T00:00:00.000Z',

    catalogGeneration: 1,

    moduleCount: 21,

    dependencyOrder: ['dashboard'],

    entitlementVersion: 'active|w:true|m:true|lm:dashboard:enabled|mf:',

  },

  modules: [

    {

      moduleId: 'dashboard',

      manifestId: 'dashboard@1.0.0',

      access: 'enabled' as const,

      tenantOverride: 'inherit' as const,

      runtimeStatus: 'healthy' as const,

      userVisible: true,

      userAccessible: true,

      dependencies: [],

      extensions: [],

    },

  ],

};



function wrapper({ children }: { children: ReactNode }) {

  return createElement(ModuleRegistryProvider, null, children);

}



describe('ModuleRegistryProvider', () => {

  beforeEach(() => {

    vi.mocked(fetchModuleRegistryBootstrap).mockResolvedValue(bootstrapPayload);

    vi.mocked(useAuth).mockReturnValue({

      user: {

        userId: 'user-1',

        tenantId: 'tenant-1',

        roles: ['owner'],

      },

      getValidAccessToken: vi.fn().mockResolvedValue('test-token'),

    } as never);

    sessionStorage.clear();

  });



  it('bootstraps registry from API', async () => {

    const { result } = renderHook(() => useModuleRegistry(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.modules).toHaveLength(1);

    expect(result.current.getModule('dashboard')?.userAccessible).toBe(true);

  });



  it('refetches when user identity changes', async () => {

    const { result, rerender } = renderHook(() => useModuleRegistry(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callsAfterFirstIdentity = vi.mocked(fetchModuleRegistryBootstrap).mock.calls.length;

    vi.mocked(useAuth).mockReturnValue({

      user: {

        userId: 'user-2',

        tenantId: 'tenant-1',

        roles: ['receptionist'],

      },

      getValidAccessToken: vi.fn().mockResolvedValue('test-token'),

    } as never);



    rerender();

    await waitFor(() =>
      expect(vi.mocked(fetchModuleRegistryBootstrap).mock.calls.length).toBeGreaterThan(
        callsAfterFirstIdentity,
      ),
    );

    expect(

      readRegistryCache({

        tenantId: 'tenant-1',

        userId: 'user-2',

        rolesHash: 'receptionist',

      }),

    ).not.toBeNull();

  });

});

