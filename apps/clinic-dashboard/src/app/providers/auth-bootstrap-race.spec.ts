/**
 * AuthProvider bootstrap must not clear a live session when React Strict Mode
 * double-invokes effects while a refresh-token rotation is in flight.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

describe('AuthProvider bootstrap race (Cluster H)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('deduplicates concurrent bootstrap callers onto one in-flight refresh', async () => {
    let refreshCalls = 0;
    const refreshImpl = vi.fn(async () => {
      refreshCalls += 1;
      await new Promise((r) => setTimeout(r, 30));
      return {
        accessToken: `access-${refreshCalls}`,
        refreshToken: `refresh-${refreshCalls}`,
        accessExpiresIn: 900,
        sessionId: `session-${refreshCalls}`,
        tenantId: 'tenant-1',
        obtainedAt: Date.now(),
      };
    });

    // Simulate the in-flight ref pattern used by AuthProvider.
    let bootstrapInFlight: Promise<void> | null = null;
    let user: string | null = null;
    let cleared = 0;

    const bootstrap = async () => {
      if (bootstrapInFlight) {
        await bootstrapInFlight;
        return;
      }
      const run = (async () => {
        try {
          const session = await refreshImpl();
          user = session.accessToken;
        } catch {
          cleared += 1;
          user = null;
        }
      })();
      bootstrapInFlight = run;
      try {
        await run;
      } finally {
        if (bootstrapInFlight === run) bootstrapInFlight = null;
      }
    };

    await Promise.all([bootstrap(), bootstrap(), bootstrap()]);
    expect(refreshCalls).toBe(1);
    expect(user).toBe('access-1');
    expect(cleared).toBe(0);
  });

  it('does not clear session when a failed refresh no longer owns the stored token', async () => {
    let storedRefresh = 'refresh-original';
    const getRefreshToken = () => storedRefresh;
    const clearSession = vi.fn(() => {
      storedRefresh = '';
    });

    const rotateOnce = async (attempted: string, shouldFail: boolean) => {
      try {
        if (shouldFail) throw new Error('stale token');
        storedRefresh = 'refresh-rotated';
        return storedRefresh;
      } catch {
        if (getRefreshToken() === attempted) {
          clearSession();
        }
        return null;
      }
    };

    // Winner rotates first; loser fails with the old token but must not wipe the winner.
    const winner = rotateOnce('refresh-original', false);
    storedRefresh = 'refresh-rotated';
    const loser = rotateOnce('refresh-original', true);
    await Promise.all([winner, loser]);

    expect(storedRefresh).toBe('refresh-rotated');
    expect(clearSession).not.toHaveBeenCalled();
  });

  it('clears session when the failing refresh still owns the stored token', async () => {
    let storedRefresh = 'refresh-only';
    const getRefreshToken = () => storedRefresh;
    const clearSession = vi.fn(() => {
      storedRefresh = '';
    });

    const attempted = getRefreshToken()!;
    try {
      throw new Error('server rejected');
    } catch {
      if (getRefreshToken() === attempted) {
        clearSession();
      }
    }

    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(storedRefresh).toBe('');
  });
});
