import { test, expect } from '@playwright/test';
import { login, logout } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER, DEMO_TENANT_ID } from './helpers/demo-credentials';
import { restoreDemoSeed } from './helpers/auth-tokens';

test.describe('Auth security settings smoke', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
      return;
    }
    await login(page, DEMO_OWNER);
  });

  test('security center overview loads with navigation cards', async ({ page }) => {
    await page.goto('/settings/security');

    await expect(page.getByRole('heading', { name: 'Account security' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Security center', level: 2 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage' }).first()).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Account security' })).toBeVisible();
  });

  test('sessions page lists active sessions', async ({ page }) => {
    const sessionsResponse = page.waitForResponse(
      (resp) => resp.url().includes('/auth/sessions') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/settings/security/sessions');

    await expect(page.getByRole('heading', { name: 'Session management', level: 2 })).toBeVisible();
    await sessionsResponse;

    await expect(page.getByText('Current session')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });

  test('change password page renders policy controls', async ({ page }) => {
    await page.goto('/settings/security/password');

    await expect(page.getByRole('heading', { name: 'Change password', level: 2 })).toBeVisible();
    await expect(page.getByLabel('Current password')).toBeVisible();
    await expect(page.getByLabel('New password')).toBeVisible();
    await expect(page.getByLabel('Confirm password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update password' })).toBeDisabled();
  });

  test('devices page loads registered devices', async ({ page }) => {
    const devicesResponse = page.waitForResponse(
      (resp) => resp.url().includes('/auth/sessions') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/settings/security/devices');

    await expect(page.getByRole('heading', { name: 'Device management', level: 2 })).toBeVisible();
    await devicesResponse;

    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible({ timeout: 15_000 });
  });

  test('profile page shows account details', async ({ page }) => {
    await page.goto('/settings/security/profile');

    await expect(page.getByRole('heading', { name: 'Profile security settings', level: 2 })).toBeVisible();
    await expect(page.getByText(DEMO_OWNER.email)).toBeVisible();
    await expect(page.getByText('Verified')).toBeVisible();
  });

  test('owner can revoke a single non-current session', async ({ page, browser }) => {
    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    await login(secondPage, DEMO_OWNER);

    await page.goto('/settings/security/sessions');
    await expect(page.getByText('Current session')).toBeVisible({ timeout: 15_000 });

    const revokeButtons = page.getByRole('button', { name: 'Sign out session' });
    await expect(revokeButtons.first()).toBeVisible();
    const revokeResponse = page.waitForResponse(
      (resp) => resp.url().includes('/auth/sessions/') && resp.url().includes('/revoke'),
      { timeout: 20_000 },
    );
    await revokeButtons.first().click();

    const response = await revokeResponse;
    expect(response.ok()).toBeTruthy();
    await expect(page.getByText('Session ended.')).toBeVisible({ timeout: 15_000 });

    await secondContext.close();
  });

  test('owner can change password and sign in with the new password', async ({ page }) => {
    const newPassword = 'OwnerChange123!';
    await page.goto('/settings/security/password');

    try {
      await page.getByLabel('Current password').fill(DEMO_OWNER.password);
      await page.getByLabel('New password').fill(newPassword);
      await page.getByLabel('Confirm password').fill(newPassword);

      const changeResponse = page.waitForResponse(
        (resp) => resp.url().includes('/auth/change-password') && resp.request().method() === 'POST',
        { timeout: 20_000 },
      );
      await page.getByRole('button', { name: 'Update password' }).click();

      const response = await changeResponse;
      expect(response.ok()).toBeTruthy();
      await expect(page.getByRole('status')).toContainText(/Password changed/i, { timeout: 15_000 });

      await logout(page);
      await page.getByLabel('Organization ID').fill(DEMO_TENANT_ID);
      await page.getByLabel('Email', { exact: true }).fill(DEMO_OWNER.email);
      await page.getByLabel('Password', { exact: true }).fill(newPassword);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible({ timeout: 15_000 });
    } finally {
      restoreDemoSeed();
    }
  });

  test('owner can sign out other sessions', async ({ page, browser }) => {
    const secondContext = await browser.newContext();
    const secondPage = await secondContext.newPage();
    await login(secondPage, DEMO_OWNER);

    await page.goto('/settings/security/sessions');
    await expect(page.getByText('Current session')).toBeVisible({ timeout: 15_000 });

    const revokeResponse = page.waitForResponse(
      (resp) => resp.url().includes('/auth/logout-all') && resp.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.getByRole('button', { name: 'Sign out other sessions' }).click();

    const response = await revokeResponse;
    expect(response.ok()).toBeTruthy();
    await expect(page.getByText(/Revoked \d+ session/)).toBeVisible({ timeout: 15_000 });

    await secondContext.close();
  });
});
