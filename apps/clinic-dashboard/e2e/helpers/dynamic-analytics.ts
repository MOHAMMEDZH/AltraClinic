import { expect, type Page } from '@playwright/test';

export const ANALYTICS_ROLLBACK_BASE =
  process.env.PLAYWRIGHT_ANALYTICS_ROLLBACK_URL ?? 'http://127.0.0.1:5177';

const HUB_LOCAL_IDS = new Set(['catalog', 'builder', 'export-center']);

export function analyticsRegion(page: Page) {
  return page.locator('#analytics-region');
}

export function analyticsDomainsSection(page: Page) {
  return page.locator('section[aria-labelledby="analytics-domains"]');
}

export function analyticsCategoryNav(page: Page) {
  return page.getByRole('navigation', { name: /analytics domains/i });
}

export async function clearAnalyticsPreferences(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('clinic-analytics-favorites');
    localStorage.removeItem('clinic-analytics-recents');
  });
}

export async function gotoAnalyticsHome(page: Page) {
  const analyticsLink = page.getByRole('navigation').getByRole('link', { name: 'Analytics', exact: true });
  if ((await analyticsLink.count()) > 0) {
    await analyticsLink.first().click();
    await page.waitForURL(/\/analytics/, { timeout: 20_000 });
  } else {
    await page.goto('/analytics', { waitUntil: 'domcontentloaded' });
  }
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  await waitForAnalyticsLoaded(page);
}

export async function gotoAnalyticsPath(page: Page, path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized === '/analytics' || normalized === '/analytics/') {
    await gotoAnalyticsHome(page);
    return;
  }

  if (!page.url().includes('/analytics')) {
    await gotoAnalyticsHome(page);
  }

  if (normalized === '/analytics/builder') {
    if (!page.url().includes('/analytics/builder')) {
      const builderLink = page.getByRole('link', { name: /Dashboard builder/i });
      if ((await builderLink.count()) > 0) {
        await builderLink.first().click();
      } else {
        await page.goto(normalized, { waitUntil: 'domcontentloaded' });
      }
    }
  } else if (normalized === '/analytics/export') {
    if (!page.url().includes('/analytics/export')) {
      const exportLink = page.getByRole('link', { name: /Export center/i });
      if ((await exportLink.count()) > 0) {
        await exportLink.first().click();
      } else {
        await page.goto(normalized, { waitUntil: 'domcontentloaded' });
      }
    }
  } else {
    await page.goto(normalized, { waitUntil: 'domcontentloaded' });
  }

  await page.waitForURL((url) => url.pathname.startsWith(normalized.split('?')[0]!), { timeout: 20_000 }).catch(() => undefined);
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);

  const accessDenied = page.getByText(/do not have permission|access denied|ليس لديك/i);
  if (await accessDenied.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
    return;
  }

  await waitForAnalyticsLoaded(page);
}

export async function waitForAnalyticsLoaded(page: Page) {
  const region = analyticsRegion(page);
  if ((await region.count()) > 0) {
    await expect(region).toBeVisible({ timeout: 30_000 });
    await region.locator('[aria-busy="true"]').waitFor({ state: 'detached', timeout: 45_000 }).catch(() => undefined);
    return;
  }

  await expect(
    page
      .getByRole('heading', { name: 'Analytics hub', level: 1 })
      .or(page.getByRole('heading', { name: 'Analytics dashboard builder', level: 1 }))
      .or(page.getByRole('heading', { name: 'Analytics export center', level: 1 }))
      .or(page.getByRole('heading', { name: /analytics/i, level: 1 }))
      .or(page.getByText(/do not have permission|access denied|ليس لديك/i))
      .first(),
  ).toBeVisible({ timeout: 30_000 });
}

export async function analyticsDomainTitles(page: Page): Promise<string[]> {
  const titles = analyticsDomainsSection(page).getByRole('heading', { level: 3 });
  const count = await titles.count();
  const result: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const text = await titles.nth(i).innerText();
    if (text.trim()) result.push(text.trim());
  }
  return result;
}

export async function countAnalyticsDomainCards(page: Page): Promise<number> {
  return analyticsDomainsSection(page).getByRole('heading', { level: 3 }).count();
}

export async function assertAnalyticsDomainContains(page: Page, titlePattern: RegExp | string) {
  await expect(
    analyticsDomainsSection(page).getByRole('heading', { name: titlePattern, level: 3 }).first(),
  ).toBeVisible({ timeout: 30_000 });
}

export async function assertAnalyticsDomainExcludes(page: Page, titlePattern: RegExp | string) {
  await expect(
    analyticsDomainsSection(page).getByRole('heading', { name: titlePattern, level: 3 }),
  ).toHaveCount(0);
}

export async function assertAnalyticsAccessDenied(page: Page) {
  await expect(page.getByText(/do not have permission|access denied|ليس لديك/i)).toBeVisible({
    timeout: 30_000,
  });
}

export async function countBuilderWidgets(page: Page): Promise<number> {
  return page.locator('section[aria-labelledby="builder-form"] h3').count();
}

