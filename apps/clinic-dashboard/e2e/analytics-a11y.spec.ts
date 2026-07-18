import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER } from './helpers/demo-credentials';

test.describe('Clinic analytics accessibility', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('analytics page passes axe on main content region', async ({ page }) => {
    await login(page, DEMO_OWNER);

    const overviewResponse = page.waitForResponse(
      (resp) => resp.url().includes('/analytics/overview') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/analytics');
    await overviewResponse;
    await expect(page.getByRole('heading', { name: 'Analytics hub', level: 1 })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('heading', { name: 'Executive summary', level: 2 })).toBeVisible({
      timeout: 15_000,
    });

    const results = await new AxeBuilder({ page })
      .include('#analytics-region')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
