import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { login } from './helpers/auth';
import { DEMO_OWNER } from './helpers/demo-credentials';

/**
 * Wave H4 — Owner inventory / commission UX (bounded read-only).
 * Arabic locale + dir=rtl smoke on existing owner routes.
 */
test.describe('Wave H4 owner inventory/commission UX', { tag: ['@wave-h4', '@owner-ux'] }, () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('RTL owner: commissions list + staff summary region', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('booking.locale', 'ar-SY');
    });
    await login(page, DEMO_OWNER);
    await page.goto('/billing/commissions');

    const region = page.getByTestId('billing-commissions-region');
    await expect(region).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('provider-commissions-list')).toBeVisible();
    await expect(page.getByTestId('commission-status-filter')).toBeVisible();
    await expect(page.getByTestId('staff-commission-owner-panel')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[data-testid="billing-commissions-region"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test('RTL owner: inventory reports + accountability panel', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('booking.locale', 'ar-SY');
    });
    await login(page, DEMO_OWNER);
    await page.goto('/inventory/reports');

    const region = page.getByTestId('inventory-reports-region');
    await expect(region).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByTestId('inventory-accountability-panel')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /مساءلة الاستخدام|Usage accountability/i }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[data-testid="inventory-accountability-panel"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
});
