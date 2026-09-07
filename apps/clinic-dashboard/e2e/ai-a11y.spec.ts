import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER } from './helpers/demo-credentials';

test.describe('AI workspace accessibility', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('AI overview passes axe on main region', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/ai');
    await expect(page.getByRole('heading', { name: /AI|الذكاء/i })).toBeVisible({ timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .include('#ai-region')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('AI chat page passes axe on main region', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/ai/chat');
    await expect(page.getByLabel(/search conversations|بحث في المحادثات/i)).toBeVisible({ timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .include('#ai-main')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('AI prompts page passes axe on main region', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/ai/prompts');
    await expect(page.locator('header').getByRole('heading', { name: /prompt library|مكتبة المطالبات/i })).toBeVisible({
      timeout: 15_000,
    });

    const results = await new AxeBuilder({ page })
      .include('#ai-main')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('AI sidebar passes axe when open', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/ai');
    await page.getByRole('button', { name: /AI Copilot|مساعد Copilot/i }).click();
    await expect(page.locator('#ai-sidebar-panel')).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('#ai-sidebar-panel')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('AI overview passes axe on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page, DEMO_OWNER);
    await page.goto('/ai');
    await expect(page.getByRole('heading', { name: /AI|الذكاء/i })).toBeVisible({ timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .include('#ai-region')
      .withTags(['wcag2a', 'wcag2aa'])
      // Locked workspace cards use muted text; same policy as beauty/scheduling a11y.
      .disableRules(['color-contrast'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('command palette dialog is keyboard dismissible', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/ai');
    await expect(page.getByRole('heading', { name: /AI|الذكاء/i })).toBeVisible({ timeout: 15_000 });
    await page.locator('body').click();
    await page.keyboard.press('Control+Shift+K');
    const commandDialog = page.getByRole('dialog', { name: /AI command palette|لوحة أوامر الذكاء/i });
    await expect(commandDialog).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Escape');
    await expect(commandDialog).toBeHidden();
  });

  test('AI sidebar is keyboard dismissible', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/ai');
    await page.getByRole('button', { name: /AI Copilot|مساعد Copilot/i }).click();
    await expect(page.locator('#ai-sidebar-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#ai-sidebar-panel')).toHaveAttribute('aria-hidden', 'true');
  });
});
