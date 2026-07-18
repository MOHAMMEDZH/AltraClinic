import { afterEach, describe, expect, it, vi } from 'vitest';
import { loginRequest, verifyMfaRequest } from '@/lib/auth-api';
import { apiRequest } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/lib/auth-storage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth-storage')>('@/lib/auth-storage');
  return {
    ...actual,
    getDeviceTrustToken: vi.fn(() => null),
    getStoredTenantId: vi.fn(() => null),
  };
});

const mockedApiRequest = vi.mocked(apiRequest);

describe('auth-api', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('maps a successful login to an authenticated session', async () => {
    mockedApiRequest.mockResolvedValueOnce({
      accessToken: 'access',
      refreshToken: 'refresh',
      accessExpiresIn: 900,
      sessionId: 'session-1',
      tokenType: 'Bearer',
    });

    const result = await loginRequest({
      email: 'owner@demo.clinic',
      password: 'Owner123!',
      tenantId: 'tenant-1',
    });

    expect(result).toEqual({
      status: 'authenticated',
      session: expect.objectContaining({
        accessToken: 'access',
        refreshToken: 'refresh',
        accessExpiresIn: 900,
        sessionId: 'session-1',
        tenantId: 'tenant-1',
      }),
    });
  });

  it('maps MFA-required login responses', async () => {
    mockedApiRequest.mockResolvedValueOnce({
      mfaRequired: true,
      mfaChallengeToken: 'challenge-token',
      mfaExpiresIn: 120,
    });

    const result = await loginRequest({
      email: 'owner@demo.clinic',
      password: 'Owner123!',
      tenantId: 'tenant-1',
    });

    expect(result).toEqual({
      status: 'mfa_required',
      mfaChallengeToken: 'challenge-token',
      mfaExpiresIn: 120,
      tenantId: 'tenant-1',
    });
  });

  it('completes MFA verification into a session', async () => {
    mockedApiRequest.mockResolvedValueOnce({
      accessToken: 'access-after-mfa',
      refreshToken: 'refresh-after-mfa',
      accessExpiresIn: 900,
      sessionId: 'session-2',
      deviceTrustToken: 'device-trust-token',
      deviceTrustExpiresIn: 2_592_000,
    });

    const result = await verifyMfaRequest({
      mfaChallengeToken: 'challenge-token',
      code: '123456',
      tenantId: 'tenant-1',
      trustDevice: true,
    });

    expect(mockedApiRequest).toHaveBeenCalledWith('/auth/mfa/verify', {
      method: 'POST',
      body: {
        mfaChallengeToken: 'challenge-token',
        code: '123456',
        trustDevice: true,
      },
      tenantId: 'tenant-1',
    });
    expect(result.session).toMatchObject({
      accessToken: 'access-after-mfa',
      refreshToken: 'refresh-after-mfa',
      sessionId: 'session-2',
      tenantId: 'tenant-1',
    });
    expect(result.deviceTrust).toEqual({
      token: 'device-trust-token',
      expiresAt: expect.any(Number),
    });
  });
});
