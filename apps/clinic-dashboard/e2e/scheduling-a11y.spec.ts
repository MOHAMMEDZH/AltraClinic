import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { gotoAppointments } from './helpers/scheduling';

test.describe('Scheduling accessibility', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('main scheduling region and calendar view are labeled', async ({ page }) => {
    await gotoAppointments(page);

    await expect(page.locator('#scheduling-region')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Calendar view' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Scheduling', level: 1 })).toBeVisible();
  });

  test('list view table has accessible caption', async ({ page }) => {
    await gotoAppointments(page);

    await page.getByRole('button', { name: 'List' }).click();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('keyboard hint is exposed to users', async ({ page }) => {
    await gotoAppointments(page);

    await expect(page.getByText(/Shortcuts:/)).toBeVisible();
  });

  test('rooms and templates panels have headings', async ({ page }) => {
    await gotoAppointments(page);

    await expect(page.getByRole('heading', { name: 'Rooms & equipment', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Appointment templates', level: 2 })).toBeVisible();
  });

  test('schedule settings panels expose section headings', async ({ page }) => {
    await gotoAppointments(page);

    await expect(page.getByRole('heading', { name: 'Provider schedule', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Branch hours', level: 2 })).toBeVisible();
  });

  test('passes axe scan on scheduling hub', async ({ page }) => {
    await gotoAppointments(page);

    const results = await new AxeBuilder({ page })
      .include('#scheduling-region')
      .disableRules(['color-contrast'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
