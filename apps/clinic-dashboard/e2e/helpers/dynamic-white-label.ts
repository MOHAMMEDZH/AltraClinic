import { expect, type Page } from '@playwright/test';
import type { LoginCredentials } from './auth';

export const WHITE_LABEL_ROLLBACK_BASE =
  process.env.PLAYWRIGHT_WHITE_LABEL_ROLLBACK_URL ?? 'http://127.0.0.1:5178';

export function brandingPageHeading(page: Page) {
  return page.getByRole('heading', { name: 'Branding', level: 2 });
}

export function brandingPrimaryColorInput(page: Page) {
  return page.locator('#primary-color');
}

export function brandingThemeSelect(page: Page) {
  return page.locator('#theme-pref');
}

export function lockedBrandingPanel(page: Page) {
  return page.getByText(/Custom branding/i);
}

export async function gotoBrandingRoute(page: Page) {
  await page.goto('/settings/branding', { waitUntil: 'domcontentloaded' });
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  const path = new URL(page.url()).pathname;
  if (path.startsWith('/login')) {
    throw new Error(`gotoBrandingRoute redirected to login (session lost). url=${page.url()}`);
  }
}

export async function gotoBrandingSettings(page: Page) {
  await gotoBrandingRoute(page);
  await waitForBrandingLoaded(page);
}

export async function gotoSettingsHome(page: Page) {
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  await expect(page.getByRole('heading', { name: /Settings/i }).first()).toBeVisible({ timeout: 30_000 });
}

export async function waitForBrandingLoaded(page: Page) {
  await expect(
    brandingPageHeading(page)
      .or(lockedBrandingPanel(page))
      .or(page.getByText(/do not have permission|access denied|ليس لديك/i))
      .first(),
  ).toBeVisible({ timeout: 30_000 });
}

export async function readCssVariable(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (varName) => getComputedStyle(document.documentElement).getPropertyValue(varName).trim(),
    name,
  );
}

export async function readDataTheme(page: Page): Promise<string | null> {
  return page.evaluate(() => document.documentElement.getAttribute('data-theme'));
}

export async function readSidebarWidth(page: Page): Promise<string> {
  return readCssVariable(page, '--sidebar-width');
}

export async function assertBrandingFormAccessible(page: Page) {
  await expect(brandingPrimaryColorInput(page)).toBeVisible({ timeout: 30_000 });
  await expect(brandingThemeSelect(page)).toBeVisible();
}

export async function assertBrandingLocked(page: Page) {
  await expect(lockedBrandingPanel(page)).toBeVisible({ timeout: 30_000 });
  const input = brandingPrimaryColorInput(page);
  if ((await input.count()) === 0) return;
  const blocked = await input.evaluate((el) => {
    let node: HTMLElement | null = el;
    while (node) {
      if (getComputedStyle(node).pointerEvents === 'none') return true;
      node = node.parentElement;
    }
    return (el as HTMLInputElement).disabled;
  });
  expect(blocked).toBe(true);
}

/** Roles without `api.settings` update cannot edit branding (fail-closed). */
export async function assertBrandingEditRestricted(page: Page) {
  await expect(brandingPrimaryColorInput(page)).toHaveCount(0);
}

export async function toggleThemeFromShell(page: Page) {
  const themeBtn = page.getByRole('button', { name: /Theme/i });
  await themeBtn.click();
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

export function accessibleWhiteLabelSurfaceIdsFromBootstrap(body: {
  modules: Array<{
    moduleId: string;
    userAccessible: boolean;
    userVisible: boolean;
    extensions: Array<{
      kind: string;
      userVisible?: boolean;
      userAccessible?: boolean;
      payload: {
        surfaceId?: string;
        requiredFeature?: string;
        userAccessible?: boolean;
      };
    }>;
  }>;
}): string[] {
  const ids = new Set<string>();
  for (const mod of body.modules) {
    for (const ext of mod.extensions) {
      if (ext.kind !== 'whiteLabel') continue;
      if (!isExtensionAccessible(mod, ext)) continue;
      const surfaceId = ext.payload?.surfaceId;
      if (surfaceId) ids.add(surfaceId);
    }
  }
  return [...ids].sort();
}

export function countWhiteLabelExtensionsFromBootstrap(body: {
  modules: Array<{ extensions: Array<{ kind: string }> }>;
}): number {
  let count = 0;
  for (const mod of body.modules) {
    for (const ext of mod.extensions) {
      if (ext.kind === 'whiteLabel') count += 1;
    }
  }
  return count;
}

export function whiteLabelSurfacesByFeatureFromBootstrap(
  body: Parameters<typeof accessibleWhiteLabelSurfaceIdsFromBootstrap>[0],
  featureId: string,
): string[] {
  const ids = new Set<string>();
  for (const mod of body.modules) {
    for (const ext of mod.extensions) {
      if (ext.kind !== 'whiteLabel') continue;
      if (!isExtensionAccessible(mod, ext)) continue;
      if (ext.payload?.requiredFeature !== featureId) continue;
      if (ext.payload?.surfaceId) ids.add(ext.payload.surfaceId);
    }
  }
  return [...ids].sort();
}

export async function loginOnWhiteLabelRollbackBase(
  page: Page,
  baseUrl: string,
  credentials: LoginCredentials & { tenantId: string },
) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  const form = page.locator('form').first();
  await form.waitFor({ timeout: 20_000 });
  await form.locator('input[autocomplete="organization"]').fill(credentials.tenantId);
  await form.locator('input[type="email"]').fill(credentials.email);
  await form.locator('input[type="password"]').fill(credentials.password);
  await form.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
}

export async function isWhiteLabelRollbackServerUp(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(WHITE_LABEL_ROLLBACK_BASE, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}
