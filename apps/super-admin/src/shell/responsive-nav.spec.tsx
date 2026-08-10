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
        roleKeys: [],
        permissions: ['platform-user.view'],
        authzRevision: 1,
      });
    }
    return jsonResponse(404, {});
  };
}

describe('Step 09 — responsive navigation (mobile drawer)', () => {
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

  it('renders a mobile menu button with an accessible name and collapsed expanded state', async () => {
    renderApp('/overview');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeTruthy());

    const menuButton = screen.getByRole('button', { name: 'Menu' });
    expect(menuButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the navigation drawer, flips aria-expanded, and closes on Escape', async () => {
    renderApp('/overview');
    const menuButton = await screen.findByRole('button', { name: 'Menu' });

    fireEvent.click(menuButton);
    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
    const dialog = await screen.findByRole('dialog', { name: 'Navigation menu' });
    expect(dialog).toBeTruthy();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).toBeNull());
  });

  it('closes the drawer automatically after choosing a destination', async () => {
    renderApp('/overview');
    const menuButton = await screen.findByRole('button', { name: 'Menu' });
    fireEvent.click(menuButton);

    const dialog = await screen.findByRole('dialog', { name: 'Navigation menu' });
    const platformUsersLink = within(dialog).getAllByRole('link', { name: 'Platform users' })[0];
    fireEvent.click(platformUsersLink);

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Platform users' })).toBeTruthy(),
    );
    expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).toBeNull();
  });
});
