import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_DOCTOR } from './helpers/demo-credentials';

test.describe('Dental accessibility', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('dental dashboard has no serious a11y violations', async ({ page }) => {
    await login(page, DEMO_DOCTOR);
    await page.goto('/dental');
    await expect(page.locator('#dental-region')).toBeVisible({ timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .include('#dental-region')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  });

  test('dental chart has no serious a11y violations', async ({ page }) => {
    await login(page, DEMO_DOCTOR);
    await page.goto('/dental');
    const chartLink = page.getByRole('link', { name: /open chart|فتح المخطط/i }).first();
    if (!(await chartLink.isVisible())) {
      test.skip(true, 'No dental charts in demo data');
    }
    await chartLink.click();
    await expect(page.locator('#dental-chart-region')).toBeVisible({ timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .include('#dental-chart-region')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  });
});
