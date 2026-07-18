import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_DOCTOR } from './helpers/demo-credentials';

test.describe('Dental workflow', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('dental dashboard loads with workspace bar', async ({ page }) => {
    await login(page, DEMO_DOCTOR);
    await page.goto('/dental');
    await expect(page.getByRole('heading', { name: /dental management|إدارة الأسنان/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByLabel(/dental workspace|مساحة عمل/i)).toBeVisible();
  });

  test('dental chart exposes extended clinical tabs', async ({ page }) => {
    await login(page, DEMO_DOCTOR);
    await page.goto('/dental');
    const chartLink = page.getByRole('link', { name: /open chart|فتح المخطط/i }).first();
    if (await chartLink.isVisible()) {
      await chartLink.click();
      await expect(page.getByRole('tab', { name: /orthodontics|تقويم/i })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('tab', { name: /implants|زرعات/i })).toBeVisible();
    }
  });
});
