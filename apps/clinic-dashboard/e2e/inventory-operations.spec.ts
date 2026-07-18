import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import {
  DEMO_BATCH_LOT,
  DEMO_INVENTORY_MANAGER,
  DEMO_INVENTORY_MASK_SKU,
  DEMO_INVENTORY_SKU,
  DEMO_OWNER,
  DEMO_STOCK_COUNT_NUMBER,
  DEMO_TRANSFER_NUMBER,
  DEMO_WAREHOUSE_MAIN_CODE,
  DEMO_WAREHOUSE_PROC_CODE,
} from './helpers/demo-credentials';

test.describe('Inventory locations and expiry smoke', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('inventory manager sees seeded warehouse locations', async ({ page }) => {
    await login(page, DEMO_INVENTORY_MANAGER);
    await page.goto('/inventory/warehouses');

    await expect(page.getByRole('heading', { name: 'Locations' })).toBeVisible();
    await expect(page.getByRole('cell', { name: new RegExp(DEMO_WAREHOUSE_MAIN_CODE) })).toBeVisible();
    await expect(page.getByRole('cell', { name: new RegExp(DEMO_WAREHOUSE_PROC_CODE) })).toBeVisible();
  });

  test('owner expiry dashboard lists seeded expiring batch', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/inventory/expiry');

    await expect(page.getByRole('heading', { name: 'Expiry dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Expiring soon', pressed: true })).toBeVisible();
    await expect(page.getByText(DEMO_BATCH_LOT)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: new RegExp(DEMO_INVENTORY_MASK_SKU) })).toBeVisible();
  });
});

test.describe('Inventory transfer and cycle count workflows', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('dashboard open transfers KPI deep-links to transfers list', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/inventory');

    const openTransfers = page.getByRole('button', { name: 'Transfers in transit' });
    await expect(openTransfers).toBeVisible();
    await expect(openTransfers.locator('strong')).not.toHaveText('0');

    await openTransfers.click();
    await expect(page).toHaveURL(/\/inventory\/transfers/);
  });

  test('inventory manager receives in-transit stock transfer', async ({ page }) => {
    await login(page, DEMO_INVENTORY_MANAGER);
    await page.goto('/inventory/transfers?status=IN_TRANSIT');

    const transferRow = page.getByRole('row').filter({ hasText: DEMO_TRANSFER_NUMBER });
    await expect(transferRow).toBeVisible();

    await transferRow.getByRole('button', { name: 'View' }).click();
    const detailDialog = page.getByRole('dialog');
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.getByText('Status: In transit')).toBeVisible();

    await detailDialog.getByRole('button', { name: 'Receive' }).click();
    await expect(page.getByRole('heading', { name: 'Receive transfer line' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Receive transfer line' }) }).getByRole('button', { name: 'Receive' }).click();

    await expect(detailDialog.getByText('Status: Received')).toBeVisible({ timeout: 10_000 });
    await expect(detailDialog.getByText(`10/10`)).toBeVisible();
  });

  test('owner approves pending cycle count variance', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/inventory/stock-counts?status=PENDING_APPROVAL');

    const countRow = page.getByRole('row').filter({ hasText: DEMO_STOCK_COUNT_NUMBER });
    await expect(countRow).toBeVisible();

    await countRow.getByRole('button', { name: 'View' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Status: Pending approval')).toBeVisible();
    await expect(dialog.getByText(DEMO_INVENTORY_SKU)).toBeVisible();

    await dialog.getByRole('button', { name: 'Approve & apply' }).click();
    await expect(dialog.getByText('Status: Approved')).toBeVisible({ timeout: 10_000 });
  });
});
