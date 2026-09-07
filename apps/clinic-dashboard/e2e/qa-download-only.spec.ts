import { test, expect } from '@playwright/test';
import path from 'node:path';
import { login } from './helpers/auth';
import { DEMO_OWNER } from './helpers/demo-credentials';

test('QA — analytics download seeded report file', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page, DEMO_OWNER);
  const overviewOk = page.waitForResponse(
    (r) => r.url().includes('/analytics/overview') && r.request().method() === 'GET' && r.ok(),
    { timeout: 45_000 },
  );
  await page.goto('/analytics/executive');
  await overviewOk;
  await page.locator('#analytics-region').waitFor({ state: 'visible', timeout: 45_000 });

  await expect(page.getByText('Monthly revenue summary')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('Live API unavailable')).toHaveCount(0);

  const download = page.waitForEvent('download');
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Monthly revenue summary' })
    .getByRole('button', { name: 'Download' })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.csv$/i);
  await file.saveAs(path.join(process.cwd(), 'e2e', '.qa-downloads', file.suggestedFilename()));
});
