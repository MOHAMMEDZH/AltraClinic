import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { AppRouter } from '../app/router';
import { __resetPlatformAccessTokenForTests } from '../auth/PlatformAuthProvider';

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}

function renderApp(initialPath: string) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppRouter />
      </MemoryRouter>
    </AppProviders>,
  );
}

function userDetail(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'u2',
    email: 'operator@example.com',
    displayName: 'Operator',
    status: 'active',
    isActive: true,
    mfaEnabled: true,
    mfaConfirmedAt: '2026-01-01T00:00:00Z',
    lastLoginAt: '2026-07-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    suspendedAt: null,
    suspendedReason: null,
    authzRevision: 1,
    activeSessionCount: 1,
    roleKeys: ['auditor'],
    ...overrides,
  };
}

function counters() {
  return { suspend: 0, reactivate: 0, removeRole: 0, revokeSession: 0, revokeAll: 0 };
}

function baseHandlers(state: {
  counts: ReturnType<typeof counters>;
  permissions: string[];
  detail: ReturnType<typeof userDetail>;
}) {
  return async (url: string, init?: RequestInit) => {
    const path = String(url);
    const method = init?.method ?? 'GET';

    if (path.includes('/platform/auth/refresh') && method === 'POST') {
      return jsonResponse(200, {
        accessToken: 'access-1',
        accessExpiresIn: 900,
        sessionId: 's1',
        tokenType: 'Bearer',
        principalType: 'platform',
      });
    }
    if (path.includes('/platform/auth/me')) {
      return jsonResponse(200, {
        id: 'pu1',
        email: 'admin@example.com',
        displayName: 'Admin',
        principalType: 'platform',
        accountStatus: 'active',
        status: 'active',
        sessionId: 's1',
        mfaEnabled: true,
        roleKeys: [],
        permissions: state.permissions,
        authzRevision: 1,
      });
    }
    if (path.includes('/platform/users/u2/sessions') && method === 'GET') {
      return jsonResponse(200, [
        {
          sessionId: 'admin-sess-1',
          lastInteractiveActivityAt: '2026-07-20T00:00:00Z',
          deviceSummary: 'Chrome on Linux',
        },
      ]);
    }
    if (path.includes('/platform/users/u2') && method === 'GET' && !path.includes('/sessions')) {
      return jsonResponse(200, state.detail);
    }
    if (path.includes('/platform/roles') && method === 'GET') {
      return jsonResponse(200, [{ key: 'auditor', displayName: 'Auditor', permissionKeys: [] }]);
    }
    if (path.includes('/platform/users/u2/suspend') && method === 'POST') {
      state.counts.suspend += 1;
      return jsonResponse(200, { ok: true });
    }
    if (path.includes('/platform/users/u2/reactivate') && method === 'POST') {
      state.counts.reactivate += 1;
      return jsonResponse(200, { ok: true });
    }
    if (path.includes('/platform/users/u2/roles/auditor') && method === 'DELETE') {
      state.counts.removeRole += 1;
      return jsonResponse(200, { ok: true });
    }
    if (path.includes('/platform/users/u2/sessions/admin-sess-1/revoke') && method === 'POST') {
      state.counts.revokeSession += 1;
      return jsonResponse(200, { ok: true });
    }
    if (path.includes('/platform/users/u2/sessions/revoke-all') && method === 'POST') {
      state.counts.revokeAll += 1;
      return jsonResponse(200, { ok: true });
    }
    return jsonResponse(404, {});
  };
}

