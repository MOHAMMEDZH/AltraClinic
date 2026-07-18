/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import {
  DynamicNavigationProvider,
  useSidebarNavigation,
} from './context/DynamicNavigationProvider';

vi.mock('@/features/module-registry/context/ModuleRegistryProvider', () => ({
  useModuleRegistry: vi.fn(),
}));

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: vi.fn(() => ({ user: { roles: ['owner'], tenantId: 't1' } })),
}));

import { useModuleRegistry } from '@/features/module-registry/context/ModuleRegistryProvider';

const bootstrapModules = [
  {
    moduleId: 'dashboard',
    manifestId: 'dashboard@1.0.0',
    access: 'enabled' as const,
    tenantOverride: 'inherit' as const,
    runtimeStatus: 'healthy' as const,
    userVisible: true,
    userAccessible: true,
    dependencies: [],
    extensions: [
      {
        extensionId: 'dashboard/nav/primary',
        kind: 'navigation' as const,
        moduleId: 'dashboard',
        labelKey: 'nav.dashboard',
        sortOrder: 0,
        userVisible: true,
        payload: {
          path: '/',
          placement: 'sidebar',
          icon: 'LayoutDashboard',
          userAccessible: true,
        },
      },
    ],
  },
];

function wrapper({ children }: { children: ReactNode }) {
  return createElement(DynamicNavigationProvider, null, children);
}

describe('DynamicNavigationProvider', () => {
  beforeEach(() => {
    vi.mocked(useModuleRegistry).mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      snapshot: {
        schemaVersion: '1.0',
        platformVersion: '1.0.0',
        generatedAt: '2026-07-13T00:00:00.000Z',
        catalogGeneration: 1,
        moduleCount: 21,
        dependencyOrder: ['dashboard'],
        entitlementVersion: 'active|w:true|m:true|lm:|mf:',
      },
      modules: bootstrapModules,
      refresh: vi.fn(),
      getModule: vi.fn(),
    });
  });

  it('exposes registry-driven sidebar items', () => {
    const { result } = renderHook(() => useSidebarNavigation(), { wrapper });
    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.path).toBe('/');
  });
});
