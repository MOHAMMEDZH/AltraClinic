import { test, expect } from '@playwright/test';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { login } from './helpers/auth';
import { DEMO_OWNER } from './helpers/demo-credentials';

/**
 * Wave H2 / P1-08 booking half — Arabic locale + RTL reception booking quality.
 * Catalog search uses API search= (H1 deferred UI wiring).
 */
test.describe('Wave H2 Arabic RTL booking', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('RTL appointments: open book form, select Arabic service type', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('booking.locale', 'ar-SY');
    });
    await login(page, DEMO_OWNER);
    await page.goto('/appointments');
    await page.locator('#scheduling-region').waitFor({ state: 'visible', timeout: 20_000 });

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await page.getByRole('button', { name: /موعد جديد|New appointment/i }).click();
    const form = page.getByTestId('appointment-form');
    await expect(form).toBeVisible({ timeout: 15_000 });
    await expect(form).toHaveAttribute('dir', 'rtl');

    const serviceSelect = form.getByLabel(/نوع الخدمة|Service type/i);
    await expect(serviceSelect).toBeVisible();
    await serviceSelect.selectOption({ label: 'استشارة' });
    await expect(serviceSelect).toHaveValue('consultation');

    await expect(form.getByLabel(/المريض|Patient/i).first()).toBeVisible();
    await expect(form.getByRole('button', { name: /حفظ|إنشاء|Save|Create|جدولة/i }).first()).toBeVisible();
  });

  test('RTL clinical catalog: API search finds Arabic displayName', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('booking.locale', 'ar-SY');
    });
    await login(page, DEMO_OWNER);
    await page.goto('/settings/clinical-services');
    await expect(
      page.getByRole('heading', { level: 1, name: /الخدمات السريرية|Clinical Services/i }),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await expect(page.getByTestId('clinical-services-results')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('clinical-services-loading')).toHaveCount(0, { timeout: 20_000 });

    const stamp = `${Date.now()}`;
    const arName = `استشارة H2 ${stamp}`;
    await page.getByRole('button', { name: /إنشاء خدمة للعيادة|Create tenant service/i }).click();
    await page.getByLabel(/لاحقة المفتاح الثابت|Stable key suffix/i).fill(`h2_${stamp}`);
    await page.getByLabel(/الاسم \(EN\)|Name \(EN\)/i).fill(`H2 Consultation ${stamp}`);
    await page.getByLabel(/الاسم \(AR\)|Name \(AR\)/i).fill(arName);
    await page.getByRole('button', { name: /حفظ المسودة|Save draft/i }).click();

    const search = page.getByTestId('clinical-services-search');
    await expect(search).toBeVisible();
    await search.fill(arName);
    await expect(page.getByTestId('clinical-services-loading')).toHaveCount(0, { timeout: 20_000 });
    const list = page.getByTestId('clinical-services-list');
    await expect(list).toBeVisible({ timeout: 15_000 });
    await expect(list).toContainText(arName);
    await expect(list).not.toHaveText(/لا توجد خدمات سريرية|No clinical services found/i);
  });
});
