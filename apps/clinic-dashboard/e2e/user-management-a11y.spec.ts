import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER } from './helpers/demo-credentials';

test.describe('User management accessibility', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
      return;
    }
    await login(page, DEMO_OWNER);
  });

  test('overview passes axe on user-management region', async ({ page }) => {
    await page.goto('/settings/users');
    await page.locator('#user-management-region').waitFor({ state: 'visible' });

    const results = await new AxeBuilder({ page })
      .include('#user-management-region')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('directory passes axe on user-management region', async ({ page }) => {
    await page.goto('/settings/users/directory');
    await page.locator('#user-management-region').waitFor({ state: 'visible' });

    const results = await new AxeBuilder({ page })
      .include('#user-management-region')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
