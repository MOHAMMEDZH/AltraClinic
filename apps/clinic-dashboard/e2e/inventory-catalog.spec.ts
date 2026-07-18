import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login, gotoInventory } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import {
  DEMO_INVENTORY_BARCODE,
  DEMO_INVENTORY_MANAGER,
  DEMO_INVENTORY_SKU,
  DEMO_OWNER,
} from './helpers/demo-credentials';

test.describe('Inventory catalog smoke', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('owner operations workspace loads catalog with receive scan and bulk export', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await gotoInventory(page, '/inventory/catalog');

    await expect(page.getByRole('heading', { name: 'Inventory catalog' })).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(
        'Operations workspace — full catalog control, bulk actions, and tenant-wide inventory administration.',
      ),
    ).toBeVisible();
    await expect(page.locator('#inv-barcode-panel')).toBeVisible();
    await expect(page.locator('#inv-catalog-region')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Receive by scan' })).toBeVisible();

    await expect(page.getByRole('link', { name: DEMO_INVENTORY_SKU })).toBeVisible();

    await page.getByLabel('Select all on page').check();
    await expect(page.getByRole('toolbar', { name: 'Bulk selection actions' })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  });

  test('owner receive-by-scan opens stock-in dialog for seeded barcode', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await gotoInventory(page, '/inventory/catalog?scan=1&receive=1');

    await expect(page.getByRole('heading', { name: 'Receive by scan' })).toBeVisible();
    await page.getByLabel('Scan item to receive stock…').fill(DEMO_INVENTORY_BARCODE);
    await page.getByRole('button', { name: 'Open receive' }).click();

    await expect(page.getByRole('heading', { name: 'Stock in' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Quantity to receive')).toBeVisible();
  });

  test('inventory manager sees management workspace without bulk archive', async ({ page }) => {
    await login(page, DEMO_INVENTORY_MANAGER);
    await page.goto('/inventory/catalog');

    await expect(page.getByRole('heading', { name: 'Stock catalog' })).toBeVisible();
    await expect(
      page.getByText('Management workspace — procurement, receiving, counts, and stock control'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Receive' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Archive selected' })).toHaveCount(0);

    await page.getByLabel('Select all on page').check();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Archive selected' })).toHaveCount(0);
  });

  test('catalog scanner and grid pass axe accessibility rules', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/inventory/catalog');
    await page.locator('#inv-catalog-region').waitFor({ state: 'visible' });

    const results = await new AxeBuilder({ page })
      .include('#inv-barcode-panel')
      .include('#inv-catalog-region')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('virtualized grid supports arrow-key row navigation', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/inventory/catalog');
    await page.locator('#inv-catalog-region').waitFor({ state: 'visible' });

    await page.locator('[role="rowgroup"]').focus();
    const focusedRow = page.locator('[role="row"][tabindex="0"]');
    await expect(focusedRow).toBeFocused();
    await expect(focusedRow).toContainText(DEMO_INVENTORY_SKU);

    await page.keyboard.press('End');
    await expect(focusedRow).toBeFocused();
    await expect(focusedRow).toContainText('SYR-5ML');
  });

  test('empty catalog with active filters offers clear-filters recovery', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/inventory/catalog');

    await expect(page.getByRole('link', { name: DEMO_INVENTORY_SKU })).toBeVisible();

    await page.getByLabel('Search SKU, barcode, name, brand, or lot…').fill('zzzzzznomatch');
    await expect(page.getByRole('heading', { name: 'No items match your filters.' })).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.getByLabel('Active filters')).toBeVisible();
    await page.getByLabel('Active filters').getByRole('button', { name: 'Clear filters' }).click();

    await expect(page.getByRole('link', { name: DEMO_INVENTORY_SKU })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Active filters')).toHaveCount(0);
  });
});
