import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER } from './helpers/demo-credentials';

test.describe('User management smoke', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
      return;
    }
    await login(page, DEMO_OWNER);
  });

  test('overview loads KPIs and navigation', async ({ page }) => {
    const overviewResponse = page.waitForResponse(
      (resp) => resp.url().includes('/identity/overview') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/settings/users');
    await overviewResponse;

    await expect(page.getByRole('heading', { name: 'User management', level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'User management' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Overview', level: 2 })).toBeVisible();
  });

  test('directory lists users with filters', async ({ page }) => {
    const usersResponse = page.waitForResponse(
      (resp) => resp.url().includes('/identity/users') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/settings/users/directory');
    await usersResponse;

    await expect(page.getByRole('heading', { name: 'User directory', level: 2 })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Email' })).toBeVisible();
    await expect(page.getByText(DEMO_OWNER.email)).toBeVisible({ timeout: 15_000 });
  });

  test('user detail shows tabbed profile', async ({ page }) => {
    await page.goto('/settings/users/directory');
    await expect(page.getByText(DEMO_OWNER.email)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('link', { name: 'View profile' }).first().click();

    await expect(page.getByRole('tab', { name: 'Profile' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Employment' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Security' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Sessions' })).toBeVisible();
    await page.getByRole('tab', { name: 'Login history' }).click();
    await expect(page.getByRole('heading', { name: 'Login history', level: 3 })).toBeVisible();
  });

  test('create user wizard renders invite tab', async ({ page }) => {
    await page.goto('/settings/users/create');

    await expect(page.getByRole('heading', { name: 'Create user', level: 2 })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Email invitation' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send invitation' })).toBeVisible();
  });

  test('create user wizard shows SMS tab when feature enabled', async ({ page }) => {
    const featuresResponse = page.waitForResponse(
      (resp) => resp.url().includes('/identity/features') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/settings/users/create');
    const features = await featuresResponse.then((r) => r.json() as Promise<Record<string, boolean>>);
    if (!features.smsInvites) {
      test.skip(true, 'smsInvites not enabled on demo tenant');
      return;
    }
    await expect(page.getByRole('tab', { name: 'SMS invitation' })).toBeVisible();
  });

  test('roles page loads custom roles section', async ({ page }) => {
    await page.goto('/settings/users/roles');
    await expect(page.getByRole('heading', { name: 'Roles & permissions', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Custom roles', level: 3 })).toBeVisible();
  });

  test('overview shows regions admin for managers', async ({ page }) => {
    await page.goto('/settings/users');
    await expect(page.getByRole('heading', { name: 'Regions', level: 3 })).toBeVisible({ timeout: 15_000 });
  });

  test('user detail employment tab shows region access', async ({ page }) => {
    await page.goto('/settings/users/directory');
    await expect(page.getByText(DEMO_OWNER.email)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('link', { name: 'View profile' }).first().click();
    await page.getByRole('tab', { name: 'Employment' }).click();
    await expect(page.getByRole('heading', { name: 'Employment', level: 3 })).toBeVisible();
    await expect(page.getByText('Regional access')).toBeVisible({ timeout: 10_000 });
  });

  test('directory import panel is visible', async ({ page }) => {
    await page.goto('/settings/users/directory');
    await expect(page.getByRole('heading', { name: 'Import users', level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choose CSV or Excel file' })).toBeVisible();
  });

  test('audit page loads', async ({ page }) => {
    await page.goto('/settings/users/audit');
    await expect(page.getByRole('heading', { name: 'Identity audit log', level: 2 })).toBeVisible();
  });

  test('invitations page loads', async ({ page }) => {
    const invitationsResponse = page.waitForResponse(
      (resp) => resp.url().includes('/identity/invitations') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/settings/users/invitations');
    await invitationsResponse;

    await expect(page.getByRole('heading', { name: 'Pending invitations', level: 2 })).toBeVisible();
  });
});
