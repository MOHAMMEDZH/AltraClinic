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
  DynamicWhiteLabelProvider,
  useWhiteLabel,
} from './context/DynamicWhiteLabelProvider';
import { clearWhiteLabelCache } from './lib/white-label-cache';
import { buildStaticWhiteLabelSnapshot } from './lib/white-label-snapshot-builder';
import { STATIC_WHITE_LABEL_CATALOG } from './lib/static-white-label-catalog';

vi.mock('@/features/module-registry/context/ModuleRegistryProvider', () => ({
  useOptionalModuleRegistry: vi.fn(),
}));

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/app/providers/ThemeProvider', () => ({
  useTheme: vi.fn(),
}));

vi.mock('@booking/i18n/react', () => ({
  useI18n: vi.fn(),
}));

vi.mock('@/features/settings/hooks/useSettings', () => ({
  useTenantSettings: vi.fn(),
  useIdentityFeatures: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}));

import { useOptionalModuleRegistry } from '@/features/module-registry/context/ModuleRegistryProvider';
import { useAuth } from '@/app/providers/AuthProvider';
import { useTheme } from '@/app/providers/ThemeProvider';
import { useI18n } from '@booking/i18n/react';
import { useTenantSettings, useIdentityFeatures } from '@/features/settings/hooks/useSettings';

const ALL_ENABLED = Object.fromEntries(
  BUILTIN_MODULE_MANIFESTS.map((manifest) => [manifest.moduleId, 'enabled' as const]),
);

const REGISTRY_SNAPSHOT = {
  schemaVersion: '1.0',
  platformVersion: '1.0.0',
  generatedAt: '2026-07-14T00:00:00.000Z',
  catalogGeneration: 1,
  moduleCount: 43,
  dependencyOrder: [],
  entitlementVersion: 'active|w:true|m:true|lm:|mf:',
};

const READ_MODEL = {
  tenantId: 'tenant-1',
  tenantName: 'Demo Clinic',
  customDomain: null,
  timezone: 'UTC',
  locale: 'en-US',
  branding: { primaryColor: '#2563eb', accentColor: '#0ea5e9' },
  clinicProfile: {},
  localizationSettings: {},
  enabledFeatures: ['customBranding', 'whiteLabel'],
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
  return createElement(DynamicWhiteLabelProvider, null, children);
}

describe('DynamicWhiteLabelProvider integration', () => {
  const refresh = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.unstubAllEnvs();
    clearWhiteLabelCache();
    vi.mocked(useAuth).mockReturnValue({
      user: { roles: ['owner'], tenantId: 'tenant-1', userId: 'user-1' },
    } as ReturnType<typeof useAuth>);
    vi.mocked(useTheme).mockReturnValue({
      mode: 'light',
      isDark: false,
      setMode: vi.fn(),
      toggle: vi.fn(),
    });
    vi.mocked(useI18n).mockReturnValue({
      locale: 'en-US',
      setLocale: vi.fn(),
      t: (key: string) => key,
    } as ReturnType<typeof useI18n>);
    vi.mocked(useTenantSettings).mockReturnValue({
      data: {
        name: 'Demo Clinic',
        customDomain: null,
        timezone: 'UTC',
        locale: 'en-US',
        branding: READ_MODEL.branding,
        clinicProfile: {},
        localizationSettings: {},
      },
      isLoading: false,
    } as ReturnType<typeof useTenantSettings>);
    vi.mocked(useIdentityFeatures).mockReturnValue({
      data: { customBranding: true, whiteLabel: true },
      isLoading: false,
    } as ReturnType<typeof useIdentityFeatures>);
  });

  afterEach(() => {
    clearWhiteLabelCache();
    vi.unstubAllEnvs();
  });

  it('transitions loading → registry → refresh → restricted without widening capabilities', async () => {
    const ownerModules = buildModulesForRole(['owner']);
    const staticPermittedIds = new Set(
      buildStaticWhiteLabelSnapshot(
        STATIC_WHITE_LABEL_CATALOG,
        READ_MODEL,
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          rolesHash: 'owner',
          locale: 'en-US',
          themePreference: 'light',
          branchId: null,
        },
        'light',
        'static-fallback',
      ).entries.map((entry) => entry.surfaceId),
    );

    vi.mocked(useOptionalModuleRegistry).mockReturnValue({
      isLoading: true,
      isError: false,
      error: null,
      snapshot: REGISTRY_SNAPSHOT,
      modules: [],
      refresh,
      getModule: vi.fn(),
    } as ReturnType<typeof useOptionalModuleRegistry>);

    const { result, rerender } = renderHook(() => useWhiteLabel(), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isRegistrySource).toBe(true);
    expect(result.current.canCustomizeBranding).toBe(false);
    expect(result.current.entries).toEqual([]);

    vi.mocked(useOptionalModuleRegistry).mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      snapshot: REGISTRY_SNAPSHOT,
      modules: ownerModules,
      refresh,
      getModule: vi.fn(),
    } as ReturnType<typeof useOptionalModuleRegistry>);
    rerender();

    expect(result.current.isRegistrySource).toBe(true);
    expect(result.current.source).toBe('registry');
    expect(result.current.entries.length).toBeGreaterThan(0);
    const registryCount = result.current.entries.length;
    for (const entry of result.current.entries) {
      expect(staticPermittedIds.has(entry.surfaceId), entry.surfaceId).toBe(true);
    }
    expect(result.current.canCustomizeBranding).toBe(true);

    await act(async () => {
      await result.current.refresh();
    });
    expect(refresh).toHaveBeenCalled();
    rerender();
    expect(result.current.entries.length).toBe(registryCount);

    vi.mocked(useOptionalModuleRegistry).mockReturnValue({
      isLoading: true,
      isError: false,
      error: null,
      snapshot: REGISTRY_SNAPSHOT,
      modules: [],
      refresh,
      getModule: vi.fn(),
    } as ReturnType<typeof useOptionalModuleRegistry>);
    vi.mocked(useAuth).mockReturnValue({
      user: { roles: ['owner'], tenantId: 'tenant-1', userId: 'user-2' },
    } as ReturnType<typeof useAuth>);
    rerender();
    expect(result.current.canCustomizeBranding).toBe(false);
    expect(result.current.entries).toEqual([]);
  });
});
