import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER } from './helpers/demo-credentials';

test.describe('Reporting module', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('reporting home loads catalog and navigation', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reporting', level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Report builder' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Export center' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Report catalog', level: 2 })).toBeVisible();
  });

  test('export center lists tabs', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/reports/export');
    await expect(page.getByRole('heading', { name: 'Export center', level: 1 })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Analytics exports' })).toBeVisible();
  });

  test('report builder shows field builder and preview', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/reports/builder');
    await expect(page.getByRole('heading', { name: 'Report builder', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fields & measures', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Live preview', level: 2 })).toBeVisible();
  });

  test('category page loads billing reports', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/reports/category/billing');
    await expect(page.getByRole('heading', { name: /billing/i })).toBeVisible();
  });
});
