import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER, DEMO_TENANT_ID } from './helpers/demo-credentials';
import { mintPasswordResetToken, restoreDemoSeed } from './helpers/auth-tokens';

const TEMP_PASSWORD = 'OwnerReset123!';

test.describe('Auth reset password smoke', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test.afterEach(() => {
    restoreDemoSeed();
  });

  test('reset-password page shows error when token is missing', async ({ page }) => {
    await page.goto('/reset-password');

    await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Invalid link. Request a new reset email.');
    await expect(page.getByRole('button', { name: 'Save password' })).toBeDisabled();
  });

  test('owner resets password with a valid token and can sign in', async ({ page }) => {
    const token = mintPasswordResetToken(DEMO_OWNER.email, DEMO_TENANT_ID);
    await page.goto(`/reset-password?token=${encodeURIComponent(token)}&tenantId=${DEMO_TENANT_ID}`);

    await page.getByLabel('New password').fill(TEMP_PASSWORD);
    await page.getByLabel('Confirm password').fill(TEMP_PASSWORD);

    const resetResponse = page.waitForResponse(
      (resp) => resp.url().includes('/auth/reset-password') && resp.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.getByRole('button', { name: 'Save password' }).click();

    const response = await resetResponse;
    expect(response.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Password updated')).toBeVisible();

    await page.getByLabel('Organization ID').fill(DEMO_TENANT_ID);
    await page.getByLabel('Email', { exact: true }).fill(DEMO_OWNER.email);
    await page.getByLabel('Password', { exact: true }).fill(TEMP_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible({ timeout: 15_000 });
  });
});
