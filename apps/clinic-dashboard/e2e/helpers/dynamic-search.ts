import { expect, type Page } from '@playwright/test';

const REGISTRY_CACHE_KEY = 'booking.moduleRegistry.bootstrap';

export const SEARCH_ROLLBACK_BASE =
  process.env.PLAYWRIGHT_SEARCH_ROLLBACK_URL ?? 'http://127.0.0.1:5175';

export function globalSearchDialog(page: Page) {
  return page.locator('[role="dialog"]').filter({ has: page.getByRole('listbox') });
}

export function globalSearchInput(page: Page) {
  return globalSearchDialog(page).getByRole('searchbox');
}

export async function openGlobalSearch(page: Page) {
  const dialog = globalSearchDialog(page);
  if (await dialog.isVisible().catch(() => false)) return;

  await page.keyboard.press('Control+K');
  if (await dialog.isVisible().catch(() => false)) return;

  const topSearch = page.locator('header input[type="search"][readonly]').first();
  await topSearch.click({ force: true, timeout: 5_000 });

  await expect(dialog).toBeVisible({ timeout: 10_000 });
}

export async function closeGlobalSearch(page: Page) {
  await page.keyboard.press('Escape');
  await expect(globalSearchDialog(page)).toBeHidden({ timeout: 5_000 });
}

export async function performGlobalSearch(page: Page, query: string) {
  const searchResponse = page.waitForResponse(
    (resp) => resp.url().includes('/search') && resp.request().method() === 'GET',
    { timeout: 25_000 },
  );
  await globalSearchInput(page).fill(query);
  const response = await searchResponse;
  return response;
}

export function executableSearchTypesFromBootstrap(body: {
  modules: Array<{
    userAccessible: boolean;
    userVisible: boolean;
    extensions: Array<{
      kind: string;
      userVisible?: boolean;
      userAccessible?: boolean;
      payload: { entityType?: string; searchScope?: string };
    }>;
  }>;
}): string[] {
  const types = new Set<string>();
  for (const mod of body.modules) {
    if (!mod.userVisible) continue;
    for (const ext of mod.extensions) {
      if (ext.kind !== 'search') continue;
      if (ext.payload.searchScope !== 'executable') continue;
      if (!ext.payload.entityType) continue;
      const accessible =
        typeof ext.userAccessible === 'boolean'
          ? ext.userAccessible
          : mod.userAccessible && ext.userVisible !== false;
      if (!accessible) continue;
      types.add(ext.payload.entityType);
    }
  }
  return [...types].sort();
}

export function parseSearchTypesParam(url: string): string[] {
  const parsed = new URL(url, 'http://localhost');
  const types = parsed.searchParams.get('types');
  return types ? types.split(',').filter(Boolean).sort() : [];
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

export async function assertSearchDialogEmptyState(page: Page) {
  await expect(
    globalSearchDialog(page).getByText(/type to search|start typing|search patients|ابدأ|اكتب/i),
  ).toBeVisible();
}

export async function assertSearchNoAccess(page: Page) {
  await expect(globalSearchDialog(page).getByText(/no access|permission/i)).toBeVisible();
}

export async function loginOnRollbackBase(
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

export async function isSearchRollbackServerUp(): Promise<boolean> {
  return fetch(SEARCH_ROLLBACK_BASE, { signal: AbortSignal.timeout(10_000) })
    .then((r) => r.ok)
    .catch(() => false);
}
