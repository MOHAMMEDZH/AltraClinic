import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { DEMO_TENANT_ID } from './demo-credentials';

export interface LoginCredentials {
  email: string;
  password: string;
  tenantId?: string;
}

export interface LoginOptions {
  /** When false, accept unified license experience as a successful authenticated session. */
  requireAppShell?: boolean;
  /**
   * Force the interactive login form (counts against /auth public_ip rate limits).
   * Default mints one API session per credential, then boots the SPA against the **live** API
   * (no page.route fulfillment for /auth/* or entitlements).
   */
  interactive?: boolean;
  /**
   * Opt-in page-local fulfill for /auth/refresh + /auth/me only (never entitlements).
   * Use only when Redis-backed rate limits force session reuse; Cluster H authority uses live.
   */
  fulfillBootstrapAuth?: boolean;
  /**
   * Skip process-local session cache (required for concurrent browser contexts as the same user).
   */
  isolatedSession?: boolean;
}

const userMenuButton = (page: Page) =>
  page.getByRole('button', { name: /^(User menu|قائمة المستخدم)$/ });

const API_BASE = (process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

type CachedSession = {
  refreshToken: string;
  accessToken: string;
  accessExpiresIn: number;
  sessionId: string;
  tenantId: string;
  obtainedAt: number;
  me: unknown;
};

/** Process-local only — never written to disk / storageState. */
const sessionCache = new Map<string, CachedSession>();

/** Opt-in auth churn counters (PLAYWRIGHT_AUTH_DIAG=1). Never stores secrets. */
type AuthDiagCounters = {
  loginCalls: number;
  refreshCalls: number;
  meCalls: number;
  logoutCalls: number;
  cacheHits: number;
  cacheMisses: number;
  remintFailures: number;
  spaRotationsSynced: number;
  helperRotations: number;
};

const authDiag: AuthDiagCounters = {
  loginCalls: 0,
  refreshCalls: 0,
  meCalls: 0,
  logoutCalls: 0,
  cacheHits: 0,
  cacheMisses: 0,
  remintFailures: 0,
  spaRotationsSynced: 0,
  helperRotations: 0,
};

function authDiagEnabled(): boolean {
  return process.env.PLAYWRIGHT_AUTH_DIAG === '1' || process.env.PLAYWRIGHT_AUTH_DIAG === 'true';
}

export function getAuthDiagCounters(): Readonly<AuthDiagCounters> {
  return { ...authDiag };
}

export function resetAuthDiagCounters(): void {
  for (const k of Object.keys(authDiag) as (keyof AuthDiagCounters)[]) {
    authDiag[k] = 0;
  }
}

function sessionKey(credentials: LoginCredentials): string {
  const tenantId = credentials.tenantId ?? DEMO_TENANT_ID;
  return `${tenantId.toLowerCase()}::${credentials.email.toLowerCase()}`;
}

/** Transient transport failures only — never retry HTTP 4xx/auth contract errors. */
function isTransientNetworkError(err: unknown): boolean {
  const msg = String(err ?? '');
  return /socket hang up|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|aborted|network|fetch failed/i.test(
    msg,
  );
}

async function withTransientRetries<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isTransientNetworkError(err) || i === attempts - 1) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
  throw new Error(`${label}: exhausted transient retries: ${String(last)}`);
}

/** Fail-closed wait for the real login form (not an empty Vite HTML shell). */
export async function waitForLoginForm(page: Page, timeout = 20_000) {
  await expect(
    page.getByRole('heading', { name: /sign[\s-]?in|تسجيل الدخول/i }),
  ).toBeVisible({ timeout });
  const loginForm = page.locator('form').first();
  await expect(loginForm).toBeVisible({ timeout });
  await expect(loginForm.locator('input[autocomplete="organization"]')).toBeVisible({ timeout });
  await expect(loginForm.locator('input[type="email"]')).toBeVisible({ timeout });
  await expect(loginForm.locator('input[type="password"]')).toBeVisible({ timeout });
  return loginForm;
}

