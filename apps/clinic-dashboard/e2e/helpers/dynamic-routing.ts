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

export async function gotoShellRoute(page: Page, path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  await page.goto(normalized, { waitUntil: 'domcontentloaded' });
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
}

export async function assertShellVisible(page: Page) {
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  await page
    .waitForFunction(
      () => Boolean(sessionStorage.getItem('booking.refreshToken')),
      undefined,
      { timeout: 20_000 },
    )
    .catch(() => undefined);
  const path = new URL(page.url()).pathname;
  if (path.startsWith('/login')) {
    throw new Error(`assertShellVisible: redirected to login (session lost). url=${page.url()}`);
  }
  const menu = userMenu(page).or(
    page.getByRole('button', { name: /^(User menu|قائمة المستخدم)$/ }),
  );
  await expect(menu.first()).toBeVisible({ timeout: 30_000 });
  await expect(mainContent(page)).toBeVisible();
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
