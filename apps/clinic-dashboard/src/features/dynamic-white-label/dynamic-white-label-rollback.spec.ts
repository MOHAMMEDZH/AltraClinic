/** @vitest-environment jsdom */
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import {
  DynamicWhiteLabelProvider,
  useWhiteLabel,
} from './context/DynamicWhiteLabelProvider';
import { buildStaticWhiteLabelSnapshot } from './lib/white-label-snapshot-builder';
import { STATIC_WHITE_LABEL_CATALOG } from './lib/static-white-label-catalog';
import { isRegistryWhiteLabelEnabled } from './lib/static-white-label-flags';
import { assertWhiteLabelSnapshotValid } from './lib/white-label-validation';

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

const IDENTITY = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  rolesHash: 'owner',
  locale: 'en-US',
  themePreference: 'light' as const,
  branchId: null,
};

const READ_MODEL = {
  tenantId: 'tenant-1',
  tenantName: 'Demo Clinic',
  customDomain: null,
  timezone: 'UTC',
  locale: 'en-US',
  branding: { primaryColor: '#2563eb' },
  clinicProfile: {},
  localizationSettings: {},
  enabledFeatures: ['customBranding', 'whiteLabel'],
};

const EMPTY_REGISTRY = {
  isLoading: true,
  isError: false,
  error: null,
  snapshot: {
    schemaVersion: '1.0',
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
  return createElement(DynamicWhiteLabelProvider, null, children);
}

describe('dynamic white label rollback', () => {
  beforeEach(() => {
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
    vi.unstubAllEnvs();
  });

  it('disables registry white label when VITE_USE_STATIC_WHITE_LABEL_ONLY=true', () => {
    vi.stubEnv('VITE_USE_STATIC_WHITE_LABEL_ONLY', 'true');
    expect(isRegistryWhiteLabelEnabled()).toBe(false);
  });

  it('enables registry white label by default', () => {
    vi.stubEnv('VITE_USE_STATIC_WHITE_LABEL_ONLY', undefined);
    expect(isRegistryWhiteLabelEnabled()).toBe(true);
  });

  it('bypasses registry path and builds static-only snapshot from STATIC_WHITE_LABEL_CATALOG', () => {
    vi.stubEnv('VITE_USE_STATIC_WHITE_LABEL_ONLY', 'true');
    expect(isRegistryWhiteLabelEnabled()).toBe(false);

    const snapshot = buildStaticWhiteLabelSnapshot(
      STATIC_WHITE_LABEL_CATALOG,
      READ_MODEL,
      IDENTITY,
      'light',
      'static-only',
    );

    expect(snapshot.source).toBe('static-only');
    expect(
      assertWhiteLabelSnapshotValid(snapshot),
      assertWhiteLabelSnapshotValid(snapshot).join('\n'),
    ).toEqual([]);
    expect(snapshot.entries.length).toBe(10);
  });

  it('keeps provider functional without registry modules when rollback is active', () => {
    vi.stubEnv('VITE_USE_STATIC_WHITE_LABEL_ONLY', 'true');
    vi.mocked(useOptionalModuleRegistry).mockReturnValue(EMPTY_REGISTRY as ReturnType<typeof useOptionalModuleRegistry>);

    const { result } = renderHook(() => useWhiteLabel(), { wrapper });

    expect(result.current.isRegistrySource).toBe(false);
    expect(result.current.source).toBe('static-only');
    expect(result.current.entries.length).toBe(10);
    expect(result.current.canCustomizeBranding).toBe(true);
    expect(result.current.registryStatus).toBe('disabled');
  });
});
