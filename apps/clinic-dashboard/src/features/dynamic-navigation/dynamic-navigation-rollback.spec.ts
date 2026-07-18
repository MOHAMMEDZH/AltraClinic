import { describe, expect, it, vi, afterEach } from 'vitest';
import { isRegistryNavigationEnabled } from './lib/static-nav-role-map';

describe('static nav rollback flag', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('disables registry navigation when VITE_USE_STATIC_NAV_ONLY=true', () => {
    vi.stubEnv('VITE_USE_STATIC_NAV_ONLY', 'true');
    expect(isRegistryNavigationEnabled()).toBe(false);
  });
});
