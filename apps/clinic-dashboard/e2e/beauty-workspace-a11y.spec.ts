import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER } from './helpers/demo-credentials';

test.describe('Beauty workspace a11y', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('workspace region passes axe', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/beauty');
    await page.waitForSelector('#beauty-region', { timeout: 15_000 });
    const link = page.getByRole('link', { name: /sarah|hassan|open/i }).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      await page.waitForSelector('#beauty-workspace-region', { timeout: 15_000 });
      const results = await new AxeBuilder({ page })
        .include('#beauty-workspace-region')
        .withTags(['wcag2a', 'wcag2aa'])
        .disableRules(['color-contrast'])
        .analyze();
      expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
    }
  });
});
