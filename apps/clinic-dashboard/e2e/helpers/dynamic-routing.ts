import { expect, type Page } from '@playwright/test';

const REGISTRY_CACHE_KEY = 'booking.moduleRegistry.bootstrap';

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

/** True when React has mounted chrome or any non-empty body (not Vite empty #root). */
async function isSpaMounted(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.querySelector('#root');
    if (root && root.childElementCount > 0) return true;
    if (document.querySelector('header')) return true;
    if (document.querySelector('#main-content')) return true;
    return ((document.body?.innerText || '').trim().length > 0);
  });
}

/**
 * Wait for SPA mount markers. Prefer #root children / header / #main-content / body text
 * over networkidle (long-lived sockets + Redis-absence noise stall idle forever).
 */
async function waitForSpaMount(page: Page, timeoutMs = 20_000): Promise<boolean> {
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

/** Wait for Loading chrome to clear + SPA mount. Does not require networkidle. */
async function settleShellBoot(page: Page) {
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  await page.waitForLoadState('load', { timeout: 10_000 }).catch(() => undefined);
  await waitForSpaMount(page, 20_000);
}

/**
 * Progressive Batch A race: known-good session navigates to a blank #root.
 * Exactly ONE reload (or re-goto), then re-settle; fail-closed if still blank.
 */
async function recoverBlankShellOnce(page: Page, pathHint?: string): Promise<void> {
  if (await isSpaMounted(page)) return;

  const before = await readBodySnippet(page);
  const path = pathHint ?? new URL(page.url()).pathname;
  const normalized = path.startsWith('/') ? path : `/${path}`;

  // Prefer reload to keep sessionStorage; fall back to re-goto if URL drifted.
  const currentPath = new URL(page.url()).pathname;
  if (currentPath === normalized || currentPath.startsWith(`${normalized}/`) || !pathHint) {
    await page.reload({ waitUntil: 'domcontentloaded' });
  } else {
    await page.goto(normalized, { waitUntil: 'domcontentloaded' });
  }

  await settleShellBoot(page);
  assertNotOnLogin(page, `recoverBlankShellOnce(${normalized})`);

  if (!(await isSpaMounted(page))) {
    const after = await readBodySnippet(page);
    throw new Error(
      `recoverBlankShellOnce: SPA still blank after one recovery. url=${page.url()} before=${JSON.stringify(before)} after=${JSON.stringify(after)}`,
    );
  }
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

export async function assertShellVisible(page: Page) {
  await settleShellBoot(page);
  assertNotOnLogin(page, 'assertShellVisible');

  // Blank SPA after a prior known-good shell: one recovery, then fail-closed.
  if (!(await isSpaMounted(page))) {
    await recoverBlankShellOnce(page);
  }

  await page
    .waitForFunction(
      () => Boolean(sessionStorage.getItem('booking.refreshToken')),
      undefined,
      { timeout: 20_000 },
    )
    .catch(() => undefined);

  // AuthProvider may still be redeeming refresh → me; settle again then fail-closed on /login.
  await settleShellBoot(page);
  assertNotOnLogin(page, 'assertShellVisible');

  if (!(await isSpaMounted(page))) {
    const bodySnippet = await readBodySnippet(page);
    throw new Error(
      `assertShellVisible: SPA blank after settle (no recovery left). url=${page.url()} bodySnippet=${JSON.stringify(bodySnippet)}`,
    );
  }

  // Header mounts before the labeled user-menu control — wait for chrome first.
  await page.locator('header').first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => undefined);

  const menu = userMenu(page).or(
    page.getByRole('button', { name: /^(User menu|قائمة المستخدم)$/ }),
  );
  try {
    await expect(menu.first()).toBeVisible({ timeout: 30_000 });
  } catch (err) {
    assertNotOnLogin(page, 'assertShellVisible');
    const bodySnippet = await readBodySnippet(page);
    throw new Error(
      `assertShellVisible: user menu not visible. url=${page.url()} bodySnippet=${JSON.stringify(bodySnippet)} cause=${String(err)}`,
    );
  }
  await expect(mainContent(page)).toBeVisible();
}

/** gotoShellRoute + assertShellVisible (blank-SPA recovery lives in both helpers). */
export async function ensureShellRoute(page: Page, path: string) {
  await gotoShellRoute(page, path);
  await assertShellVisible(page);
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
