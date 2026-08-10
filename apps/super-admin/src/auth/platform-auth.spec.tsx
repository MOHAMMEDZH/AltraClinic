import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { AppRouter } from '../app/router';
import { __resetPlatformAccessTokenForTests } from './PlatformAuthProvider';

const fetchMock = vi.fn();

function renderApp(initialPath = '/') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppRouter />
      </MemoryRouter>
    </AppProviders>,
  );
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  };
}

function assertNoBrowserStorageSecrets() {
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
}

describe('Step 07 — Super Admin MFA + session security', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    __resetPlatformAccessTokenForTests();
    localStorage.clear();
    sessionStorage.clear();
  });

  beforeEach(() => {
    vi.stubEnv('VITE_SUPER_ADMIN_APP_NAME', 'Super Admin');
    vi.stubEnv('VITE_SUPER_ADMIN_ENV', 'test');
    vi.stubEnv('VITE_API_BASE_URL', '/api');
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'Unauthorized' }));
    vi.stubGlobal('fetch', fetchMock);
  });

  it('routes a brand-new account through MFA enrollment after login, without touching browser storage', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const path = String(url);
      if (path.includes('/platform/auth/refresh')) {
        return jsonResponse(401, { message: 'Unauthorized' });
      }
      if (path.includes('/platform/auth/login') && init?.method === 'POST') {
        return jsonResponse(200, {
          kind: 'mfa_enrollment_required',
          preauthToken: 'preauth-enroll-1',
          expiresIn: 600,
          email: 'new-operator@example.com',
        });
      }
      if (path.includes('/platform/auth/mfa/enrollment/begin')) {
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.preauthToken).toBe('preauth-enroll-1');
        return jsonResponse(200, {
          otpauthUrl: 'otpauth://totp/Super%20Admin:new-operator@example.com?secret=ABCDEF234567&issuer=SuperAdmin',
          secret: 'ABCDEF234567',
          expiresIn: 600,
          principalType: 'platform',
        });
      }
      return jsonResponse(404, {});
    });

    renderApp('/login');
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new-operator@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'Set up two-factor authentication' }),
      ).toBeTruthy(),
    );
    await waitFor(() => expect(screen.getByText('ABCDEF234567')).toBeTruthy());
    expect(screen.getByLabelText('Setup URI')).toHaveProperty(
      'value',
      'otpauth://totp/Super%20Admin:new-operator@example.com?secret=ABCDEF234567&issuer=SuperAdmin',
    );
    assertNoBrowserStorageSecrets();
  });

  it('completes enrollment, shows one-time recovery codes, and only continues after acknowledgement', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const path = String(url);
      if (path.includes('/platform/auth/refresh')) {
        return jsonResponse(401, { message: 'Unauthorized' });
      }
      if (path.includes('/platform/auth/login') && init?.method === 'POST') {
        return jsonResponse(200, {
          kind: 'mfa_enrollment_required',
          preauthToken: 'preauth-enroll-2',
          expiresIn: 600,
          email: 'new-operator@example.com',
        });
      }
      if (path.includes('/platform/auth/mfa/enrollment/begin')) {
        return jsonResponse(200, {
          otpauthUrl: 'otpauth://totp/Super%20Admin:new-operator@example.com?secret=SECRET1&issuer=SuperAdmin',
          secret: 'SECRET1',
          expiresIn: 600,
          principalType: 'platform',
        });
      }
      if (path.includes('/platform/auth/mfa/enrollment/confirm')) {
        return jsonResponse(200, {
          accessToken: 'access-after-enroll',
          accessExpiresIn: 900,
          sessionId: 'sess-1',
          tokenType: 'Bearer',
          principalType: 'platform',
          recoveryCodes: ['RC-AAAA-1111', 'RC-BBBB-2222', 'RC-CCCC-3333'],
        });
      }
      if (path.includes('/platform/auth/me')) {
        return jsonResponse(200, {
          id: 'pu1',
          email: 'new-operator@example.com',
          displayName: null,
          principalType: 'platform',
          accountStatus: 'active',
          sessionId: 'sess-1',
          mfaEnabled: true,
        });
      }
      return jsonResponse(404, {});
    });

    renderApp('/login');
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new-operator@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByLabelText('6-digit code')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and enable' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Save your recovery codes' })).toBeTruthy(),
    );
    expect(screen.getByText('RC-AAAA-1111')).toBeTruthy();
    expect(screen.getByText('RC-BBBB-2222')).toBeTruthy();

    const continueButton = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);

    fireEvent.click(
      screen.getByRole('checkbox', { name: /I have saved these recovery codes/i }),
    );
    expect(continueButton.disabled).toBe(false);
    fireEvent.click(continueButton);

    // Default landing after full authentication is the Overview page (Step 09 shell).
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeTruthy(),
    );
    assertNoBrowserStorageSecrets();
  });

  it('routes a returning account through the MFA challenge page and signs in on success', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const path = String(url);
      if (path.includes('/platform/auth/refresh')) {
        return jsonResponse(401, { message: 'Unauthorized' });
      }
      if (path.includes('/platform/auth/login') && init?.method === 'POST') {
        return jsonResponse(200, {
          kind: 'mfa_challenge_required',
          preauthToken: 'preauth-challenge-1',
          expiresIn: 300,
        });
      }
      if (path.includes('/platform/auth/mfa/challenge')) {
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.preauthToken).toBe('preauth-challenge-1');
        expect(body.code).toBe('654321');
        return jsonResponse(200, {
          accessToken: 'access-after-challenge',
          accessExpiresIn: 900,
          sessionId: 'sess-2',
          tokenType: 'Bearer',
          principalType: 'platform',
        });
      }
      if (path.includes('/platform/auth/me')) {
        return jsonResponse(200, {
          id: 'pu2',
          email: 'ops@example.com',
          displayName: 'Ops',
          principalType: 'platform',
          accountStatus: 'active',
          sessionId: 'sess-2',
          mfaEnabled: true,
        });
      }
      return jsonResponse(404, {});
    });

    renderApp('/login');
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ops@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'Two-factor verification' }),
      ).toBeTruthy(),
    );

    fireEvent.change(screen.getByLabelText('Authentication code'), {
      target: { value: '654321' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    // Default landing after full authentication is the Overview page (Step 09 shell).
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeTruthy(),
    );
    assertNoBrowserStorageSecrets();
  });

  it('redirects an in-progress MFA session away from ordinary protected routes back to the MFA step', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const path = String(url);
      if (path.includes('/platform/auth/refresh')) {
        return jsonResponse(401, { message: 'Unauthorized' });
      }
      if (path.includes('/platform/auth/login') && init?.method === 'POST') {
        return jsonResponse(200, {
          kind: 'mfa_challenge_required',
          preauthToken: 'preauth-challenge-2',
          expiresIn: 300,
        });
      }
      return jsonResponse(404, {});
    });

    renderApp('/login');
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ops@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'Two-factor verification' }),
      ).toBeTruthy(),
    );

    fireEvent.click(screen.getByRole('link', { name: 'Super Admin' }));

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 1, name: 'Two-factor verification' }),
      ).toBeTruthy(),
    );
  });

  it('lists sessions, revokes one directly, and prompts for step-up before revoking others', async () => {
    let revokeOthersAttempts = 0;
    let sessionsCallCount = 0;

    function sessionsPayload() {
      return [
        {
          sessionId: 'sess-current',
          createdAt: '2026-07-01T10:00:00.000Z',
          lastInteractiveActivityAt: '2026-07-21T09:00:00.000Z',
          idleExpiresAt: '2026-07-21T09:30:00.000Z',
          absoluteExpiresAt: '2026-08-01T10:00:00.000Z',
          deviceSummary: 'Chrome on Windows',
          deviceCategory: 'desktop',
          deviceLabel: 'This laptop',
          assuranceLevel: 'mfa',
          authMethod: 'totp',
          isCurrent: true,
          isStepUpFresh: false,
        },
        {
          sessionId: 'sess-other',
          createdAt: '2026-06-01T10:00:00.000Z',
          lastInteractiveActivityAt: '2026-07-20T09:00:00.000Z',
          idleExpiresAt: '2026-07-20T09:30:00.000Z',
          absoluteExpiresAt: '2026-08-01T10:00:00.000Z',
          deviceSummary: 'Safari on macOS',
          deviceCategory: 'desktop',
          deviceLabel: 'Other device',
          assuranceLevel: 'mfa',
          authMethod: 'recovery',
          isCurrent: false,
          isStepUpFresh: false,
        },
      ];
    }

    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const path = String(url);
      const method = init?.method ?? 'GET';

      if (path.includes('/platform/auth/refresh') && method === 'POST') {
        return jsonResponse(200, {
          accessToken: 'access-sessions',
          accessExpiresIn: 900,
          sessionId: 'sess-current',
          tokenType: 'Bearer',
          principalType: 'platform',
        });
      }
      if (path.includes('/platform/auth/me')) {
        return jsonResponse(200, {
          id: 'pu3',
          email: 'ops@example.com',
          displayName: 'Ops',
          principalType: 'platform',
          accountStatus: 'active',
          sessionId: 'sess-current',
          mfaEnabled: true,
        });
      }
      if (path.endsWith('/platform/auth/sessions') && method === 'GET') {
        sessionsCallCount += 1;
        return jsonResponse(200, sessionsPayload());
      }
      if (path.includes('/platform/auth/sessions/sess-other/revoke') && method === 'POST') {
        return jsonResponse(204, undefined);
      }
      if (path.includes('/platform/auth/sessions/revoke-others') && method === 'POST') {
        revokeOthersAttempts += 1;
        if (revokeOthersAttempts === 1) {
          return jsonResponse(403, {
            code: 'PLATFORM_STEP_UP_REQUIRED',
            message: 'Step-up verification is required for this action.',
          });
        }
        return jsonResponse(200, { revoked: 1 });
      }
      if (path.includes('/platform/auth/step-up/verify') && method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.code).toBe('999111');
        return jsonResponse(200, { stepUpVerifiedUntil: '2026-07-21T10:05:00.000Z' });
      }
      return jsonResponse(404, {});
    });

    renderApp('/security');

    await waitFor(() => expect(screen.getByText('Other device')).toBeTruthy());
    expect(screen.getByText('This laptop')).toBeTruthy();
    expect(screen.getByText('Chrome on Windows')).toBeTruthy();
    expect(screen.getByText('Safari on macOS')).toBeTruthy();
    expect(screen.queryByText('Mozilla/5.0')).toBeNull();
    expect(screen.getByText('Current session')).toBeTruthy();
    expect(screen.getByText('Signed in elsewhere')).toBeTruthy();
    expect(sessionsCallCount).toBe(1);

    const rows = screen.getAllByRole('row');
    const otherRow = rows.find((row) => within(row).queryByText('Other device'));
    expect(otherRow).toBeTruthy();

    // Revoking a single session is now governed by a confirmation dialog —
    // clicking "Revoke" opens the dialog and makes no API call yet.
    fireEvent.click(within(otherRow!).getByRole('button', { name: 'Revoke' }));
    const revokeSessionDialog = await screen.findByRole('dialog', { name: 'Revoke this session?' });
    expect(sessionsCallCount).toBe(1);

    fireEvent.click(within(revokeSessionDialog).getByRole('button', { name: 'Revoke session' }));

    await waitFor(() => expect(sessionsCallCount).toBe(2));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Revoke this session?' })).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Revoke all other sessions' }));
    const revokeOthersDialog = await screen.findByRole('dialog', { name: 'Revoke all other sessions?' });
    expect(revokeOthersAttempts).toBe(0);

    fireEvent.click(within(revokeOthersDialog).getByRole('button', { name: 'Revoke other sessions' }));

    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: /Confirm it.s you/i })).toBeTruthy(),
    );

    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '999111' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(revokeOthersAttempts).toBe(2));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /Confirm it.s you/i })).toBeNull(),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Revoke all other sessions?' })).toBeNull(),
    );
    assertNoBrowserStorageSecrets();
  });
});
