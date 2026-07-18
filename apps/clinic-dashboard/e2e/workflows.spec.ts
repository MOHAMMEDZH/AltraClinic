import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER } from './helpers/demo-credentials';

test.describe('Workflow center smoke', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
      return;
    }
    await login(page, DEMO_OWNER);
  });

  test('overview loads KPIs', async ({ page }) => {
    const overviewResponse = page.waitForResponse(
      (resp) => resp.url().includes('/workflows/overview') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/workflows');
    await overviewResponse;
    await expect(page.getByRole('heading', { name: 'Workflows', level: 1 })).toBeVisible();
  });

  test('tasks page loads kanban', async ({ page }) => {
    await page.goto('/workflows/tasks');
    await expect(page.getByRole('tab', { name: 'My tasks' })).toBeVisible({ timeout: 15_000 });
  });

  test('templates page loads', async ({ page }) => {
    await page.goto('/workflows/templates');
    await expect(page.getByRole('heading', { name: 'Templates', level: 2 })).toBeVisible({ timeout: 15_000 });
  });

  test('builder page loads', async ({ page }) => {
    await page.goto('/workflows/builder');
    await expect(page.getByRole('heading', { name: 'Builder', level: 2 })).toBeVisible({ timeout: 15_000 });
  });
});
