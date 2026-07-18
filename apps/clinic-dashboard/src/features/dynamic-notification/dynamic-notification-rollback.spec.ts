/** @vitest-environment jsdom */
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { DynamicNotificationProvider, useNotification } from './context/DynamicNotificationProvider';
import { buildStaticNotificationSnapshot } from './lib/notification-snapshot-builder';
import { STATIC_NOTIFICATION_CATALOG } from './lib/static-notification-catalog';
import { isRegistryNotificationEnabled } from './lib/notification-flags';
import { assertNotificationSnapshotValid } from './lib/notification-validation';

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

vi.mock('@/features/dynamic-white-label/context/DynamicWhiteLabelProvider', () => ({
  useOptionalWhiteLabel: vi.fn(() => null),
}));

vi.mock('@booking/i18n/react', () => ({
  useI18n: vi.fn(() => ({ locale: 'en', t: (key: string) => key })),
}));

import { useModuleRegistry } from '@/features/module-registry/context/ModuleRegistryProvider';
import { useAuth } from '@/app/providers/AuthProvider';

const IDENTITY = { tenantId: 'tenant-1', userId: 'user-1', rolesHash: 'owner', branchId: 'branch-1', locale: 'en' };

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
  return createElement(DynamicNotificationProvider, null, children);
}

describe('dynamic notification rollback', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { roles: ['owner'], tenantId: 'tenant-1', userId: 'user-1' },
    } as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('disables registry notification when VITE_USE_STATIC_NOTIFICATION_ONLY=true', () => {
    vi.stubEnv('VITE_USE_STATIC_NOTIFICATION_ONLY', 'true');
    expect(isRegistryNotificationEnabled()).toBe(false);
  });

  it('disables registry notification when VITE_USE_STATIC_NOTIFICATION_ONLY=1', () => {
    vi.stubEnv('VITE_USE_STATIC_NOTIFICATION_ONLY', '1');
    expect(isRegistryNotificationEnabled()).toBe(false);
  });

  it('enables registry notification by default', () => {
    vi.stubEnv('VITE_USE_STATIC_NOTIFICATION_ONLY', undefined);
    expect(isRegistryNotificationEnabled()).toBe(true);
  });

  it('bypasses registry path and builds static-only snapshot from STATIC_NOTIFICATION_CATALOG', () => {
    vi.stubEnv('VITE_USE_STATIC_NOTIFICATION_ONLY', 'true');
    expect(isRegistryNotificationEnabled()).toBe(false);

    const snapshot = buildStaticNotificationSnapshot(['owner'], STATIC_NOTIFICATION_CATALOG, IDENTITY, null, 'static-only');

    expect(snapshot.source).toBe('static-only');
    expect(
      assertNotificationSnapshotValid(snapshot),
      assertNotificationSnapshotValid(snapshot).join('\n'),
    ).toEqual([]);
    expect(snapshot.channels.length).toBeGreaterThan(0);
    expect(snapshot.surfaces.length).toBeGreaterThanOrEqual(1);
  });

  it('keeps provider functional without registry modules when rollback is active', () => {
    vi.stubEnv('VITE_USE_STATIC_NOTIFICATION_ONLY', 'true');
    vi.mocked(useModuleRegistry).mockReturnValue(EMPTY_REGISTRY);

    const { result } = renderHook(() => useNotification(), { wrapper });

    expect(result.current.isRegistrySource).toBe(false);
    expect(result.current.source).toBe('static-only');
    expect(result.current.channels.length).toBeGreaterThan(0);
    expect(result.current.canViewNotificationCenter).toBe(true);
    expect(result.current.registryStatus).toBe('loading');
  });

  it('never claims delivery works during rollback (canUse* remain configuration-only)', () => {
    vi.stubEnv('VITE_USE_STATIC_NOTIFICATION_ONLY', 'true');
    vi.mocked(useModuleRegistry).mockReturnValue(EMPTY_REGISTRY);

    const { result } = renderHook(() => useNotification(), { wrapper });
    expect(result.current.canUseWebhook).toBe(false);
  });
});
