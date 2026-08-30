import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { DEMO_OWNER, DEMO_RECEPTIONIST } from './helpers/demo-credentials';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';

const BR_BASE = '/settings/backup-restore';

test.describe('Phase 43f — Backup/Restore Operations UI', () => {
  test.beforeEach(({}, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('owner can open center overview', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, DEMO_OWNER);
    await page.goto(BR_BASE);
    await expect(page.locator('#backup-restore-region')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('heading', { name: /Backup & Restore/i })).toBeVisible();
  });

  test('owner can open catalog', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, DEMO_OWNER);
    await page.goto(`${BR_BASE}/catalog`);
    await expect(page.locator('#backup-restore-region')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('heading', { name: /Runtime catalog/i })).toBeVisible({ timeout: 30_000 });
  });

  test('owner can open jobs dashboard', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, DEMO_OWNER);
    await page.goto(`${BR_BASE}/jobs`);
    await expect(page.locator('#backup-restore-region')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('heading', { name: /Job dashboard/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel('Search jobs')).toBeVisible();
  });

  test('owner can open health', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, DEMO_OWNER);
    await page.goto(`${BR_BASE}/health`);
    await expect(page.locator('#backup-restore-region')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('heading', { name: /Engine health/i })).toBeVisible({ timeout: 30_000 });
  });

  test('backup request form is accessible', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, DEMO_OWNER);
    await page.goto(`${BR_BASE}/backups/new`);
    await expect(page.locator('#backup-restore-region')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('heading', { name: /New backup request/i })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByLabel('Backup type')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByLabel('Compression')).toBeVisible({ timeout: 45_000 });
  });

  test('restore request form is accessible', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, DEMO_OWNER);
    await page.goto(`${BR_BASE}/restores/new`);
    await expect(page.locator('#backup-restore-region')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('heading', { name: /New restore request/i })).toBeVisible({ timeout: 45_000 });
    await expect(page.getByLabel('Restore mode')).toBeVisible();
  });

  test('snapshots page renders', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, DEMO_OWNER);
    await page.goto(`${BR_BASE}/snapshots`);
    await expect(page.getByRole('heading', { name: /Snapshots/i })).toBeVisible({ timeout: 45_000 });
  });

  test('receptionist without backupRestore view is blocked on center', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, DEMO_RECEPTIONIST);
    await page.goto(BR_BASE);
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined);
    const denied = page.getByText(
      /do not have permission|Missing permission|access denied|You do not have permission/i,
    );
    const startBackup = page.getByRole('button', { name: /New backup|New restore/i });
    await expect(startBackup).toHaveCount(0);
    const hasDenied = await denied.count();
    const hasRegion = await page.locator('#backup-restore-region').count();
    expect(hasDenied > 0 || hasRegion === 0).toBeTruthy();
  });
});
