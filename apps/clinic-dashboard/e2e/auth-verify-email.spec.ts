import { test, expect } from '@playwright/test';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER, DEMO_TENANT_ID } from './helpers/demo-credentials';
import { mintEmailVerificationToken, restoreDemoSeed } from './helpers/auth-tokens';

test.describe('Auth verify email smoke', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test.afterEach(() => {
    restoreDemoSeed();
  });

  test('verify-email page shows error when token is missing', async ({ page }) => {
    await page.goto('/verify-email');

    await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Invalid link. Request a new verification email.');
  });

  test('owner verifies email with a valid token', async ({ page }) => {
    const token = mintEmailVerificationToken(DEMO_OWNER.email, DEMO_TENANT_ID);

    const verifyResponse = page.waitForResponse(
      (resp) => resp.url().includes('/auth/verify-email') && resp.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.goto(`/verify-email?token=${encodeURIComponent(token)}&tenantId=${DEMO_TENANT_ID}`);

    const response = await verifyResponse;
    expect(response.ok()).toBeTruthy();
    await expect(page.getByText('Email verified')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Back to sign in' })).toBeVisible();
  });
});
