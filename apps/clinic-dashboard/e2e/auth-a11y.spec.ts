import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER, DEMO_TENANT_ID } from './helpers/demo-credentials';
import { mintEmailVerificationToken, mintPasswordResetToken, restoreDemoSeed } from './helpers/auth-tokens';

test.describe('Auth accessibility', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('login page passes axe on the auth form region', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#auth-main').waitFor({ state: 'visible' });

    const results = await new AxeBuilder({ page })
      .include('#auth-main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('forgot-password page passes axe on the auth form region', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.locator('#auth-main').waitFor({ state: 'visible' });

    const results = await new AxeBuilder({ page })
      .include('#auth-main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('reset-password page passes axe on the auth form region', async ({ page }) => {
    const token = mintPasswordResetToken(DEMO_OWNER.email, DEMO_TENANT_ID);
    await page.goto(`/reset-password?token=${encodeURIComponent(token)}&tenantId=${DEMO_TENANT_ID}`);
    await page.locator('#auth-main').waitFor({ state: 'visible' });

    const results = await new AxeBuilder({ page })
      .include('#auth-main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
    restoreDemoSeed();
  });

  test('verify-email page passes axe on the auth form region', async ({ page }) => {
    const token = mintEmailVerificationToken(DEMO_OWNER.email, DEMO_TENANT_ID);

    const verifyResponse = page.waitForResponse(
      (resp) => resp.url().includes('/auth/verify-email') && resp.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.goto(`/verify-email?token=${encodeURIComponent(token)}&tenantId=${DEMO_TENANT_ID}`);
    const response = await verifyResponse;
    expect(response.ok()).toBeTruthy();
    await page.locator('#auth-main').waitFor({ state: 'visible' });
    await expect(page.getByText('Email verified')).toBeVisible({ timeout: 15_000 });

    const results = await new AxeBuilder({ page })
      .include('#auth-main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
    restoreDemoSeed();
  });

  test('MFA verification page passes axe on the auth form region', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate((tenantId) => {
      sessionStorage.setItem(
        'booking.mfaChallenge',
        JSON.stringify({
          mfaChallengeToken: 'axe-test-challenge',
          tenantId,
          expiresAt: Date.now() + 300_000,
        }),
      );
    }, DEMO_TENANT_ID);
    await page.goto('/mfa');
    await page.locator('#auth-main').waitFor({ state: 'visible' });

    const results = await new AxeBuilder({ page })
      .include('#auth-main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('security settings pass axe when authenticated', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/settings/security');
    await expect(page.getByRole('heading', { name: 'Account security' })).toBeVisible({
      timeout: 15_000,
    });

    const results = await new AxeBuilder({ page })
      .include('#security-settings-content')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('change password page passes axe when authenticated', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/settings/security/password');
    await expect(page.getByRole('heading', { name: 'Change password', level: 2 })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('#security-settings-content')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('profile security page passes axe when authenticated', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/settings/security/profile');
    await expect(page.getByRole('heading', { name: 'Profile security settings', level: 2 })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('#security-settings-content')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