describe('Platform user lifecycle — high-impact confirmation governance', () => {
  afterEach(() => {
    cleanup();
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(404, {})));
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    __resetPlatformAccessTokenForTests();
  });

  beforeEach(() => {
    vi.stubEnv('VITE_SUPER_ADMIN_APP_NAME', 'Super Admin');
    vi.stubEnv('VITE_SUPER_ADMIN_ENV', 'test');
    vi.stubEnv('VITE_API_BASE_URL', '/api');
    fetchMock.mockReset();
  });

  it('Suspend opens a confirmation dialog and requires a reason before the API is called', async () => {
    const state = {
      counts: counters(),
      permissions: ['platform-user.view', 'platform-user.suspend'],
      detail: userDetail({ status: 'active' }),
    };
    fetchMock.mockReset();
    fetchMock.mockImplementation(baseHandlers(state));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/platform-users/u2');
    await waitFor(
      () => {
        expect(screen.queryByText(/Loading user/i)).toBeNull();
        expect(screen.getByRole('button', { name: 'Suspend' })).toBeTruthy();
      },
      { timeout: 15_000 },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));
    const dialog = await screen.findByRole('dialog', { name: 'Suspend platform user?' });
    expect(state.counts.suspend).toBe(0);

    const confirmButton = within(dialog).getByRole('button', { name: 'Suspend user' }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true); // reason required, empty so far

    fireEvent.click(confirmButton);
    expect(state.counts.suspend).toBe(0); // still blocked — no reason entered

    fireEvent.change(within(dialog).getByLabelText(/Suspension reason/), {
      target: { value: 'Policy violation' },
    });
    expect(confirmButton.disabled).toBe(false);

    fireEvent.click(confirmButton);
    await waitFor(() => expect(state.counts.suspend).toBe(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Cancelling the suspend dialog never calls the API', async () => {
    const state = {
      counts: counters(),
      permissions: ['platform-user.view', 'platform-user.suspend'],
      detail: userDetail({ status: 'active' }),
    };
    fetchMock.mockReset();
    fetchMock.mockImplementation(baseHandlers(state));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/platform-users/u2');
    await waitFor(
      () => {
        expect(screen.queryByText(/Loading user/i)).toBeNull();
        expect(screen.getByRole('button', { name: 'Suspend' })).toBeTruthy();
      },
      { timeout: 15_000 },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));

    const dialog = await screen.findByRole('dialog', { name: 'Suspend platform user?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(state.counts.suspend).toBe(0);
  });

  it('Reactivate opens a confirmation dialog requiring a reason', async () => {
    const state = {
      counts: counters(),
      permissions: ['platform-user.view', 'platform-user.activate'],
      detail: userDetail({ status: 'suspended' }),
    };
    fetchMock.mockReset();
    fetchMock.mockImplementation(baseHandlers(state));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/platform-users/u2');
    await waitFor(
      () => {
        expect(screen.queryByText(/Loading user/i)).toBeNull();
        expect(screen.getByRole('button', { name: 'Reactivate' })).toBeTruthy();
      },
      { timeout: 15_000 },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reactivate' }));

    const dialog = await screen.findByRole('dialog', { name: 'Reactivate platform user?' });
    fireEvent.change(within(dialog).getByLabelText(/Reactivation reason/), {
      target: { value: 'Verified identity' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reactivate user' }));

    await waitFor(() => expect(state.counts.reactivate).toBe(1));
  });

  it('Remove role opens a confirmation dialog with no reason required', async () => {
    const state = {
      counts: counters(),
      permissions: ['platform-user.view', 'platform-user.role.remove'],
      detail: userDetail(),
    };
    fetchMock.mockReset();
    fetchMock.mockImplementation(baseHandlers(state));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/platform-users/u2');
    await waitFor(
      () => {
        expect(screen.queryByText(/Loading user/i)).toBeNull();
        expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
      },
      { timeout: 15_000 },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    const dialog = await screen.findByRole('dialog', { name: 'Remove role?' });
    expect(state.counts.removeRole).toBe(0);
    // No reason field for role removal — the API doesn't accept one.
    expect(within(dialog).queryByLabelText(/reason/i)).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove role' }));
    await waitFor(() => expect(state.counts.removeRole).toBe(1));
  });

  it('Admin session revoke collects a reason in the dialog (never hardcoded)', async () => {
    const state = {
      counts: counters(),
      permissions: ['platform-user.view', 'platform-user.session.revoke'],
      detail: userDetail(),
    };
    fetchMock.mockReset();
    fetchMock.mockImplementation(baseHandlers(state));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/platform-users/u2');
    await waitFor(
      () => {
        expect(screen.queryByText(/Loading user/i)).toBeNull();
        expect(screen.getByText('Chrome on Linux')).toBeTruthy();
      },
      { timeout: 15_000 },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    const dialog = await screen.findByRole('dialog', { name: "Revoke this user\u2019s session?" });
    const confirmButton = within(dialog).getByRole('button', { name: 'Revoke session' }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(true);

    fireEvent.change(within(dialog).getByLabelText(/Reason for revoking this session/), {
      target: { value: 'Suspicious device' },
    });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(state.counts.revokeSession).toBe(1));

    const [, requestInit] = fetchMock.mock.calls.find(([callUrl]: [string]) =>
      String(callUrl).includes('/sessions/admin-sess-1/revoke'),
    ) as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toEqual({ reason: 'Suspicious device' });
  });

  it('shows a "Revoke all sessions" action gated on platform-user.session.revoke, requiring a reason', async () => {
    const state = {
      counts: counters(),
      permissions: ['platform-user.view', 'platform-user.session.revoke'],
      detail: userDetail(),
    };
    fetchMock.mockReset();
    fetchMock.mockImplementation(baseHandlers(state));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/platform-users/u2');
    await waitFor(
      () => {
        expect(screen.queryByText(/Loading user/i)).toBeNull();
        expect(screen.getByRole('button', { name: 'Revoke all sessions' })).toBeTruthy();
      },
      { timeout: 15_000 },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Revoke all sessions' }));

    const dialog = await screen.findByRole('dialog', { name: 'Revoke all sessions for this user?' });
    fireEvent.change(within(dialog).getByLabelText(/Reason for revoking all sessions/), {
      target: { value: 'Offboarding' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke all sessions' }));

    await waitFor(() => expect(state.counts.revokeAll).toBe(1));
  });

  it('does not render lifecycle/session/role-removal buttons without the matching permission', async () => {
    const state = {
      counts: counters(),
      permissions: ['platform-user.view'],
      detail: userDetail(),
    };
    fetchMock.mockReset();
    fetchMock.mockImplementation(baseHandlers(state));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/platform-users/u2');
    await waitFor(
      () => {
        expect(screen.queryByText(/Loading user/i)).toBeNull();
        expect(screen.getByText('operator@example.com')).toBeTruthy();
      },
      { timeout: 15_000 },
    );
    expect(screen.queryByRole('button', { name: 'Suspend' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Revoke all sessions' })).toBeNull();
  });
});
