import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers/auth';
import { DEMO_OWNER } from './helpers/demo-credentials';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';

test.describe('Phase 42f — Import/Export accessibility', () => {
  test.beforeEach(({}, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('center overview has no serious a11y violations', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, DEMO_OWNER);
    await page.goto('/settings/import-export');
    const region = page.locator('#import-export-region');
    await expect(region).toBeVisible({ timeout: 60_000 });
    const results = await new AxeBuilder({ page }).include('#import-export-region').analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious).toEqual([]);
  });
});
