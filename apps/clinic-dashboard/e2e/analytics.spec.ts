import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER } from './helpers/demo-credentials';

test.describe('Clinic analytics page', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('analytics hub loads executive summary from live overview', async ({ page }) => {
    await login(page, DEMO_OWNER);
    const overviewResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/analytics/overview') &&
        resp.request().method() === 'GET' &&
        resp.ok(),
      { timeout: 20_000 },
    );
    await page.goto('/analytics');
    await overviewResponse;
    await page.locator('#analytics-region').waitFor({ state: 'visible' });

    await expect(page.getByRole('heading', { name: 'Analytics hub', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Executive summary', level: 2 })).toBeVisible();
    await expect(page.getByText('Live API unavailable — displaying sample metrics.')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Analytics domains', level: 2 })).toBeVisible();
  });

  test('navigates to financial domain dashboard', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/analytics');
    await page.locator('#analytics-region').waitFor({ state: 'visible' });

    await page.getByRole('button', { name: /Financial analytics/i }).first().click();
    await expect(page).toHaveURL(/\/analytics\/financial/);
    await expect(page.getByRole('heading', { name: 'Financial analytics', level: 1 })).toBeVisible();
  });

  test('executive dashboard remains available at dedicated route', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/analytics/executive');
    await page.locator('#analytics-region').waitFor({ state: 'visible' });

    await expect(page.getByRole('heading', { name: 'Executive dashboard', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Revenue analytics', level: 2 })).toBeVisible();
  });

  test('dashboard builder page loads for owner', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/analytics/builder');
    await expect(page.getByRole('heading', { name: 'Analytics dashboard builder', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save layout' })).toBeVisible();
  });

  test('export center page loads quick export actions', async ({ page }) => {
    await login(page, DEMO_OWNER);
    const overviewResponse = page.waitForResponse(
      (resp) => resp.url().includes('/analytics/overview') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/analytics/export');
    await overviewResponse;

    await expect(page.getByRole('heading', { name: 'Analytics export center', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export PDF' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print dashboard' })).toBeVisible();
  });

  test('dashboard revenue chart links to analytics', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/');
    await page.locator('#dashboard-region').waitFor({ state: 'visible' });

    await page
      .getByRole('heading', { name: 'Daily revenue trend', level: 2 })
      .locator('xpath=ancestor::section[1]')
      .getByRole('link', { name: 'View all' })
      .click();

    await expect(page).toHaveURL(/\/analytics/);
  });

  test('reports hub links to analytics for owner', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/reports');

    await page.getByRole('link', { name: 'Clinic analytics' }).click();
    await expect(page).toHaveURL(/\/analytics/);
  });
});
