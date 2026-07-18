import { test, expect } from '@playwright/test';
import { login, logout } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER, DEMO_TENANT_ID } from './helpers/demo-credentials';

test.describe('Auth login smoke', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('login page renders sign-in form and forgot-password link', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByLabel('Organization ID')).toBeVisible();
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
  });

  test('invalid credentials show an error and stay on login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Organization ID').fill(DEMO_TENANT_ID);
    await page.getByLabel('Email', { exact: true }).fill('not-a-user@demo.clinic');
    await page.getByLabel('Password', { exact: true }).fill('WrongPassword1!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toContainText('Invalid email or password.');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('owner signs in and reaches the authenticated shell', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });

  test('protected routes redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/settings/security');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('user menu sign-out returns to login', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await logout(page);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});
