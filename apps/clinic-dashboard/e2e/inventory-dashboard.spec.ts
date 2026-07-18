import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER } from './helpers/demo-credentials';

test.describe('Inventory dashboard smoke', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('owner operations workspace shows banner, KPIs, and quick nav', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/inventory');

    await expect(page.getByRole('heading', { name: 'Inventory overview' })).toBeVisible();
    await expect(
      page.getByText(
        'Operations workspace — full visibility across stock, procurement, and inventory administration.',
      ),
    ).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Inventory workspaces' })).toBeVisible();
    const workspaces = page.getByRole('navigation', { name: 'Inventory workspaces' });
    await expect(workspaces.getByRole('link', { name: 'Catalog', exact: true })).toBeVisible();
    await expect(workspaces.getByRole('link', { name: 'Procurement', exact: true })).toBeVisible();
    await expect(workspaces.getByRole('link', { name: 'Analytics', exact: true })).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Operations queue' })).toBeVisible();
    await expect(page.getByText('Total SKUs')).toBeVisible();
  });

  test('dashboard low-stock KPI navigates to filtered catalog', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/inventory');

    await page.getByRole('button', { name: 'Low stock' }).click();
    await expect(page).toHaveURL(/\/inventory\/catalog\?stock=low/);
    await expect(page.getByRole('button', { name: 'Low stock', pressed: true })).toBeVisible();
  });
});
