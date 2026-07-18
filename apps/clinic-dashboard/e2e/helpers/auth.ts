import type { Page } from '@playwright/test';
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
}

const userMenuButton = (page: Page) => page.locator('header button[class*="userBtn"]');

export async function login(page: Page, credentials: LoginCredentials, options: LoginOptions = {}) {
  const { requireAppShell = true } = options;

  await page.goto('/login');
  const loginForm = page.locator('form').first();
  await loginForm.waitFor({ timeout: 20_000 });
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
    throw new Error(`Login API returned ${response.status()}`);
  }

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });

  if (requireAppShell) {
    await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
    await expect(userMenuButton(page)).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  }
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
