import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_DOCTOR, DEMO_GENERAL_MANAGER } from './helpers/demo-credentials';

test.describe('EMR / Encounters module', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('encounters list loads for doctor', async ({ page }) => {
    await login(page, DEMO_DOCTOR);

    const listResponse = page.waitForResponse(
      (resp) => resp.url().includes('/emr/encounters') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/encounters');
    await listResponse;

    await expect(page.locator('#encounters-region')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Clinical Records', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New encounter' })).toBeVisible();
  });

  test('manager view shows operations overview badge', async ({ page }) => {
    await login(page, DEMO_GENERAL_MANAGER);
    await page.goto('/encounters');
    await expect(page.locator('#encounters-region')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Operations overview')).toBeVisible();
  });

  test('encounter detail shows SOAP tabs and lifecycle actions', async ({ page }) => {
    await login(page, DEMO_DOCTOR);

    const listResponse = page.waitForResponse(
      (resp) => resp.url().includes('/emr/encounters') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/encounters');
    await listResponse;
    await expect(page.locator('#encounters-region')).toBeVisible({ timeout: 15_000 });

    const firstOpen = page.locator('#encounters-region table tbody a[href*="/encounters/"]').first();
    await expect(firstOpen).toBeVisible({ timeout: 10_000 });
    await firstOpen.click();

    await expect(page).toHaveURL(/\/encounters\/.+/);
    await expect(page.locator('#encounters-detail-region')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Clinical notes|notes/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Timeline/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save documentation' })).toBeVisible();
  });

  test('seeded encounter detail loads from direct URL', async ({ page }) => {
    await login(page, DEMO_DOCTOR);
    const detailResponse = page.waitForResponse(
      (resp) => resp.url().includes('/emr/encounters/e1000000') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/encounters/e1000000-0000-4000-8000-000000000001');
    await detailResponse;
    await expect(page.locator('#encounters-detail-region')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Sarah|Hassan/i);
  });
});
