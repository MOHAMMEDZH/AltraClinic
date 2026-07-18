import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRegistryBranchEnabled } from './lib/static-branch-flags';
import {
  buildStaticBranchSnapshot,
} from './lib/branch-snapshot-builder';
import { STATIC_BRANCH_CATALOG } from './lib/static-branch-catalog';
import { defaultBranchReadModel } from './lib/branch-read-model';
import { clearBranchCache } from './lib/branch-cache';
import { clearActiveBranchSession } from './lib/branch-session';

afterEach(() => {
  vi.unstubAllEnvs();
  clearBranchCache();
  clearActiveBranchSession();
});

describe('branch rollback (Phase 36b)', () => {
  it('disables registry mode when VITE_USE_STATIC_BRANCH_ONLY=true', () => {
    vi.stubEnv('VITE_USE_STATIC_BRANCH_ONLY', 'true');
    expect(isRegistryBranchEnabled()).toBe(false);
  });

  it('disables registry mode when VITE_USE_STATIC_BRANCH_ONLY=1', () => {
    vi.stubEnv('VITE_USE_STATIC_BRANCH_ONLY', '1');
    expect(isRegistryBranchEnabled()).toBe(false);
  });

  it('enables registry mode by default', () => {
    vi.stubEnv('VITE_USE_STATIC_BRANCH_ONLY', '');
    expect(isRegistryBranchEnabled()).toBe(true);
  });

  it('static-only snapshot preserves existing configuration projection without registry', () => {
    vi.stubEnv('VITE_USE_STATIC_BRANCH_ONLY', 'true');
    const snapshot = buildStaticBranchSnapshot(
      STATIC_BRANCH_CATALOG,
      defaultBranchReadModel('tenant-1'),
      {
        roles: ['owner'],
        primaryBranchId: 'branch-1',
        branches: [{ id: 'branch-1', name: 'Main', nameAr: null, isActive: true }],
        sessionBranchId: null,
      },
      {
        tenantId: 'tenant-1',
        userId: 'user-1',
        rolesHash: 'owner',
        locale: 'en',
        activeBranchId: null,
        primaryBranchId: 'branch-1',
      },
      ['owner'],
      'static-only',
    );
    expect(snapshot.source).toBe('static-only');
    expect(snapshot.registryMode).toBe(false);
    expect(snapshot.entries.length).toBe(24);
    expect(snapshot.view.configuration.whiteLabel).toBeDefined();
  });
});
