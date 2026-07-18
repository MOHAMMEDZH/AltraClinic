import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_DOCTOR } from './helpers/demo-credentials';

test.describe('Beauty accessibility', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('beauty dashboard has no serious a11y violations', async ({ page }) => {
    await login(page, DEMO_DOCTOR);
    await page.goto('/beauty');
    await expect(page.locator('#beauty-region')).toBeVisible({ timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .include('#beauty-region')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  });
});
