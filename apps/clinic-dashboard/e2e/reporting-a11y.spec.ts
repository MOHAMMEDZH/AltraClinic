import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER } from './helpers/demo-credentials';

test.describe('Reporting accessibility', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('reporting home passes axe on main content region', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Reporting', level: 1 })).toBeVisible({
      timeout: 15_000,
    });

    const results = await new AxeBuilder({ page })
      .include('#reports-region')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('report builder passes axe on main content region', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/reports/builder');
    await expect(page.getByRole('heading', { name: 'Report builder', level: 1 })).toBeVisible({
      timeout: 15_000,
    });

    const results = await new AxeBuilder({ page })
      .include('#reports-region')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
