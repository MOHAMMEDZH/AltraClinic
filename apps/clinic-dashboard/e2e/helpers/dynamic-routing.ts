import { expect, type Page } from '@playwright/test';

const REGISTRY_CACHE_KEY = 'booking.moduleRegistry.bootstrap';

/** Cap stacked waits so ensureShellRoute / assertShellVisible fail-fast under the 90s test wall. */
const BUDGET = {
  loadingHiddenMs: 8_000,
  spaMountMs: 6_000,
  refreshTokenMs: 5_000,
  userMenuMs: 12_000,
  assertWallMs: 40_000,
  clientNavMs: 12_000,
} as const;

export function mainContent(page: Page) {
  return page.locator('#main-content');
}

export function userMenu(page: Page) {
  return page.locator('header button[class*="userBtn"]');
}

export function captureRegistryBootstrap(page: Page) {
  return page
    .waitForResponse(
      (resp) =>
        resp.url().includes('/tenant/modules/registry/bootstrap') && resp.request().method() === 'GET',
      { timeout: 30_000 },
    )
    .catch(() => null);
}

export async function waitForRegistryBootstrap(page: Page) {
  const hasCache = await page
    .evaluate((key) => Boolean(sessionStorage.getItem(key)), REGISTRY_CACHE_KEY)
    .catch(() => false);
  if (hasCache) return null;
  return captureRegistryBootstrap(page);
}

function assertNotOnLogin(page: Page, where: string) {
  const path = new URL(page.url()).pathname;
  if (path.startsWith('/login')) {
    throw new Error(`${where}: redirected to login (session lost). url=${page.url()}`);
  }
}

async function readBodySnippet(page: Page): Promise<string> {
  return (await page.locator('body').innerText().catch(() => '')).slice(0, 400);
}

async function failWithSnippet(page: Page, where: string, detail: string, cause?: unknown): Promise<never> {
  const bodySnippet = await readBodySnippet(page);
  throw new Error(
    `${where}: ${detail}. url=${page.url()} bodySnippet=${JSON.stringify(bodySnippet)}${
      cause ? ` cause=${String(cause)}` : ''
    }`,
  );
}

/** True when React has mounted chrome or any non-empty body (not Vite empty #root). */
async function isSpaMounted(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const root = document.querySelector('#root');
      if (root && root.childElementCount > 0) return true;
      if (document.querySelector('header')) return true;
      if (document.querySelector('#main-content')) return true;
      return ((document.body?.innerText || '').trim().length > 0);
    });
  } catch (err) {
    // Page closed (test timeout) — surface clearly instead of opaque evaluate error.
    throw new Error(`isSpaMounted: page unavailable (${String(err)}) url=${page.url()}`);
  }
}

/**
 * Wait for SPA mount markers. Prefer #root children / header / #main-content / body text
 * over networkidle (long-lived sockets + Redis-absence noise stall idle forever).
 */
async function waitForSpaMount(page: Page, timeoutMs = BUDGET.spaMountMs): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => {
        const root = document.querySelector('#root');
        if (root && root.childElementCount > 0) return true;
        if (document.querySelector('header')) return true;
        if (document.querySelector('#main-content')) return true;
        return ((document.body?.innerText || '').trim().length > 0);
      },
      undefined,
      { timeout: timeoutMs },
    );
    return true;
  } catch {
    return false;
  }
}

/** Short Loading + SPA mount settle. No networkidle. */
async function settleShellBoot(page: Page) {
  await page
    .getByText(/Loading/i)
    .waitFor({ state: 'hidden', timeout: BUDGET.loadingHiddenMs })
    .catch(() => undefined);
  await waitForSpaMount(page, BUDGET.spaMountMs);
}

/**
 * Progressive Batch A race: blank #root after navigation.
 * Exactly ONE reload (or re-goto), then re-settle; fail-closed if still blank.
 */
async function recoverBlankShellOnce(page: Page, pathHint?: string): Promise<void> {
  if (await isSpaMounted(page)) return;

  const before = await readBodySnippet(page);
  const path = pathHint ?? new URL(page.url()).pathname;
  const normalized = path.startsWith('/') ? path : `/${path}`;

  const currentPath = new URL(page.url()).pathname;
  if (currentPath === normalized || currentPath.startsWith(`${normalized}/`) || !pathHint) {
    await page.reload({ waitUntil: 'domcontentloaded' });
  } else {
    await page.goto(normalized, { waitUntil: 'domcontentloaded' });
  }

  await settleShellBoot(page);
  assertNotOnLogin(page, `recoverBlankShellOnce(${normalized})`);

  if (!(await isSpaMounted(page))) {
    throw new Error(
      `recoverBlankShellOnce: SPA still blank after one recovery. url=${page.url()} before=${JSON.stringify(before)} after=${JSON.stringify(await readBodySnippet(page))}`,
    );
  }
}

