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

function baseHandlers(counts: { approve: number; reject: number }) {
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
        email: 'reviewer@example.com',
        displayName: 'Reviewer',
        principalType: 'platform',
        accountStatus: 'active',
        status: 'active',
        sessionId: 's1',
        mfaEnabled: true,
        roleKeys: [],
        permissions: ['platform-user.mfa.reset-approve'],
        authzRevision: 1,
      });
    }
    if (path.includes('/platform/mfa-reset-requests/req-1/approve') && method === 'POST') {
      counts.approve += 1;
      return jsonResponse(200, { ok: true });
    }
    if (path.includes('/platform/mfa-reset-requests/req-1/reject') && method === 'POST') {
      counts.reject += 1;
      return jsonResponse(200, { ok: true });
    }
    return jsonResponse(404, {});
  };
}

describe('MFA reset decision — high-impact confirmation governance', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    __resetPlatformAccessTokenForTests();
  });

  beforeEach(() => {
    vi.stubEnv('VITE_SUPER_ADMIN_APP_NAME', 'Super Admin');
    vi.stubEnv('VITE_SUPER_ADMIN_ENV', 'test');
    vi.stubEnv('VITE_API_BASE_URL', '/api');
  });

  it('Approve does not decide on first click — it opens a confirmation dialog', async () => {
    const counts = { approve: 0, reject: 0 };
    fetchMock.mockReset();
    fetchMock.mockImplementation(baseHandlers(counts));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/mfa-reset-requests/req-1');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve reset' })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Approve reset' }));
    await screen.findByRole('dialog', { name: 'Approve MFA reset request?' });
    expect(counts.approve).toBe(0);
  });

  it('Approve reason is optional — confirming with no reason still succeeds', async () => {
    const counts = { approve: 0, reject: 0 };
    fetchMock.mockReset();
    fetchMock.mockImplementation(baseHandlers(counts));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/mfa-reset-requests/req-1');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve reset' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Approve reset' }));

    const dialog = await screen.findByRole('dialog', { name: 'Approve MFA reset request?' });
    const confirmButton = within(dialog).getByRole('button', { name: 'Approve reset' }) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(false); // reason optional, not required

    fireEvent.click(confirmButton);
    await waitFor(() => expect(counts.approve).toBe(1));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/MFA reset approved/));
  });

  it('Approve reason, when provided, is sent to the API', async () => {
    const counts = { approve: 0, reject: 0 };
    fetchMock.mockReset();
    fetchMock.mockImplementation(baseHandlers(counts));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/mfa-reset-requests/req-1');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve reset' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Approve reset' }));

    const dialog = await screen.findByRole('dialog', { name: 'Approve MFA reset request?' });
    fireEvent.change(within(dialog).getByLabelText(/Decision reason/), { target: { value: 'Verified via call' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve reset' }));

    await waitFor(() => expect(counts.approve).toBe(1));
    const [, requestInit] = fetchMock.mock.calls.find(([callUrl]: [string]) =>
      String(callUrl).includes('/approve'),
    ) as [string, RequestInit];
    expect(JSON.parse(String(requestInit.body))).toEqual({ reason: 'Verified via call' });
  });

  it('Reject does not decide on first click, and Cancel makes no API call', async () => {
    const counts = { approve: 0, reject: 0 };
    fetchMock.mockReset();
    fetchMock.mockImplementation(baseHandlers(counts));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/mfa-reset-requests/req-1');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reject reset' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Reject reset' }));

    const dialog = await screen.findByRole('dialog', { name: 'Reject MFA reset request?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(counts.reject).toBe(0);
    expect(counts.approve).toBe(0);
  });

  it('Reject confirms once and calls the reject API', async () => {
    const counts = { approve: 0, reject: 0 };
    fetchMock.mockReset();
    fetchMock.mockImplementation(baseHandlers(counts));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/mfa-reset-requests/req-1');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reject reset' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Reject reset' }));

    const dialog = await screen.findByRole('dialog', { name: 'Reject MFA reset request?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject reset' }));

    await waitFor(() => expect(counts.reject).toBe(1));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/MFA reset rejected/));
  });
});
