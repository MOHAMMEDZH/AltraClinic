import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { DEMO_OWNER, DEMO_RECEPTIONIST } from './helpers/demo-credentials';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';

const IE_BASE = '/settings/import-export';

test.describe('Phase 42f — Import/Export Operations UI', () => {
  test.beforeEach(({}, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('owner can open center overview', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, DEMO_OWNER);
    await page.goto(IE_BASE);
    await expect(page.locator('#import-export-region')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('heading', { name: /Import \/ Export Center/i })).toBeVisible();
  });

  test('owner can open catalog', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, DEMO_OWNER);
    await page.goto(`${IE_BASE}/catalog`);
    await expect(page.locator('#import-export-region')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('heading', { name: /Runtime catalog/i })).toBeVisible({ timeout: 30_000 });
  });

  test('owner can open jobs dashboard', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, DEMO_OWNER);
    await page.goto(`${IE_BASE}/jobs`);
    await expect(page.locator('#import-export-region')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('heading', { name: /Job dashboard/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel('Search jobs')).toBeVisible();
  });

  test('owner can open health', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, DEMO_OWNER);
    await page.goto(`${IE_BASE}/health`);
    await expect(page.locator('#import-export-region')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('heading', { name: /System health/i })).toBeVisible({ timeout: 30_000 });
  });

  test('import wizard form is accessible', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, DEMO_OWNER);
    await page.goto(`${IE_BASE}/imports/new`);
    await expect(page.getByRole('heading', { name: /Import wizard/i })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByLabel('Import type')).toBeVisible();
    await expect(page.getByLabel('Import file')).toBeVisible();
  });

  test('export wizard form is accessible', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, DEMO_OWNER);
    await page.goto(`${IE_BASE}/exports/new`);
    await expect(page.getByRole('heading', { name: /Export wizard/i })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByLabel('Export type')).toBeVisible();
    await expect(page.getByLabel('Export format')).toBeVisible();
  });

  test('artifact center renders', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, DEMO_OWNER);
    await page.goto(`${IE_BASE}/artifacts`);
    await expect(page.getByRole('heading', { name: /Artifact center/i })).toBeVisible({ timeout: 45_000 });
  });

  test('receptionist without importExport view is blocked on center', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, DEMO_RECEPTIONIST);
    await page.goto(IE_BASE);
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
    const denied = page.getByText(
      /do not have permission|Missing permission|access denied|You do not have permission/i,
    );
    const startImport = page.getByRole('button', { name: /Start import|New import|Start export/i });
    await expect(startImport).toHaveCount(0);
    const hasDenied = await denied.count();
    const hasRegion = await page.locator('#import-export-region').count();
    expect(hasDenied > 0 || hasRegion === 0).toBeTruthy();
  });
});