export async function assertBuilderWidgetContains(page: Page, titlePattern: RegExp | string) {
  await expect(
    page.locator('section[aria-labelledby="builder-form"]').getByRole('heading', { name: titlePattern, level: 3 }).first(),
  ).toBeVisible({ timeout: 30_000 });
}

export async function assertBuilderWidgetExcludes(page: Page, titlePattern: RegExp | string) {
  await expect(
    page.locator('section[aria-labelledby="builder-form"]').getByRole('heading', { name: titlePattern, level: 3 }),
  ).toHaveCount(0);
}

function isExtensionAccessible(
  mod: { userAccessible: boolean; userVisible: boolean },
  ext: { userVisible?: boolean; userAccessible?: boolean; payload?: { userAccessible?: boolean } },
): boolean {
  if (ext.userVisible === false) return false;
  if (typeof ext.userAccessible === 'boolean') return ext.userAccessible;
  if (typeof ext.payload?.userAccessible === 'boolean') return ext.payload.userAccessible;
  return mod.userAccessible && mod.userVisible;
}

export function accessibleAnalyticsDomainIdsFromBootstrap(body: {
  modules: Array<{
    moduleId: string;
    userAccessible: boolean;
    userVisible: boolean;
    extensions: Array<{
      kind: string;
      userVisible?: boolean;
      userAccessible?: boolean;
      payload: {
        analyticsKind?: string;
        localId?: string;
        userAccessible?: boolean;
      };
    }>;
  }>;
}): string[] {
  const ids = new Set<string>();
  for (const mod of body.modules) {
    if (!mod.userVisible) continue;
    for (const ext of mod.extensions) {
      if (ext.kind !== 'analytics') continue;
      if (ext.payload?.analyticsKind !== 'domain') continue;
      const domainId = ext.payload.localId;
      if (!domainId) continue;
      if (!isExtensionAccessible(mod, ext)) continue;
      ids.add(domainId);
    }
  }
  return [...ids].sort();
}

export function accessibleAnalyticsWidgetIdsFromBootstrap(body: {
  modules: Array<{
    userAccessible: boolean;
    userVisible: boolean;
    extensions: Array<{
      kind: string;
      userVisible?: boolean;
      userAccessible?: boolean;
      payload: {
        analyticsKind?: string;
        widgetCatalogId?: string;
        userAccessible?: boolean;
      };
    }>;
  }>;
}): string[] {
  const ids = new Set<string>();
  for (const mod of body.modules) {
    if (!mod.userVisible) continue;
    for (const ext of mod.extensions) {
      if (ext.kind !== 'analytics') continue;
      if (ext.payload?.analyticsKind !== 'widget') continue;
      const widgetId = ext.payload.widgetCatalogId;
      if (!widgetId) continue;
      if (!isExtensionAccessible(mod, ext)) continue;
      ids.add(widgetId);
    }
  }
  return [...ids].sort();
}

export function accessibleAnalyticsHubIdsFromBootstrap(body: {
  modules: Array<{
    userAccessible: boolean;
    userVisible: boolean;
    extensions: Array<{
      kind: string;
      userVisible?: boolean;
      userAccessible?: boolean;
      payload: {
        analyticsKind?: string;
        localId?: string;
        userAccessible?: boolean;
      };
    }>;
  }>;
}): string[] {
  const ids = new Set<string>();
  for (const mod of body.modules) {
    if (!mod.userVisible) continue;
    for (const ext of mod.extensions) {
      if (ext.kind !== 'analytics') continue;
      if (ext.payload?.analyticsKind !== 'hub') continue;
      const hubId = ext.payload.localId;
      if (!hubId || !HUB_LOCAL_IDS.has(hubId)) continue;
      if (!isExtensionAccessible(mod, ext)) continue;
      ids.add(hubId);
    }
  }
  return [...ids].sort();
}

export function countAnalyticsExtensionsFromBootstrap(body: {
  modules: Array<{ extensions: Array<{ kind: string }> }>;
}): number {
  return body.modules.flatMap((mod) => mod.extensions.filter((ext) => ext.kind === 'analytics')).length;
}

export async function loginOnAnalyticsRollbackBase(
  page: Page,
  baseUrl: string,
  credentials: { tenantId: string; email: string; password: string },
) {
  await page.goto(`${baseUrl}/login`);
  const loginForm = page.locator('form').first();
  await loginForm.waitFor({ timeout: 20_000 });
  await loginForm.locator('input[autocomplete="organization"]').fill(credentials.tenantId);
  await loginForm.locator('input[type="email"]').fill(credentials.email);
  await loginForm.locator('input[type="password"]').fill(credentials.password);
  await loginForm.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

export async function isAnalyticsRollbackServerUp(): Promise<boolean> {
  return fetch(ANALYTICS_ROLLBACK_BASE, { signal: AbortSignal.timeout(10_000) })
    .then((response) => response.ok)
    .catch(() => false);
}
