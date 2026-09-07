import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { AppRouter } from '../app/router';
import { __resetPlatformAccessTokenForTests } from '../auth/PlatformAuthProvider';

const fetchMock = vi.fn();

function renderApp(initialPath = '/overview') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppRouter />
      </MemoryRouter>
    </AppProviders>,
  );
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

function authenticatedFetch() {
  return async (url: string) => {
    const path = String(url);
    if (path.includes('/platform/auth/refresh')) {
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
        email: 'ops@example.com',
        displayName: 'Ops',
        principalType: 'platform',
        accountStatus: 'active',
        status: 'active',
        sessionId: 's1',
        mfaEnabled: true,
        roleKeys: ['auditor'],
        permissions: ['platform-user.view'],
        authzRevision: 1,
      });
    }
    if (path.includes('/platform/auth/logout')) {
      return jsonResponse(204, undefined);
    }
    return jsonResponse(404, {});
  };
}

describe('Step 09 — Super Admin design system shell', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPER_ADMIN_APP_NAME', 'Super Admin');
    vi.stubEnv('VITE_SUPER_ADMIN_ENV', 'test');
    vi.stubEnv('VITE_API_BASE_URL', '/api');
    fetchMock.mockReset();
    fetchMock.mockImplementation(authenticatedFetch());
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    __resetPlatformAccessTokenForTests();
  });

  it('exposes a skip link targeting #main-content and a main landmark', async () => {
    renderApp('/overview');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeTruthy());

    const skipLink = screen.getByRole('link', { name: 'Skip to main content' });
    expect(skipLink.getAttribute('href')).toBe('#main-content');
    expect(screen.getByRole('main').id).toBe('main-content');
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
  });

  it('shows an environment badge with visible text, not color alone', async () => {
    renderApp('/overview');
    await waitFor(() => expect(screen.getByText('Test')).toBeTruthy());
  });

  it('never renders a tenant or patient selector anywhere in the shell', async () => {
    renderApp('/overview');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeTruthy());
    expect(screen.queryByLabelText(/tenant/i)).toBeNull();
    expect(screen.queryByText(/patient/i)).toBeNull();
    expect(screen.queryByRole('combobox', { name: /tenant|patient/i })).toBeNull();
  });

  it('sets document.title from the route registry', async () => {
    renderApp('/overview');
    // DocumentTitle can settle during auth bootstrap (AuthPageFrame) before the
    // permission-gated primary nav mounts — wait for the authenticated shell.
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeTruthy());
    await waitFor(() => expect(document.title).toBe('Overview | Super Admin'));

    fireEvent.click(await screen.findByRole('link', { name: 'Platform users' }));
    await waitFor(() => expect(document.title).toBe('Platform users | Super Admin'));
  });

  it('opens the account menu via keyboard and exposes identity summary + logout', async () => {
    renderApp('/overview');
    const trigger = await screen.findByRole('button', { name: 'Ops' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter' });

    const menu = await screen.findByRole('menu', { name: 'Account menu' });
    expect(within(menu).getByText('ops@example.com')).toBeTruthy();
    // Role *names* may be shown as labels, but never determine access — this is a display-only summary.
    expect(within(menu).getByText(/auditor/)).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'My security' })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'Log out' })).toBeTruthy();

    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('signs the user out from the account menu', async () => {
    renderApp('/overview');
    fireEvent.click(await screen.findByRole('button', { name: 'Ops' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Log out' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Login' })).toBeTruthy());
  });
});
