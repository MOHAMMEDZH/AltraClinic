import { expect, type Page } from '@playwright/test';

export function dashboardRegion(page: Page) {
  return page.locator('#dashboard-region');
}

export async function gotoDashboard(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  const region = dashboardRegion(page);
  if (!(await region.isVisible().catch(() => false))) {
    await page.locator('nav a[href="/"]').first().click();
    await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 15_000 });
  }
  await waitForDashboardLoaded(page);
}

export async function waitForDashboardLoaded(page: Page) {
  const region = dashboardRegion(page);
  await expect(region).toBeVisible({ timeout: 30_000 });
  await region.locator('[aria-busy="true"]').waitFor({ state: 'detached', timeout: 45_000 }).catch(() => undefined);
  await region.locator('section').first().waitFor({ state: 'visible', timeout: 45_000 }).catch(() => undefined);
}

export async function dashboardWidgetTitles(page: Page): Promise<string[]> {
  const region = dashboardRegion(page);
  const titles = region.locator('section h2');
  const count = await titles.count();
  const result: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const text = await titles.nth(i).innerText();
    if (text.trim()) result.push(text.trim());
  }
  return result;
}

export async function assertDashboardWidgetVisible(page: Page, titlePattern: RegExp | string) {
  await expect(dashboardRegion(page).getByRole('heading', { name: titlePattern }).first()).toBeVisible({
    timeout: 30_000,
  });
}

export async function assertDashboardWidgetHidden(page: Page, titlePattern: RegExp | string) {
  await expect(dashboardRegion(page).getByRole('heading', { name: titlePattern })).toHaveCount(0);
}

export async function countDashboardWidgets(page: Page): Promise<number> {
  return dashboardRegion(page).locator('section').count();
}

export function dashboardAccessibleResourcesFromBootstrap(body: {
  modules: Array<{
    moduleId: string;
    userAccessible: boolean;
    userVisible: boolean;
    lockReason?: string;
    extensions: Array<{
      kind: string;
      userVisible?: boolean;
      payload: { resourceId?: string; userAccessible?: boolean };
    }>;
  }>;
}): string[] {
  const resources = new Set<string>();
  for (const mod of body.modules) {
    if (!mod.userVisible) continue;
    for (const ext of mod.extensions) {
      const resourceId = ext.payload?.resourceId;
      if (!resourceId) continue;
      if (ext.userVisible && ext.payload.userAccessible === true) {
        resources.add(resourceId);
      }
    }
  }
  return [...resources].sort();
}

export async function captureDashboardOverviewRequest(page: Page) {
  return page
    .waitForResponse(
      (resp) => resp.url().includes('/dashboard/overview') && resp.request().method() === 'GET',
      { timeout: 30_000 },
    )
    .catch(() => null);
}

export async function assertNoDuplicateOverviewRequests(page: Page, action: () => Promise<void>) {
  const urls: string[] = [];
  const handler = (resp: import('@playwright/test').Response) => {
    if (resp.url().includes('/dashboard/overview') && resp.request().method() === 'GET') {
      urls.push(resp.url());
    }
  };
  page.on('response', handler);
  await action();
  await page.waitForTimeout(1_500);
  page.off('response', handler);
  const unique = new Set(urls);
  expect(unique.size).toBeLessThanOrEqual(2);
}
