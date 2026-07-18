import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_RECEPTIONIST } from './helpers/demo-credentials';

test.describe('Patients accessibility', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('patients list passes axe on main region', async ({ page }) => {
    await login(page, DEMO_RECEPTIONIST);

    const listResponse = page.waitForResponse(
      (resp) => resp.url().includes('/patients') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/patients');
    await listResponse;
    await expect(page.locator('#patients-region')).toBeVisible({ timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .include('#patients-region')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('patient detail passes axe on detail region', async ({ page }) => {
    await login(page, DEMO_RECEPTIONIST);

    const listResponse = page.waitForResponse(
      (resp) => resp.url().includes('/patients') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/patients');
    await listResponse;
    await expect(page.locator('#patients-region')).toBeVisible({ timeout: 15_000 });

    const firstPatientLink = page.locator('#patients-region table tbody a').first();
    await expect(firstPatientLink).toBeVisible({ timeout: 10_000 });
    await firstPatientLink.click();
    await expect(page.locator('#patients-detail-region')).toBeVisible({ timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .include('#patients-detail-region')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
