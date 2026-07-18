import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearMfaChallenge,
  getMfaChallenge,
  isAccessTokenExpired,
  persistMfaChallenge,
} from '@/lib/auth-storage';

describe('auth-storage', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    });
  });

  afterEach(() => {
    clearMfaChallenge();
    vi.unstubAllGlobals();
  });

  it('detects expired access tokens with skew', () => {
    const obtainedAt = Date.now() - 16 * 60 * 1000;
    expect(isAccessTokenExpired(obtainedAt, 900)).toBe(true);
  });

  it('treats fresh tokens as valid', () => {
    expect(isAccessTokenExpired(Date.now(), 900)).toBe(false);
  });

  it('persists and reads MFA challenges', () => {
    persistMfaChallenge({
      mfaChallengeToken: 'challenge',
      tenantId: 'tenant-1',
      expiresAt: Date.now() + 60_000,
    });

    expect(getMfaChallenge()).toEqual({
      mfaChallengeToken: 'challenge',
      tenantId: 'tenant-1',
      expiresAt: expect.any(Number),
    });
  });

  it('clears expired MFA challenges', () => {
    persistMfaChallenge({
      mfaChallengeToken: 'challenge',
      tenantId: 'tenant-1',
      expiresAt: Date.now() - 1,
    });

    expect(getMfaChallenge()).toBeNull();
  });
});
