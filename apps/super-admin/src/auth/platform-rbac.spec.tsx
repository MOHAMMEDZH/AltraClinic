import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { AppRouter } from '../app/router';
import { __resetPlatformAccessTokenForTests } from './PlatformAuthProvider';

const fetchMock = vi.fn();
const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });
function renderApp(path: string) { return render(<AppProviders><MemoryRouter initialEntries={[path]}><AppRouter /></MemoryRouter></AppProviders>); }
function authenticatedApi(permissions: string[]) {
  return async (url: string, init?: RequestInit) => {
    const path = String(url);
    if (path.includes('/platform/auth/refresh')) {
      return json(200, {
        accessToken: 'token',
        sessionId: 's1',
        tokenType: 'Bearer',
        principalType: 'platform',
        accessExpiresIn: 900,
      });
    }
    if (path.includes('/platform/auth/me')) {
      return json(200, {
        id: 'u1',
        email: 'admin@example.com',
        displayName: 'Admin',
        principalType: 'platform',
        accountStatus: 'active',
        status: 'active',
        sessionId: 's1',
        mfaEnabled: true,
        roleKeys: [],
        permissions,
        authzRevision: 1,
      });
    }
    if (path.includes('/platform/users') && !path.includes('/platform/users/') && (init?.method ?? 'GET') === 'GET') {
      return json(200, {
        items: [
          {
            id: 'u2',
            email: 'operator@example.com',
            displayName: 'Operator',
            status: 'active',
            mfaEnabled: true,
            createdAt: '2026-01-01T00:00:00Z',
          },
        ],
        total: 1,
      });
    }
    if (path.includes('/platform/roles')) return json(200, []);
    return json(404, { message: 'not found', method: init?.method });
  };
}
describe('Step 08 — platform RBAC UI', () => {
  beforeEach(() => { vi.stubEnv('VITE_SUPER_ADMIN_APP_NAME', 'Super Admin'); vi.stubEnv('VITE_SUPER_ADMIN_ENV', 'test'); vi.stubEnv('VITE_API_BASE_URL', '/api'); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); __resetPlatformAccessTokenForTests(); });
  it('hides Platform users navigation without permission and routes direct access to unauthorized', async () => {
    fetchMock.mockImplementation(authenticatedApi([])); renderApp('/platform-users');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Unauthorized' })).toBeTruthy());
    expect(screen.queryByRole('link', { name: 'Platform users' })).toBeNull();
  });
  it('renders the platform users list without secret fields', async () => {
    fetchMock.mockImplementation(authenticatedApi(['platform-user.view'])); renderApp('/platform-users');
    await waitFor(() => expect(screen.getByText('operator@example.com')).toBeTruthy());
    expect(screen.queryByText(/passwordHash|mfaSecret|secret/i)).toBeNull();
  });
  it('validates invite form before submitting', async () => {
    fetchMock.mockImplementation(authenticatedApi(['platform-user.invite']));
    renderApp('/platform-users/invite');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send invitation' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent ?? '').toMatch(/Email and at least one role/i);
  });

  it('shows generic delivery status and never renders an invitation URL', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const path = String(url);
      if (path.includes('/platform/auth/refresh') || path.includes('/platform/auth/me')) {
        return authenticatedApi(['platform-user.invite'])(url, init);
      }
      if (path.includes('/platform/roles')) {
        return json(200, [{ key: 'auditor', displayName: 'Auditor', permissionKeys: [] }]);
      }
      if (path.endsWith('/platform/users/invitations') && init?.method === 'POST') {
        return json(200, {
          invitationId: 'inv-1',
          platformUserId: 'u2',
          status: 'pending',
          expiresAt: '2026-07-22T00:00:00Z',
          deliveryChannel: 'none',
          deliveryStatus: 'failed',
          createdAt: '2026-07-21T00:00:00Z',
        });
      }
      return json(404, {});
    });
    renderApp('/platform-users/invite');
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByText('Auditor'));
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    await waitFor(() => expect(screen.getByRole('status').textContent ?? '').toMatch(/delivery could not be confirmed/i));
    expect(document.body.textContent ?? '').not.toMatch(/activate\?token=/i);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('shows password form for a valid invitation token', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('invitation/validate')
        ? json(200, { valid: true, emailHint: 'a***@example.com', canActivate: true, expired: false })
        : json(401, {}),
    );
    renderApp('/activate?token=valid-token');
    await waitFor(() => expect(screen.getByLabelText('Password')).toBeTruthy());
    expect(screen.getByLabelText('Confirm password')).toBeTruthy();
  });
});
