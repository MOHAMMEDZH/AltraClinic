import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import {
  DEMO_INVENTORY_MANAGER,
  DEMO_OWNER,
  DEMO_PO_APPROVED_NUMBER,
  DEMO_PO_PENDING_NUMBER,
  DEMO_STOCK_REQUEST_APPROVED_NUMBER,
  DEMO_STOCK_REQUEST_NUMBER,
} from './helpers/demo-credentials';

test.describe('Inventory procurement and requests', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('dashboard operations queue reflects seeded pending work', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/inventory');

    const pendingPo = page.getByRole('button', { name: 'POs pending approval' });
    await expect(pendingPo).toBeVisible();
    await expect(pendingPo.locator('strong')).not.toHaveText('0');

    await pendingPo.click();
    await expect(page).toHaveURL(/\/inventory\/procurement\?status=PENDING_APPROVAL/);
  });

  test('owner sees seeded open purchase order and receive action', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/inventory/procurement?status=OPEN');

    const openRow = page.getByRole('row').filter({ hasText: DEMO_PO_APPROVED_NUMBER });
    await expect(openRow).toBeVisible();

    await openRow.getByRole('button', { name: 'View' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Status: Approved')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Receive' })).toBeVisible();
  });

  test('owner approves seeded pending purchase order', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/inventory/procurement?status=PENDING_APPROVAL');

    await expect(page.getByRole('heading', { name: 'Procurement' })).toBeVisible();
    const pendingRow = page.getByRole('row').filter({ hasText: DEMO_PO_PENDING_NUMBER });
    await expect(pendingRow).toBeVisible();

    await pendingRow.getByRole('button', { name: 'View' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Status: Pending approval')).toBeVisible();

    await dialog.getByRole('button', { name: 'Approve' }).click();
    await expect(dialog.getByText('Status: Approved')).toBeVisible({ timeout: 10_000 });
  });

  test('inventory manager approves seeded submitted stock request', async ({ page }) => {
    await login(page, DEMO_INVENTORY_MANAGER);
    await page.goto('/inventory/stock-requests?status=SUBMITTED');

    await expect(page.getByRole('heading', { name: 'Stock requests' })).toBeVisible();
    await expect(
      page.getByText('Management workspace — review pending requests, approve, and issue stock.'),
    ).toBeVisible();

    const requestRow = page.getByRole('row').filter({ hasText: DEMO_STOCK_REQUEST_NUMBER });
    await expect(requestRow).toBeVisible();

    await requestRow.getByRole('button', { name: 'View' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Submitted', { exact: true })).toBeVisible();

    await dialog.getByRole('button', { name: 'Approve' }).click();
    await expect(dialog.getByText('Approved', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('inventory manager receives goods against approved purchase order', async ({ page }) => {
    await login(page, DEMO_INVENTORY_MANAGER);
    await page.goto('/inventory/procurement?status=OPEN');

    const openRow = page.getByRole('row').filter({ hasText: DEMO_PO_APPROVED_NUMBER });
    await openRow.getByRole('button', { name: 'View' }).click();

    const poDialog = page.getByRole('dialog');
    await poDialog.getByRole('button', { name: 'Receive' }).click();

    await expect(page.getByRole('heading', { name: 'Receive against PO' })).toBeVisible({ timeout: 10_000 });
    const receiveDialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Receive against PO' }) });
    await receiveDialog.getByLabel('Quantity to receive').fill('50');
    await receiveDialog.getByRole('button', { name: 'Receive stock' }).click();

    await expect(poDialog.getByText('Status: Partially received')).toBeVisible({ timeout: 10_000 });
    await expect(poDialog.getByText('50 / 200')).toBeVisible();
  });

  test('inventory manager fulfills approved stock request', async ({ page }) => {
    await login(page, DEMO_INVENTORY_MANAGER);
    await page.goto('/inventory/stock-requests?status=APPROVED');

    const approvedRow = page.getByRole('row').filter({ hasText: DEMO_STOCK_REQUEST_APPROVED_NUMBER });
    await expect(approvedRow).toBeVisible();

    await approvedRow.getByRole('button', { name: 'View' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Approved', { exact: true })).toBeVisible();

    await dialog.getByLabel('Accountable staff member').selectOption({ index: 1 });
    await dialog.getByRole('button', { name: 'Issue stock' }).click();
    await expect(dialog.getByText('Fulfilled', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText('3 / 3')).toBeVisible();
  });
});

test.describe('Inventory reports smoke', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('owner loads analytics reports with valuation KPIs', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/inventory/reports');

    await expect(page.getByRole('heading', { name: 'Inventory reports' })).toBeVisible();
    await expect(page.getByText('Total stock value')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Active SKUs')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Reporting period' })).toBeVisible();
  });
});
