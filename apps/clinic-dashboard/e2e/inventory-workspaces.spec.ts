import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { login, gotoInventory } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import {
  DEMO_DOCTOR,
  DEMO_INVENTORY_BARCODE,
  DEMO_INVENTORY_SKU,
  DEMO_RECEPTIONIST,
  DEMO_STOCK_REQUEST_APPROVED_NUMBER,
} from './helpers/demo-credentials';

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../api');

test.describe('Inventory workspace roles', () => {
  test.beforeAll(() => {
    if (!isE2eApiReady()) return;
    execSync('npx prisma db seed', { cwd: apiDir, stdio: 'pipe' });
  });

  test.beforeEach(({ }, testInfo) => {    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('receptionist lookup workspace is view-only with barcode search', async ({ page }) => {
    await login(page, DEMO_RECEPTIONIST);
    await gotoInventory(page, '/inventory/catalog');

    await expect(page.getByRole('heading', { name: 'Stock lookup' })).toBeVisible();
    await expect(
      page.getByText('Lookup workspace — view-only stock availability for front desk and clinical support.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add item' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Receive by scan' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Archive selected' })).toHaveCount(0);
    await expect(page.locator('#inv-catalog-region').getByRole('link', { name: DEMO_INVENTORY_SKU })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByLabel('Scan or type barcode / SKU…').fill(DEMO_INVENTORY_BARCODE);
    await page.getByRole('button', { name: 'Look up' }).click();
    await expect(page).toHaveURL(/\/inventory\/items\//, { timeout: 10_000 });
  });

  test('doctor clinical workspace can browse catalog and create stock requests', async ({ page }) => {
    await login(page, DEMO_DOCTOR);
    await gotoInventory(page, '/inventory/catalog');

    await expect(page.getByRole('heading', { name: 'Material availability' })).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText('Clinical workspace — search materials and submit stock requests when needed.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add item' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Stock in' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Archive', exact: true })).toHaveCount(0);

    await page.goto('/inventory/stock-requests');
    await expect(page.getByRole('heading', { name: 'Stock requests' })).toBeVisible();
    await expect(
      page.getByText('Clinical workspace — submit material requests for approval and fulfillment by inventory.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'New request' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'My requests', pressed: true })).toBeVisible();
    await page.getByRole('group', { name: 'Status filters' }).getByRole('button', { name: 'Approved' }).click();
    await expect(page.getByRole('row').filter({ hasText: DEMO_STOCK_REQUEST_APPROVED_NUMBER })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('receptionist stock requests workspace is lookup-only', async ({ page }) => {
    await login(page, DEMO_RECEPTIONIST);
    await page.goto('/inventory/stock-requests');

    await expect(page.getByRole('heading', { name: 'Stock requests' })).toBeVisible();
    await expect(
      page.getByText('Lookup workspace — view stock availability; contact inventory to request supplies.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'New request' })).toHaveCount(0);
  });
});
