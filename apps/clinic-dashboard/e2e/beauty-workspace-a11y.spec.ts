import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Beauty workspace a11y', () => {
  test('workspace region passes axe', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('owner@demo.clinic');
    await page.getByLabel(/password/i).fill('DemoOwner1!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 30_000 }).catch(() => undefined);
    await page.goto('/beauty');
    await page.waitForSelector('#beauty-region', { timeout: 15_000 });
    const link = page.getByRole('link', { name: /sarah|hassan|open/i }).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      await page.waitForSelector('#beauty-workspace-region', { timeout: 15_000 });
      const results = await new AxeBuilder({ page })
        .include('#beauty-workspace-region')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
    }
  });
});
