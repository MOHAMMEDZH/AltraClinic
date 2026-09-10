import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { gotoAppointments } from './helpers/scheduling';

/**
 * Wave H3 / P1-12 — Accessibility + tablet reception pack.
 * Functional a11y gates only (Enterprise QA §11). No color-contrast disableRules on booking paths.
 */
test.describe('Wave H3 accessibility + tablet reception', { tag: ['@wave-h3', '@accessibility-tablet'] }, () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('axe: scheduling reception chrome + calendar controls (no critical disableRules)', async ({ page }) => {
    await gotoAppointments(page);

    await expect(page.locator('#scheduling-region')).toBeVisible();
    await expect(page.getByTestId('scheduling-reception-chrome')).toBeVisible();
    await expect(page.getByTestId('scheduling-calendar-controls')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[data-testid="scheduling-reception-chrome"]')
      .include('[data-testid="scheduling-calendar-controls"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test('axe: appointment book form under default locale (no critical disableRules)', async ({ page }) => {
    await gotoAppointments(page);

    await page.getByTestId('scheduling-new-appointment').click();
    const form = page.getByTestId('appointment-form');
    await expect(form).toBeVisible({ timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .include('[data-testid="appointment-form"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test('tablet 1024×768: book CTA + day/week controls tappable; open appointment form', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await gotoAppointments(page);

    const bookCta = page.getByTestId('scheduling-new-appointment');
    await expect(bookCta).toBeVisible();
    const bookBox = await bookCta.boundingBox();
    expect(bookBox, 'book CTA must have layout box').toBeTruthy();
    expect(bookBox!.height).toBeGreaterThanOrEqual(40);
    expect(bookBox!.width).toBeGreaterThanOrEqual(40);

    const dayBtn = page.getByTestId('scheduling-view-day');
    const weekBtn = page.getByTestId('scheduling-view-week');
    await expect(dayBtn).toBeVisible();
    await expect(weekBtn).toBeVisible();

    for (const btn of [dayBtn, weekBtn]) {
      const box = await btn.boundingBox();
      expect(box, 'calendar view control must have layout box').toBeTruthy();
      expect(box!.height).toBeGreaterThanOrEqual(40);
      expect(box!.width).toBeGreaterThanOrEqual(40);
      await expect(btn).toBeEnabled();
    }

    await weekBtn.click();
    await expect(weekBtn).toHaveAttribute('aria-pressed', 'true');

    await bookCta.click();
    const form = page.getByTestId('appointment-form');
    await expect(form).toBeVisible({ timeout: 15_000 });
    const formBox = await form.boundingBox();
    expect(formBox, 'appointment form must render without desktop-only collapse').toBeTruthy();
    expect(formBox!.width).toBeGreaterThan(200);
    expect(formBox!.height).toBeGreaterThan(100);
    await expect(form.getByLabel(/Patient|المريض/i).first()).toBeVisible();
  });
});
