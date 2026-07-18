import { describe, expect, it, vi } from 'vitest';
import { isRegistryRoutingEnabled } from './lib/static-route-flags';

describe('dynamic routing rollback', () => {
  it('restores static routing when VITE_USE_STATIC_ROUTES_ONLY=true', () => {
    vi.stubEnv('VITE_USE_STATIC_ROUTES_ONLY', 'true');
    expect(isRegistryRoutingEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });

  it('uses registry routing by default', () => {
    vi.stubEnv('VITE_USE_STATIC_ROUTES_ONLY', 'false');
    expect(isRegistryRoutingEnabled()).toBe(true);
    vi.unstubAllEnvs();
  });
});
