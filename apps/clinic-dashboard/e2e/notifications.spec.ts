import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER } from './helpers/demo-credentials';

test.describe('Notifications center smoke', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
      return;
    }
    await login(page, DEMO_OWNER);
  });

  test('overview loads KPIs', async ({ page }) => {
    const overviewResponse = page.waitForResponse(
      (resp) => resp.url().includes('/notifications/overview') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/settings/notifications');
    await overviewResponse;
    await expect(page.getByRole('heading', { name: 'Notification center', level: 1 })).toBeVisible();
  });

  test('inbox lists notifications', async ({ page }) => {
    await page.goto('/settings/notifications/inbox');
    await expect(page.getByRole('heading', { name: 'Inbox', level: 2 })).toBeVisible({ timeout: 15_000 });
  });

  test('templates page loads for managers', async ({ page }) => {
    await page.goto('/settings/notifications/templates');
    await expect(page.getByRole('heading', { name: 'Templates', level: 2 })).toBeVisible({ timeout: 15_000 });
  });

  test('bell panel opens from top nav', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Notifications/i }).click();
    await expect(page.getByRole('link', { name: /View all/i })).toBeVisible({ timeout: 10_000 });
  });
});
