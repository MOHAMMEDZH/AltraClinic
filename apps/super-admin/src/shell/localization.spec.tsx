import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { AppRouter } from '../app/router';
import { __resetPlatformAccessTokenForTests } from '../auth/PlatformAuthProvider';

/**
 * Release 47 Step 09 correction 3 — localization/RTL coverage for the shell
 * chrome: the language switcher (in `UserMenu`) must flip `document.documentElement`
 * `lang`/`dir`, translate nav labels and the document title, and any open
 * high-impact confirmation dialog must render fully localized copy too.
 */

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? '' : JSON.stringify(body)) };
}

function renderApp(initialPath = '/overview') {
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

function authenticatedFetch() {
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
        roleKeys: ['auditor'],
        permissions: ['platform-user.view'],
        authzRevision: 1,
      });
    }
    if (path.endsWith('/platform/auth/sessions') && method === 'GET') {
      return jsonResponse(200, sessionsPayload());
    }
    if (path.includes('/platform/auth/logout')) {
      return jsonResponse(204, undefined);
    }
    return jsonResponse(404, {});
  };
}

async function switchToArabic() {
  fireEvent.click(await screen.findByRole('button', { name: 'Ops' }));
  const menu = await screen.findByRole('menu', { name: 'Account menu' });
  fireEvent.click(within(menu).getByRole('menuitem', { name: /العربية/ }));
}

describe('Step 09 — shell localization and RTL', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPER_ADMIN_APP_NAME', 'Super Admin');
    vi.stubEnv('VITE_SUPER_ADMIN_ENV', 'test');
    vi.stubEnv('VITE_API_BASE_URL', '/api');
    fetchMock.mockReset();
    fetchMock.mockImplementation(authenticatedFetch());
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    __resetPlatformAccessTokenForTests();
    localStorage.clear();
    document.documentElement.lang = 'en-US';
    document.documentElement.dir = 'ltr';
  });

  it('switching to العربية via the user menu flips document lang/dir to rtl', async () => {
    renderApp('/overview');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeTruthy());
    expect(document.documentElement.dir).toBe('ltr');

    await switchToArabic();

    expect(document.documentElement.lang).toBe('ar-SY');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('translates the primary nav labels and document title into Arabic', async () => {
    renderApp('/overview');
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeTruthy());
    expect(document.title).toBe('Overview | Super Admin');

    await switchToArabic();

    expect(await screen.findByRole('link', { name: 'نظرة عامة' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'مستخدمو المنصة' })).toBeTruthy();
    await waitFor(() => expect(document.title).toBe('نظرة عامة | الإدارة العامة'));
  });

  it('re-renders the account menu itself in Arabic (My security / Log out)', async () => {
    renderApp('/overview');
    await switchToArabic();

    fireEvent.click(await screen.findByRole('button', { name: 'Ops' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'الأمان الشخصي' })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'تسجيل الخروج' })).toBeTruthy();
  });

  it('keeps the mobile navigation drawer usable under rtl', async () => {
    renderApp('/overview');
    await switchToArabic();

    fireEvent.click(screen.getByRole('button', { name: /القائمة|Menu/ }));
    const dialog = await screen.findByRole('dialog');
    expect(document.documentElement.dir).toBe('rtl');
    expect(within(dialog).getByRole('link', { name: 'نظرة عامة' })).toBeTruthy();
  });

  it('localizes an open high-impact confirmation dialog (revoke session)', async () => {
    renderApp('/security');
    await waitFor(() => expect(screen.getByText('Other device')).toBeTruthy());

    await switchToArabic();

    const rows = await screen.findAllByRole('row');
    const otherRow = rows.find((row) => within(row).queryByText('Other device'));
    fireEvent.click(within(otherRow!).getByRole('button', { name: /إبطال|Revoke/ }));

    const dialog = await screen.findByRole('dialog', { name: 'إبطال هذه الجلسة؟' });
    expect(within(dialog).getByRole('button', { name: 'إبطال الجلسة' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'إلغاء' })).toBeTruthy();
  });
});
