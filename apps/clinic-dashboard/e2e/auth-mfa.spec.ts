import { test, expect } from '@playwright/test';
import { generateSync } from 'otplib';
import { login, logout } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER, DEMO_TENANT_ID } from './helpers/demo-credentials';
import { restoreDemoSeed } from './helpers/auth-tokens';

test.describe('Auth MFA', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test.afterEach(() => {
    restoreDemoSeed();
  });

  test('owner can enable MFA and sign in with authenticator code', async ({ page }) => {
    let mfaSecret = '';

    await login(page, DEMO_OWNER);
    await page.goto('/settings/security/mfa');

    const setupResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/auth/mfa/setup') && resp.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Set up authenticator' }).click();
    const setupResponse = await setupResponsePromise;
    expect(setupResponse.ok()).toBeTruthy();
    const setupBody = (await setupResponse.json()) as { secret: string };
    mfaSecret = setupBody.secret;

    const enrollCode = generateSync({ secret: mfaSecret });
    const enrollInputs = page.getByRole('group', { name: 'Verification code' }).locator('input');
    for (let i = 0; i < 6; i++) {
      await enrollInputs.nth(i).fill(enrollCode[i] ?? '');
    }
    await page.getByRole('button', { name: 'Enable two-factor' }).click();
    const confirmResponse = await page.waitForResponse(
      (resp) => resp.url().includes('/auth/mfa/confirm') && resp.request().method() === 'POST',
      { timeout: 20_000 },
    );
    expect(confirmResponse.ok()).toBeTruthy();
    await expect(
      page.getByText('Two-factor authentication is now enabled.').or(page.getByText('Backup codes')),
    ).toBeVisible({ timeout: 10_000 });

    if (await page.getByText('Backup codes').isVisible()) {
      await page.getByRole('button', { name: 'Cancel' }).click();
    }

    await logout(page);

    await page.getByLabel('Organization ID').fill(DEMO_TENANT_ID);
    await page.getByLabel('Email', { exact: true }).fill(DEMO_OWNER.email);
    await page.getByLabel('Password', { exact: true }).fill(DEMO_OWNER.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/mfa$/);

    const loginCode = generateSync({ secret: mfaSecret });
    const mfaInputs = page.getByRole('group', { name: 'Verification code' }).locator('input');
    for (let i = 0; i < 6; i++) {
      await mfaInputs.nth(i).fill(loginCode[i] ?? '');
    }
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible({
      timeout: 15_000,
    });

    // Login already consumed this TOTP window; wait for the next period before disable.
    const totpStepMs = 30_000;
    await page.waitForTimeout(totpStepMs - (Date.now() % totpStepMs) + 250);

    await page.goto('/settings/security/mfa');
    await page.getByLabel('Current password').fill(DEMO_OWNER.password);
    const disableCode = generateSync({ secret: mfaSecret });
    const disableInputs = page.getByRole('group', { name: 'Verification code' }).locator('input');
    for (let i = 0; i < 6; i++) {
      await disableInputs.nth(i).fill(disableCode[i] ?? '');
    }
    const disableResponse = page.waitForResponse(
      (resp) => resp.url().includes('/auth/mfa/disable') && resp.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.getByRole('button', { name: 'Disable two-factor' }).click();
    expect((await disableResponse).ok()).toBeTruthy();
    // Success toast can remount away after refreshUser; durable UX is the setup CTA.
    await expect(page.getByRole('button', { name: 'Set up authenticator' })).toBeVisible({
      timeout: 10_000,
    });
  });
});
