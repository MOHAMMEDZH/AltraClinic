import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from './app/providers/AppProviders';
import { AppRouter } from './app/router';
import { ErrorBoundary } from './app/providers/ErrorBoundary';
import {
  loadSuperAdminRuntimeConfig,
  validateSuperAdminRuntimeConfig,
} from './config/runtime-config';
import { __resetPlatformAccessTokenForTests } from './auth/PlatformAuthProvider';
import { sanitizeInternalRedirect } from './auth/ProtectedRoute';

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

describe('Step 06 — Super Admin platform authentication', () => {
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
    // Default: unauthenticated bootstrap (refresh fails once)
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => JSON.stringify({ message: 'Unauthorized' }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  it('loads runtime config without tenant or auth secrets', () => {
    const config = loadSuperAdminRuntimeConfig({
      VITE_SUPER_ADMIN_APP_NAME: 'Super Admin',
      VITE_SUPER_ADMIN_ENV: 'development',
      VITE_API_BASE_URL: '/api',
    });
    expect(config.appName).toBe('Super Admin');
    expect(config.phase).toBe('47-platform-auth');
    expect(config).not.toHaveProperty('tenantId');
    expect(validateSuperAdminRuntimeConfig(config)).toEqual({ ok: true });
  });

  it('rejects invalid apiBaseUrl without exposing secrets', () => {
    const bad = loadSuperAdminRuntimeConfig({
      VITE_API_BASE_URL: 'not-a-url',
      VITE_SUPER_ADMIN_ENV: 'development',
    });
    const result = validateSuperAdminRuntimeConfig(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).not.toMatch(/password|token|secret|jwt/i);
    }
  });

  it('sanitizes open redirect attempts after login', () => {
    expect(sanitizeInternalRedirect('https://evil.example/phish')).toBe('/');
    expect(sanitizeInternalRedirect('//evil.example')).toBe('/');
    expect(sanitizeInternalRedirect('/overview')).toBe('/overview');
    expect(sanitizeInternalRedirect('/login')).toBe('/');
  });

  it('renders login form with accessible labels and no tenant selector', async () => {
    renderApp('/login');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Login' })).toBeTruthy());
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.queryByLabelText(/tenant/i)).toBeNull();
    expect(screen.queryByText(/patient portal/i)).toBeNull();
    expect(screen.getByText(/Password recovery for platform accounts is not enabled/i)).toBeTruthy();
  });

  it('shows client validation without calling login API', async () => {
    renderApp('/login');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/required/i);
    const loginCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/platform/auth/login'));
    expect(loginCalls).toHaveLength(0);
  });

  it('shows generic failure on invalid credentials', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/platform/auth/refresh')) {
        return {
          ok: false,
          status: 401,
          text: async () => JSON.stringify({ message: 'Unauthorized' }),
        };
      }
      if (String(url).includes('/platform/auth/login')) {
        return {
          ok: false,
          status: 401,
          text: async () => JSON.stringify({ message: 'Invalid email or password.' }),
        };
      }
      return { ok: false, status: 404, text: async () => '' };
    });

    renderApp('/login');
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ops@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Invalid email or password/i);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('redirects unauthenticated users from protected routes to login', async () => {
    renderApp('/overview');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Login' })).toBeTruthy());
  });

  it('allows authenticated access to scaffold routes and logout', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const path = String(url);
      if (path.includes('/platform/auth/refresh') && init?.method === 'POST') {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              accessToken: 'platform-access',
              accessExpiresIn: 900,
              sessionId: 's1',
              tokenType: 'Bearer',
              principalType: 'platform',
            }),
        };
      }
      if (path.includes('/platform/auth/me')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              id: 'pu1',
              email: 'ops@example.com',
              displayName: 'Ops',
              principalType: 'platform',
              accountStatus: 'active',
              sessionId: 's1',
              mfaEnabled: true,
            }),
        };
      }
      if (path.includes('/platform/auth/logout')) {
        return { ok: true, status: 204, text: async () => '' };
      }
      return { ok: false, status: 404, text: async () => '' };
    });

    renderApp('/overview');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeTruthy());
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(Object.keys(localStorage).join(',')).not.toMatch(/booking\.|patient|clinic/i);

    // Identity (email) and logout live inside the account menu in the Step 09 shell.
    fireEvent.click(screen.getByRole('button', { name: 'Ops' }));
    expect(screen.getByText('ops@example.com')).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Login' })).toBeTruthy());
  });

  it('does not call business APIs during authentication initialization', async () => {
    renderApp('/');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const paths = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(paths.every((p) => p.includes('/platform/auth/'))).toBe(true);
    expect(paths.some((p) => /tenants|plans|catalog|subscriptions/i.test(p))).toBe(false);
  });

  it('renders unauthorized placeholder without auth', async () => {
    renderApp('/unauthorized');
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Unauthorized' })).toBeTruthy(),
    );
  });

  it('renders error boundary fallback without stack traces', () => {
    function Boom(): never {
      throw new Error('boom');
    }
    render(
      <ErrorBoundary fallbackTitle="Something went wrong">
        <Boom />
      </ErrorBoundary>,
    );
    const alert = screen.getByRole('alert');
    expect(within(alert).getByRole('heading', { level: 1 })).toBeTruthy();
    expect(alert.textContent).not.toMatch(/boom|stack|Error:/);
  });

  it('exposes primary navigation landmarks', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const path = String(url);
      if (path.includes('/platform/auth/refresh')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              accessToken: 'platform-access',
              accessExpiresIn: 900,
              sessionId: 's1',
              tokenType: 'Bearer',
              principalType: 'platform',
            }),
        };
      }
      if (path.includes('/platform/auth/me')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({
              id: 'pu1',
              email: 'ops@example.com',
              displayName: 'Ops',
              principalType: 'platform',
              accountStatus: 'active',
              sessionId: 's1',
              mfaEnabled: true,
            }),
        };
      }
      return { ok: false, status: 404, text: async () => '' };
    });

    renderApp('/overview');
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy());
    expect(screen.getByRole('main')).toBeTruthy();
  });
});
