import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import {
  DEMO_ACCOUNTANT,
  DEMO_BRANCH_MANAGER,
  DEMO_DENTIST,
  DEMO_DOCTOR,
  DEMO_GENERAL_MANAGER,
  DEMO_INVENTORY_MANAGER,
  DEMO_NURSE,
  DEMO_OWNER,
  DEMO_RECEPTIONIST,
} from './helpers/demo-credentials';

function mainContent(page: Page) {
  return page.locator('#main-content');
}

function dashboardWidgets(page: Page) {
  return page.locator('#dashboard-region');
}

test.describe('Dashboard role profiles', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('owner sees executive widgets and business health', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/');
    const main = mainContent(page);
    const widgets = dashboardWidgets(page);
    await widgets.waitFor({ state: 'visible' });

    await expect(main.getByText('Owner dashboard', { exact: true })).toBeVisible();
    await expect(main.getByText(/Executive overview/i)).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Business health metrics', level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Revenue summary', level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Subscription status', level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Notifications', level: 2 })).toBeVisible();
    await expect(widgets.getByText('Low stock alert')).toBeVisible();
  });

  test('receptionist sees operational widgets without revenue chart', async ({ page }) => {
    await login(page, DEMO_RECEPTIONIST);
    await page.goto('/');
    const main = mainContent(page);
    const widgets = dashboardWidgets(page);
    await widgets.waitFor({ state: 'visible' });

    await expect(main.getByText('Reception', { exact: true })).toBeVisible();
    await expect(main.getByText(/Front desk focus/i)).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Queue status', level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: "Today's appointments", level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Daily revenue trend', level: 2 })).toHaveCount(0);
    await expect(widgets.getByRole('navigation', { name: 'Quick actions' }).getByRole('link', { name: 'Inventory' })).toHaveCount(0);
  });

  test('doctor sees clinical widgets and encounters quick action', async ({ page }) => {
    await login(page, DEMO_DOCTOR);
    await page.goto('/');
    const main = mainContent(page);
    const widgets = dashboardWidgets(page);
    await widgets.waitFor({ state: 'visible' });

    await expect(main.getByText(/clinical day/i)).toBeVisible();
    await expect(widgets.getByRole('heading', { name: "Today's appointments", level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Treatment statistics', level: 2 })).toBeVisible();
    await expect(widgets.getByRole('navigation', { name: 'Quick actions' }).getByRole('link', { name: 'Encounters' })).toBeVisible();
  });

  test('dentist sees dental clinical widgets', async ({ page }) => {
    await login(page, DEMO_DENTIST);
    await page.goto('/');
    const main = mainContent(page);
    const widgets = dashboardWidgets(page);
    await widgets.waitFor({ state: 'visible' });

    await expect(main.getByText(/Dental workflow/i)).toBeVisible();
    await expect(widgets.getByRole('heading', { name: "Today's appointments", level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Treatment statistics', level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Branch performance', level: 2 })).toHaveCount(0);
  });

  test('nurse sees care coordination widgets', async ({ page }) => {
    await login(page, DEMO_NURSE);
    await page.goto('/');
    const main = mainContent(page);
    const widgets = dashboardWidgets(page);
    await widgets.waitFor({ state: 'visible' });

    await expect(main.getByText(/Care coordination/i)).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Queue status', level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: "Today's appointments", level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Revenue summary', level: 2 })).toHaveCount(0);
  });

  test('general manager sees multi-branch operations without subscription widget', async ({ page }) => {
    await login(page, DEMO_GENERAL_MANAGER);
    await page.goto('/');
    const main = mainContent(page);
    const widgets = dashboardWidgets(page);
    await widgets.waitFor({ state: 'visible' });

    await expect(main.getByText('General manager', { exact: true })).toBeVisible();
    await expect(main.getByText(/Multi-branch operations/i)).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Business health metrics', level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Branch performance', level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Queue status', level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Subscription status', level: 2 })).toHaveCount(0);
  });

  test('branch manager sees branch-scoped operations without multi-branch analytics', async ({ page }) => {
    await login(page, DEMO_BRANCH_MANAGER);
    await page.goto('/');
    const main = mainContent(page);
    const widgets = dashboardWidgets(page);
    await widgets.waitFor({ state: 'visible' });

    await expect(main.getByText('Branch manager', { exact: true })).toBeVisible();
    await expect(main.getByText(/Your branch/i)).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Queue status', level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: "Today's appointments", level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Branch performance', level: 2 })).toHaveCount(0);
    await expect(widgets.getByRole('heading', { name: 'Business health metrics', level: 2 })).toHaveCount(0);
  });

  test('accountant sees finance widgets without queue status', async ({ page }) => {
    await login(page, DEMO_ACCOUNTANT);
    await page.goto('/');
    const main = mainContent(page);
    const widgets = dashboardWidgets(page);
    await widgets.waitFor({ state: 'visible' });

    await expect(main.getByText(/Finance dashboard/i)).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Revenue summary', level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Outstanding payments', level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Daily revenue trend', level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Queue status', level: 2 })).toHaveCount(0);
  });

  test('inventory manager sees stock widgets only', async ({ page }) => {
    await login(page, DEMO_INVENTORY_MANAGER);
    await page.goto('/');
    const main = mainContent(page);
    const widgets = dashboardWidgets(page);
    await widgets.waitFor({ state: 'visible' });

    await expect(main.getByText(/Stock health/i)).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Inventory alerts', level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Low stock items', level: 2 })).toBeVisible();
    await expect(widgets.getByRole('heading', { name: 'Revenue summary', level: 2 })).toHaveCount(0);
  });

  test('customize layout hides a widget until reset', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/');
    const main = mainContent(page);
    const widgets = dashboardWidgets(page);
    await widgets.waitFor({ state: 'visible' });

    await main.getByRole('button', { name: 'Customize' }).click();
    const dialog = page.getByRole('dialog', { name: 'Customize dashboard' });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Business health metrics').uncheck();
    await dialog.getByRole('button', { name: 'Save layout' }).click();

    await expect(widgets.getByRole('heading', { name: 'Business health metrics', level: 2 })).toHaveCount(0);

    await main.getByRole('button', { name: 'Customize' }).click();
    await dialog.getByRole('button', { name: 'Reset to default' }).click();
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(widgets.getByRole('heading', { name: 'Business health metrics', level: 2 })).toBeVisible();
  });
});
