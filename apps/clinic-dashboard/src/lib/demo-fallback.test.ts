import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  canShowDemoOverview,
  fetchWithDemoFallback,
  isDemoFallbackEnabled,
  shouldUseDemoFallback,
} from './demo-fallback';

describe('demo-fallback', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_DEMO_FALLBACK', '');
    vi.stubEnv('PROD', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('isDemoFallbackEnabled is false by default', () => {
    expect(isDemoFallbackEnabled()).toBe(false);
  });

  it('isDemoFallbackEnabled is true when flag is set', () => {
    vi.stubEnv('VITE_ENABLE_DEMO_FALLBACK', 'true');
    expect(isDemoFallbackEnabled()).toBe(true);
  });

  it('shouldUseDemoFallback rejects online failures even when flag enabled', () => {
    vi.stubEnv('VITE_ENABLE_DEMO_FALLBACK', 'true');
    expect(shouldUseDemoFallback(new Error('network'), true)).toBe(false);
  });

  it('shouldUseDemoFallback allows offline demo when flag enabled', () => {
    vi.stubEnv('VITE_ENABLE_DEMO_FALLBACK', 'true');
    expect(shouldUseDemoFallback(new Error('network'), false)).toBe(true);
  });

  it('shouldUseDemoFallback rejects auth errors offline', () => {
    vi.stubEnv('VITE_ENABLE_DEMO_FALLBACK', 'true');
    expect(shouldUseDemoFallback({ status: 401 }, false)).toBe(false);
    expect(shouldUseDemoFallback({ status: 403 }, false)).toBe(false);
    expect(shouldUseDemoFallback({ status: 404 }, false)).toBe(false);
  });

  it('fetchWithDemoFallback rethrows in production when online', async () => {
    await expect(
      fetchWithDemoFallback(
        async () => {
          throw new Error('api down');
        },
        () => ({ demo: true }),
        true,
      ),
    ).rejects.toThrow('api down');
  });

  it('fetchWithDemoFallback returns demo only when flag enabled and offline', async () => {
    vi.stubEnv('VITE_ENABLE_DEMO_FALLBACK', 'true');
    const result = await fetchWithDemoFallback(
      async () => {
        throw new Error('offline');
      },
      () => ({ demo: true }),
      false,
    );
    expect(result).toEqual({ demo: true });
  });

  it('canShowDemoOverview is false in production on API error', () => {
    expect(canShowDemoOverview(true, true, false)).toBe(false);
  });

  it('canShowDemoOverview allows offline demo when flag enabled', () => {
    vi.stubEnv('VITE_ENABLE_DEMO_FALLBACK', 'true');
    expect(canShowDemoOverview(false, false, false)).toBe(true);
  });
});