function isDashboardPath(pathname: string): boolean {
  return pathname === '/' || pathname === '' || pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

/**
 * Client-side hop to Dashboard when a shell session already exists.
 * Avoids page.goto('/dashboard') blank-SPA races under Progressive Batch A load.
 */
export async function navigateToDashboardShell(page: Page) {
  assertNotOnLogin(page, 'navigateToDashboardShell');

  if (!isDashboardPath(new URL(page.url()).pathname)) {
    const dashLink = page
      .getByRole('navigation')
      .getByRole('link', { name: /^(Dashboard|لوحة التحكم)$/i })
      .or(page.locator('nav a[href="/"], nav a[href="/dashboard"]'))
      .first();
    try {
      await expect(dashLink).toBeVisible({ timeout: BUDGET.clientNavMs });
      await dashLink.click();
      await page.waitForURL(
        (url) => isDashboardPath(url.pathname),
        { timeout: BUDGET.clientNavMs },
      );
    } catch (err) {
      await failWithSnippet(page, 'navigateToDashboardShell', 'Dashboard nav link navigation failed', err);
    }
  }

  await settleShellBoot(page);
  assertNotOnLogin(page, 'navigateToDashboardShell');

  if (!(await isSpaMounted(page))) {
    await recoverBlankShellOnce(page, '/');
  }

  await assertShellVisible(page, { alreadySettled: true });
}

export async function gotoShellRoute(page: Page, path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  await page.goto(normalized, { waitUntil: 'domcontentloaded' });
  await settleShellBoot(page);
  assertNotOnLogin(page, `gotoShellRoute(${normalized})`);

  if (!(await isSpaMounted(page))) {
    await recoverBlankShellOnce(page, normalized);
  }
}

type AssertShellOptions = {
  /** Skip first settle when caller already settled (avoids stacked budgets). */
  alreadySettled?: boolean;
};

export async function assertShellVisible(page: Page, options: AssertShellOptions = {}) {
  const deadline = Date.now() + BUDGET.assertWallMs;

  if (!options.alreadySettled) {
    await settleShellBoot(page);
  }
  assertNotOnLogin(page, 'assertShellVisible');

  if (!(await isSpaMounted(page))) {
    await recoverBlankShellOnce(page);
  }

  await page
    .waitForFunction(
      () => Boolean(sessionStorage.getItem('booking.refreshToken')),
      undefined,
      { timeout: BUDGET.refreshTokenMs },
    )
    .catch(() => undefined);

  assertNotOnLogin(page, 'assertShellVisible');

  if (!(await isSpaMounted(page))) {
    await failWithSnippet(page, 'assertShellVisible', 'SPA blank after settle (no recovery left)');
  }

  const menu = userMenu(page).or(
    page.getByRole('button', { name: /^(User menu|قائمة المستخدم)$/ }),
  );
  const menuTimeout = Math.max(2_000, Math.min(BUDGET.userMenuMs, deadline - Date.now()));
  try {
    await expect(menu.first()).toBeVisible({ timeout: menuTimeout });
  } catch (err) {
    assertNotOnLogin(page, 'assertShellVisible');
    await failWithSnippet(page, 'assertShellVisible', 'user menu not visible', err);
  }
  await expect(mainContent(page)).toBeVisible({ timeout: 5_000 });
}

/**
 * Hard navigation + shell assert. Prefer navigateToDashboardShell after loginAndShell.
 * Budgets are capped so this path fail-fasts under ~40s (not 90s).
 */
export async function ensureShellRoute(page: Page, path: string) {
  await gotoShellRoute(page, path);
  await assertShellVisible(page, { alreadySettled: true });
}

export async function assertRouteHeading(page: Page, heading: RegExp | string) {
  await expect(mainContent(page).getByRole('heading', { name: heading }).first()).toBeVisible({
    timeout: 30_000,
  });
}

export async function assertRouteNotRendered(page: Page, heading: RegExp | string) {
  await expect(mainContent(page).getByRole('heading', { name: heading })).toHaveCount(0);
}

export async function readRegistryCacheTenant(page: Page): Promise<string | null> {
  return page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { identity?: { tenantId?: string } };
      return parsed.identity?.tenantId ?? null;
    } catch {
      return null;
    }
  }, REGISTRY_CACHE_KEY);
}

export async function readRegistryCacheRaw(page: Page): Promise<string | null> {
  return page.evaluate((key) => sessionStorage.getItem(key), REGISTRY_CACHE_KEY);
}

export function routingPathsFromBootstrap(body: {
  modules: Array<{
    moduleId: string;
    userAccessible: boolean;
    userVisible: boolean;
    extensions: Array<{ kind: string; userVisible?: boolean; payload: { path?: string } }>;
  }>;
}): string[] {
  const paths = new Set<string>();
  for (const mod of body.modules) {
    if (!mod.userAccessible && !mod.userVisible) continue;
    for (const ext of mod.extensions) {
      if (ext.kind !== 'routing' || !ext.payload.path) continue;
      if (ext.userVisible === false) continue;
      paths.add(ext.payload.path.replace(/\*+$/, '').replace(/\/$/, '') || '/');
    }
  }
  return [...paths].sort();
}

export async function countRedirects(page: Page, navigate: () => Promise<void>): Promise<number> {
  let redirects = 0;
  const handler = (resp: { status: () => number }) => {
    if ([301, 302, 303, 307, 308].includes(resp.status())) redirects += 1;
  };
  page.on('response', handler);
  await navigate();
  page.off('response', handler);
  return redirects;
}
