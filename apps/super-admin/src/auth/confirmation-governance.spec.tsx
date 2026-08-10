import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { AppRouter } from '../app/router';
import { __resetPlatformAccessTokenForTests } from './PlatformAuthProvider';

/**
 * Governance regression coverage for the "high-impact action" confirmation
 * flow (Release 47 Step 09 correction): destructive personal-session
 * actions must never call their business API before an explicit confirm,
 * must never double-submit, and a cancelled step-up must never fall through
 * to the business API either.
 */

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}

function renderApp(initialPath = '/security') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppRouter />
      </MemoryRouter>
    </AppProviders>,
  );
}

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

function baseHandlers(counters: { revokeSession: number; revokeOthers: number }) {
  return async (url: string, init?: RequestInit) => {
    const path = String(url);
    const method = init?.method ?? 'GET';

    if (path.includes('/platform/auth/refresh') && method === 'POST') {
      return jsonResponse(200, {
        accessToken: 'access-1',
        accessExpiresIn: 900,
        sessionId: 'sess-current',
        tokenType: 'Bearer',
        principalType: 'platform',
      });
    }
    if (path.includes('/platform/auth/me')) {
      return jsonResponse(200, {
        id: 'pu1',
        email: 'ops@example.com',
        displayName: 'Ops',
        principalType: 'platform',
        accountStatus: 'active',
        status: 'active',
        sessionId: 'sess-current',
        mfaEnabled: true,
        roleKeys: [],
        permissions: [],
        authzRevision: 1,
      });
    }
    if (path.endsWith('/platform/auth/sessions') && method === 'GET') {
      return jsonResponse(200, sessionsPayload());
    }
    if (path.includes('/platform/auth/sessions/sess-other/revoke') && method === 'POST') {
      counters.revokeSession += 1;
      return jsonResponse(204, undefined);
    }
    if (path.includes('/platform/auth/sessions/revoke-others') && method === 'POST') {
      counters.revokeOthers += 1;
      // Always require step-up for this scenario, so we can assert cancel never calls through.
      return jsonResponse(403, { code: 'PLATFORM_STEP_UP_REQUIRED', message: 'Step-up verification is required.' });
    }
    return jsonResponse(404, {});
  };
}

describe('High-impact confirmation governance — personal session revoke', () => {
  let counters: { revokeSession: number; revokeOthers: number };

  beforeEach(() => {
    vi.stubEnv('VITE_SUPER_ADMIN_APP_NAME', 'Super Admin');
    vi.stubEnv('VITE_SUPER_ADMIN_ENV', 'test');
    vi.stubEnv('VITE_API_BASE_URL', '/api');
    counters = { revokeSession: 0, revokeOthers: 0 };
    fetchMock.mockReset();
    fetchMock.mockImplementation(baseHandlers(counters));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    __resetPlatformAccessTokenForTests();
  });

  it('clicking Revoke only opens the confirmation dialog — no API call yet', async () => {
    renderApp('/security');
    await waitFor(() => expect(screen.getByText('Other device')).toBeTruthy());

    const rows = screen.getAllByRole('row');
    const otherRow = rows.find((row) => within(row).queryByText('Other device'));
    fireEvent.click(within(otherRow!).getByRole('button', { name: 'Revoke' }));

    await screen.findByRole('dialog', { name: 'Revoke this session?' });
    expect(counters.revokeSession).toBe(0);
  });

  it('Cancel closes the dialog without calling the API', async () => {
    renderApp('/security');
    await waitFor(() => expect(screen.getByText('Other device')).toBeTruthy());

    const rows = screen.getAllByRole('row');
    const otherRow = rows.find((row) => within(row).queryByText('Other device'));
    fireEvent.click(within(otherRow!).getByRole('button', { name: 'Revoke' }));

    const dialog = await screen.findByRole('dialog', { name: 'Revoke this session?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(counters.revokeSession).toBe(0);
  });

  it('confirming calls the revoke API exactly once', async () => {
    renderApp('/security');
    await waitFor(() => expect(screen.getByText('Other device')).toBeTruthy());

    const rows = screen.getAllByRole('row');
    const otherRow = rows.find((row) => within(row).queryByText('Other device'));
    fireEvent.click(within(otherRow!).getByRole('button', { name: 'Revoke' }));

    const dialog = await screen.findByRole('dialog', { name: 'Revoke this session?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke session' }));

    await waitFor(() => expect(counters.revokeSession).toBe(1));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Revoke this session?' })).toBeNull());
  });

  it('a fast double-click on Confirm only executes the action once', async () => {
    renderApp('/security');
    await waitFor(() => expect(screen.getByText('Other device')).toBeTruthy());

    const rows = screen.getAllByRole('row');
    const otherRow = rows.find((row) => within(row).queryByText('Other device'));
    fireEvent.click(within(otherRow!).getByRole('button', { name: 'Revoke' }));

    const dialog = await screen.findByRole('dialog', { name: 'Revoke this session?' });
    const confirmButton = within(dialog).getByRole('button', { name: 'Revoke session' });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Revoke this session?' })).toBeNull());
    expect(counters.revokeSession).toBe(1);
  });

  it('cancelling step-up cancels the whole action — the business API is never called', async () => {
    renderApp('/security');
    await waitFor(() => expect(screen.getByText('Other device')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Revoke all other sessions' }));
    const dialog = await screen.findByRole('dialog', { name: 'Revoke all other sessions?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke other sessions' }));

    const stepUpDialog = await screen.findByRole('dialog', { name: /Confirm it.s you/i });
    expect(counters.revokeOthers).toBe(1); // the one attempt that triggered step-up

    fireEvent.click(within(stepUpDialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // No further attempt — cancelling step-up never falls through to a retry.
    expect(counters.revokeOthers).toBe(1);
  });
});
