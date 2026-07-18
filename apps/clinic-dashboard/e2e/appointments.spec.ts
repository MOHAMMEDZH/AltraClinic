import { test, expect } from '@playwright/test';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { gotoAppointments } from './helpers/scheduling';

test.describe('Scheduling module', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('appointments page loads with metrics and calendar views', async ({ page }) => {
    await gotoAppointments(page);

    await expect(page.getByRole('heading', { name: 'Scheduling', level: 1 })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Calendar view' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Day', pressed: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Month' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resources' })).toBeVisible();
  });

  test('queue overview strip links to queue board', async ({ page }) => {
    await gotoAppointments(page);

    await expect(page.getByRole('heading', { name: 'Queue overview', level: 2 })).toBeVisible();
    await page.getByRole('link', { name: 'Open queue board' }).click();
    await expect(page).toHaveURL(/\/queue/);
  });

  test('status filter syncs to URL', async ({ page }) => {
    await gotoAppointments(page);

    await page.getByLabel('Status').selectOption('confirmed');
    await expect(page).toHaveURL(/status=confirmed/);
  });

  test('month view switches calendar mode', async ({ page }) => {
    await gotoAppointments(page);

    await page.getByRole('button', { name: 'Month' }).click();
    await expect(page).toHaveURL(/view=month/);
    await expect(page.getByRole('grid', { name: /Month/ })).toBeVisible();
  });

  test('owner can open new appointment modal', async ({ page }) => {
    await gotoAppointments(page);

    await page.getByRole('button', { name: 'New appointment' }).click();
    await expect(page.getByRole('heading', { name: 'Schedule appointment' })).toBeVisible();
    await expect(page.getByLabel('Patient', { exact: true })).toBeVisible();
  });

  test('waitlist panel is visible for owner', async ({ page }) => {
    await gotoAppointments(page);

    await expect(page.getByRole('heading', { name: 'Waitlist', level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to waitlist' })).toBeVisible();
  });

  test('metrics period date inputs are visible', async ({ page }) => {
    await gotoAppointments(page);

    await expect(page.getByText('Metrics period')).toBeVisible();
    await expect(page.locator('input[type="date"]').first()).toBeVisible();
  });

  test('scheduling analytics panel is visible', async ({ page }) => {
    await gotoAppointments(page);

    await expect(page.getByRole('heading', { name: 'Scheduling analytics', level: 2 })).toBeVisible();
    await expect(page.getByText('Completion rate')).toBeVisible();
  });

  test('new appointment form includes service type', async ({ page }) => {
    await gotoAppointments(page);

    await page.getByRole('button', { name: 'New appointment' }).click();
    await expect(page.getByLabel('Service type')).toBeVisible();
    await expect(page.getByText('Repeat appointment')).toBeVisible();
  });

  test('rooms and templates panels visible', async ({ page }) => {
    await gotoAppointments(page);

    await expect(page.getByRole('heading', { name: 'Rooms & equipment', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Appointment templates', level: 2 })).toBeVisible();
  });

  test('list view shows bulk reschedule controls when selecting', async ({ page }) => {
    await gotoAppointments(page);

    await page.getByRole('button', { name: 'List' }).click();
    const checkbox = page.getByRole('checkbox').first();
    if ((await checkbox.count()) === 0) {
      test.skip(true, 'No appointments for bulk select');
    }
    await checkbox.check();
    await expect(page.getByText(/selected/)).toBeVisible();
  });

  test('cancel appointment opens reason dialog from detail panel', async ({ page }) => {
    await gotoAppointments(page);

    const appointment = page.locator('[data-appt-id]').first();
    if ((await appointment.count()) === 0) {
      test.skip(true, 'No appointments in schedule for cancel flow');
    }

    await appointment.click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Cancel appointment' })).toBeVisible();
    await expect(page.getByLabel('Cancellation reason')).toBeVisible();
  });
});
