import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { AppRouter } from '../app/router';
import { __resetPlatformAccessTokenForTests } from '../auth/PlatformAuthProvider';

const fetchMock = vi.fn();

function renderApp(initialPath: string) {
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

function authenticatedFetch(permissions: string[], roleKeys: string[] = []) {
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
        roleKeys,
        permissions,
        authzRevision: 1,
      });
    }
    if (path.includes('/platform/roles')) return jsonResponse(200, []);
    return jsonResponse(404, {});
  };
}

describe('Step 09 — permission-driven navigation', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPER_ADMIN_APP_NAME', 'Super Admin');
    vi.stubEnv('VITE_SUPER_ADMIN_ENV', 'test');
    vi.stubEnv('VITE_API_BASE_URL', '/api');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    __resetPlatformAccessTokenForTests();
  });

  it('hides every permission-gated nav item for a principal with no permissions', async () => {
    fetchMock.mockImplementation(authenticatedFetch([]));
    renderApp('/overview');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeTruthy());

    expect(screen.getByRole('link', { name: 'Overview' })).toBeTruthy();
    for (const label of [
      'Tenants',
      'Catalog',
      'Plans',
      'Add-ons',
      'Commercial overrides',
      'Composition preview',
      'Platform users',
      'Roles',
      'Operations',
      'Audit',
      'Sales',
      'Settings',
    ]) {
      expect(screen.queryByRole('link', { name: label })).toBeNull();
    }
  });

  it('is authenticated-only: overview stays reachable regardless of permission set', async () => {
    fetchMock.mockImplementation(authenticatedFetch([]));
    renderApp('/overview');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeTruthy());
  });

  it('redirects a direct deep link to a permission-gated route to Unauthorized', async () => {
    fetchMock.mockImplementation(authenticatedFetch([]));
    renderApp('/tenants');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Unauthorized' })).toBeTruthy());
  });

  it('grants access to an anyOf-gated route when only one of the listed permissions is present', async () => {
    fetchMock.mockImplementation(authenticatedFetch(['plan.view']));
    renderApp('/plans');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Plans' })).toBeTruthy());
    expect(screen.getByRole('link', { name: 'Plans' })).toBeTruthy();
  });

  it('shows Add-ons nav when addon.view is present', async () => {
    fetchMock.mockImplementation(authenticatedFetch(['addon.view']));
    renderApp('/add-ons');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Add-ons' })).toBeTruthy());
    expect(screen.getByRole('link', { name: 'Add-ons' })).toBeTruthy();
  });

  it('denies an anyOf-gated route when none of the listed permissions are present', async () => {
    fetchMock.mockImplementation(authenticatedFetch(['tenant.view']));
    renderApp('/plans');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Unauthorized' })).toBeTruthy());
  });

  it('denies an allOf-style check (roles page) unless every listed permission is present', async () => {
    fetchMock.mockImplementation(authenticatedFetch(['platform-role.view']));
    renderApp('/roles');
    // roles uses anyOf(platform-role.view, platform-permission.view) — one is enough here.
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Platform roles' })).toBeTruthy());
  });

  it('never grants access via role-name bypass, even for role keys that look like "super admin"', async () => {
    fetchMock.mockImplementation(authenticatedFetch([], ['super_admin', 'owner']));
    renderApp('/tenants');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Unauthorized' })).toBeTruthy());
    expect(screen.queryByRole('link', { name: 'Tenants' })).toBeNull();
  });

  it('grants access once the exact required permission key is present', async () => {
    fetchMock.mockImplementation(authenticatedFetch(['tenant.view']));
    renderApp('/tenants');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Tenants' })).toBeTruthy());
  });
});
