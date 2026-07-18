import { test, expect } from '@playwright/test';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER, DEMO_TENANT_ID } from './helpers/demo-credentials';

test.describe('Auth forgot password smoke', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('forgot-password page submits and shows success message', async ({ page }) => {
    await page.goto('/forgot-password');

    await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible();
    await page.getByLabel('Organization ID').fill(DEMO_TENANT_ID);
    await page.getByLabel('Email', { exact: true }).fill(DEMO_OWNER.email);

    const forgotResponse = page.waitForResponse(
      (resp) => resp.url().includes('/auth/forgot-password') && resp.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.getByRole('button', { name: 'Send reset link' }).click();

    const response = await forgotResponse;
    expect(response.ok()).toBeTruthy();
    await expect(page.getByText('Check your inbox')).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByText('If registered, you will receive an email within a few minutes.'),
    ).toBeVisible();
  });

  test('forgot-password links back to sign in', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByRole('link', { name: 'Back to sign in' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});
