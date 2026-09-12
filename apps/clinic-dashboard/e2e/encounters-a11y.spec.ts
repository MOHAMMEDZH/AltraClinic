import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_DOCTOR } from './helpers/demo-credentials';

test.describe('EMR accessibility', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('encounters list has no serious a11y violations', async ({ page }) => {
    await login(page, DEMO_DOCTOR);
    await page.goto('/encounters');
    await expect(page.locator('#encounters-region')).toBeVisible({ timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .include('#encounters-region')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  });

  test('encounter detail has no serious a11y violations', async ({ page }) => {
    await login(page, DEMO_DOCTOR);
    await page.goto('/encounters/e1000000-0000-4000-8000-000000000001');
    await expect(page.locator('#encounters-detail-region')).toBeVisible({ timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .include('#encounters-detail-region')
      .withTags(['wcag2a', 'wcag2aa'])
      // D4 DEFER: status badges (warning/success on tinted fills) need redesign —
      // docs/PHASE_50_D4_A11Y/01_CONTRAST_FOLLOWUPS.md (do not expand disableRules).
      .disableRules(['color-contrast'])
      .analyze();

    expect(results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
  });
});
