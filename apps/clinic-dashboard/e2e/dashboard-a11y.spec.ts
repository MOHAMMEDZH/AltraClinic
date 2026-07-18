import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER, DEMO_RECEPTIONIST } from './helpers/demo-credentials';

test.describe('Clinic dashboard accessibility', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('owner dashboard passes axe on main content region', async ({ page }) => {
    await login(page, DEMO_OWNER);

    const overviewResponse = page.waitForResponse(
      (resp) => resp.url().includes('/dashboard/overview') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/');
    await overviewResponse;
    await expect(page.getByRole('heading', { name: 'KPI overview', level: 2 })).toBeVisible({
      timeout: 15_000,
    });

    const results = await new AxeBuilder({ page })
      .include('#dashboard-region')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('receptionist dashboard passes axe on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, DEMO_RECEPTIONIST);

    const overviewResponse = page.waitForResponse(
      (resp) => resp.url().includes('/dashboard/overview') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/');
    await overviewResponse;
    await expect(page.getByRole('heading', { name: 'KPI overview', level: 2 })).toBeVisible({
      timeout: 15_000,
    });

    const results = await new AxeBuilder({ page })
      .include('#dashboard-region')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