async function readJson(response: { ok: () => boolean; status: () => number; json: () => Promise<unknown> }) {
  const body = await response.json();
  return body as Record<string, unknown>;
}

/**
 * Mint a real session via the live API (login → refresh → me).
 * Entitlements are intentionally NOT cached here — the SPA must load them live.
 */
export async function mintCachedSession(
  request: APIRequestContext,
  credentials: LoginCredentials,
  options: { isolatedSession?: boolean } = {},
): Promise<CachedSession> {
  const key = sessionKey(credentials);
  const existing = options.isolatedSession ? undefined : sessionCache.get(key);
  // Never short-circuit on accessToken freshness alone: a prior SPA AuthProvider boot
  // rotates/invalidates the cached refresh token while leaving accessExpiresIn looking fresh.
  // Always attempt refresh (or re-login) so the returned refreshToken is still redeemable.

  const tenantId = credentials.tenantId ?? DEMO_TENANT_ID;

  const mintOnce = async (forceNewLogin: boolean): Promise<CachedSession | null> => {
    let refreshToken = forceNewLogin ? undefined : existing?.refreshToken;

    if (!refreshToken) {
      if (authDiagEnabled()) authDiag.loginCalls += 1;
      const loginResponse = await withTransientRetries('auth/login', () =>
        request.post(`${API_BASE}/auth/login`, {
          data: {
            email: credentials.email,
            password: credentials.password,
            tenantId,
            deviceName: 'playwright-e2e-session',
          },
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        }),
      );
      if (!loginResponse.ok()) {
        if (authDiagEnabled()) authDiag.remintFailures += 1;
        const body = await readJson(loginResponse).catch(() => ({}));
        throw new Error(
          `Login API returned ${loginResponse.status()} code=${String(body.code ?? 'none')} scope=${String(body.scope ?? 'none')}`,
        );
      }
      const loginBody = await readJson(loginResponse);
      if (loginBody.mfaRequired) {
        throw new Error('Login API requires MFA — use login(..., { interactive: true })');
      }
      if (typeof loginBody.refreshToken !== 'string') {
        throw new Error('Login API returned no refreshToken');
      }
      refreshToken = loginBody.refreshToken;
    }

    let refreshResponse;
    try {
      if (authDiagEnabled()) authDiag.refreshCalls += 1;
      refreshResponse = await request.post(`${API_BASE}/auth/refresh`, {
        data: { refreshToken },
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      });
    } catch {
      if (authDiagEnabled()) authDiag.remintFailures += 1;
      return null;
    }
    if (!refreshResponse.ok()) {
      if (authDiagEnabled()) authDiag.remintFailures += 1;
      return null;
    }
    const refreshBody = await readJson(refreshResponse);
    if (
      typeof refreshBody.accessToken !== 'string' ||
      typeof refreshBody.refreshToken !== 'string' ||
      typeof refreshBody.sessionId !== 'string' ||
      typeof refreshBody.accessExpiresIn !== 'number'
    ) {
      return null;
    }

    let meResponse;
    try {
      if (authDiagEnabled()) authDiag.meCalls += 1;
      meResponse = await request.get(`${API_BASE}/auth/me`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${refreshBody.accessToken}`,
          'x-tenant-id': tenantId,
        },
      });
    } catch {
      if (authDiagEnabled()) authDiag.remintFailures += 1;
      return null;
    }
    if (!meResponse.ok()) {
      if (authDiagEnabled()) authDiag.remintFailures += 1;
      return null;
    }
    const me = await meResponse.json();

    const cached: CachedSession = {
      refreshToken: refreshBody.refreshToken,
      accessToken: refreshBody.accessToken,
      accessExpiresIn: refreshBody.accessExpiresIn,
      sessionId: refreshBody.sessionId,
      tenantId,
      obtainedAt: Date.now(),
      me,
    };
    if (!options.isolatedSession) {
      sessionCache.set(key, cached);
    }
    return cached;
  };

  if (existing?.refreshToken && authDiagEnabled()) authDiag.cacheHits += 1;
  else if (authDiagEnabled()) authDiag.cacheMisses += 1;

  const runMint = async (forceNewLogin: boolean): Promise<CachedSession | null> => {
    try {
      return await mintOnce(forceNewLogin);
    } catch (err) {
      // mintOnce already retries login POST; bubble non-transient (4xx/MFA) immediately.
      if (!isTransientNetworkError(err)) throw err;
      if (authDiagEnabled()) authDiag.remintFailures += 1;
      return null;
    }
  };

  const first = await runMint(false);
  if (first) {
    if (!options.isolatedSession) sessionCache.set(key, first);
    return first;
  }

  if (!options.isolatedSession) sessionCache.delete(key);
  if (authDiagEnabled()) authDiag.helperRotations += 1;
  const second = await runMint(true);
  if (second) {
    if (!options.isolatedSession) sessionCache.set(key, second);
    return second;
  }

  if (authDiagEnabled()) authDiag.remintFailures += 1;
  throw new Error(`Unable to mint cached session for ${credentials.email}`);
}

/** Sync SPA-rotated refresh token back into the process cache after navigations. */
export async function syncCachedRefreshFromPage(page: Page, credentials: LoginCredentials) {
  const key = sessionKey(credentials);
  const rotatedRefresh = await page.evaluate(() => sessionStorage.getItem('booking.refreshToken'));
  if (!rotatedRefresh) return;
  if (authDiagEnabled()) authDiag.spaRotationsSynced += 1;
  const existing = sessionCache.get(key);
  if (existing) {
    sessionCache.set(key, { ...existing, refreshToken: rotatedRefresh, obtainedAt: Date.now() });
    return;
  }
  sessionCache.set(key, {
    refreshToken: rotatedRefresh,
    accessToken: '',
    accessExpiresIn: 900,
    sessionId: '',
    tenantId: credentials.tenantId ?? DEMO_TENANT_ID,
    obtainedAt: Date.now(),
    me: null,
  });
}

/**
 * Optional rate-limit harness: page-local fulfill for /auth/refresh + /auth/me only.
 * Never fulfills entitlements — license gate must use live contract.
 */
async function installBootstrapAuthRoutes(page: Page, session: CachedSession) {
  await page.unroute('**/auth/refresh').catch(() => undefined);
  await page.unroute('**/auth/me').catch(() => undefined);

  await page.route('**/auth/refresh', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        accessExpiresIn: session.accessExpiresIn,
        sessionId: session.sessionId,
        tokenType: 'Bearer',
      }),
    });
  });

  await page.route('**/auth/me', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session.me),
    });
  });
}

async function waitForAppShell(page: Page) {
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  // Fail closed with diagnostics if license gate / login intercepts shell.
  const menu = userMenuButton(page);
  try {
    await expect(menu).toBeVisible({ timeout: 45_000 });
  } catch (err) {
    const url = page.url();
    const bodySnippet = (await page.locator('body').innerText().catch(() => '')).slice(0, 400);
    throw new Error(
      `App shell User menu not visible. url=${url} bodySnippet=${JSON.stringify(bodySnippet)} cause=${String(err)}`,
    );
  }
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
}

/**
 * Real-server SPA bootstrap: mint refresh token via API, then let AuthProvider hit live
 * /auth/refresh, /auth/me, and /tenant/subscription/entitlements through the Vite proxy.
 */
async function loginWithCachedSession(
  page: Page,
  credentials: LoginCredentials,
  options: LoginOptions,
) {
  const { requireAppShell = true, fulfillBootstrapAuth = false, isolatedSession = false } = options;
  const session = await mintCachedSession(page.request, credentials, { isolatedSession });

  if (fulfillBootstrapAuth) {
    await installBootstrapAuthRoutes(page, session);
  } else {
    await page.unroute('**/auth/refresh').catch(() => undefined);
    await page.unroute('**/auth/me').catch(() => undefined);
    await page.unroute('**/tenant/subscription/entitlements').catch(() => undefined);
  }

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ refreshToken, tenantId }) => {
      sessionStorage.setItem('booking.refreshToken', refreshToken);
      localStorage.setItem('booking.tenantId', tenantId);
      // Deterministic E2E chrome: English aria-labels (User menu) regardless of prior locale.
      localStorage.setItem('booking.locale', 'en-US');
    },
    { refreshToken: session.refreshToken, tenantId: session.tenantId },
  );

  const authTraffic: string[] = [];
  const onResponse = (resp: { url: () => string; status: () => number; request: () => { method: () => string } }) => {
    const url = resp.url();
    if (
      url.includes('/auth/refresh') ||
      url.includes('/auth/me') ||
      url.includes('/tenant/subscription/entitlements')
    ) {
      authTraffic.push(`${resp.request().method()} ${resp.status()} ${url}`);
    }
  };
  page.on('response', onResponse);

  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    if (requireAppShell) {
      await waitForAppShell(page);
    } else {
      await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
    }

    const rotatedRefresh = await page.evaluate(() => sessionStorage.getItem('booking.refreshToken'));
    if (rotatedRefresh) {
      sessionCache.set(sessionKey(credentials), {
        ...session,
        refreshToken: rotatedRefresh,
        obtainedAt: Date.now(),
      });
    }
  } catch (err) {
    sessionCache.delete(sessionKey(credentials));
    throw new Error(
      `${String(err)} | authTraffic=[${authTraffic.join(' ; ')}] | url=${page.url()}`,
    );
  } finally {
    page.off('response', onResponse);
  }
}

async function loginInteractive(page: Page, credentials: LoginCredentials, options: LoginOptions) {
  const { requireAppShell = true } = options;

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('booking.locale', 'en-US');
  });
  const loginForm = await waitForLoginForm(page);
  await loginForm.locator('input[autocomplete="organization"]').fill(credentials.tenantId ?? DEMO_TENANT_ID);
  await loginForm.locator('input[type="email"]').fill(credentials.email);
  await loginForm.locator('input[type="password"]').fill(credentials.password);

  const loginResponse = page.waitForResponse(
    (resp) => resp.url().includes('/auth/login') && resp.request().method() === 'POST',
    { timeout: 20_000 },
  );
  await loginForm.locator('button[type="submit"]').click();

  const response = await loginResponse;
  if (!response.ok()) {
    let code = 'none';
    let scope = 'none';
    try {
      const body = (await response.json()) as { code?: string; scope?: string };
      code = body.code ?? code;
      scope = body.scope ?? scope;
    } catch {
      /* ignore */
    }
    throw new Error(`Login API returned ${response.status()} code=${code} scope=${scope}`);
  }

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });

  if (requireAppShell) {
    await waitForAppShell(page);
  }
}

export async function login(page: Page, credentials: LoginCredentials, options: LoginOptions = {}) {
  // License-maintenance / unified-experience flows need a real AuthProvider bootstrap
  // (live /auth/me + entitlements). Default path also uses live bootstrap (Cluster H).
  if (options.interactive || options.requireAppShell === false) {
    await loginInteractive(page, credentials, options);
    return;
  }
  await loginWithCachedSession(page, credentials, options);
}

/** Sign out via the shell user menu and wait for the login page. */
export async function logout(page: Page) {
  await userMenuButton(page).click();
  await page.waitForURL((url) => url.pathname.startsWith('/login'), { timeout: 15_000 });
  await expect(page.locator('form input[autocomplete="organization"]')).toBeVisible();
}

/** Navigate to an inventory route and wait for catalog data when applicable. */
export async function gotoInventory(page: Page, route: string) {
  const path = route.startsWith('/') ? route : `/inventory/${route}`;
  const catalogLoad =
    path.includes('/catalog')
      ? page
          .waitForResponse(
            (resp) => resp.url().includes('/inventory/items') && resp.request().method() === 'GET',
            { timeout: 20_000 },
          )
          .catch(() => null)
      : null;
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  if (catalogLoad) await catalogLoad;
}
