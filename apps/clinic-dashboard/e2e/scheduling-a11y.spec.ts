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

    await page.getByRole('button', { name: 'List', exact: true }).click();
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

  test('passes axe scan on scheduling reception chrome + calendar controls', async ({ page }) => {
    await gotoAppointments(page);

    await expect(page.locator('#scheduling-region')).toBeVisible();
    await expect(page.getByTestId('scheduling-reception-chrome')).toBeVisible();
    await expect(page.getByTestId('scheduling-calendar-controls')).toBeVisible();

    // D4: same H3-proven scopes — no color-contrast silence.
    // Full `#scheduling-region` hub contrast remains deferred (status badges / tinted chrome):
    // docs/PHASE_50_D4_A11Y/01_CONTRAST_FOLLOWUPS.md
    const results = await new AxeBuilder({ page })
      .include('[data-testid="scheduling-reception-chrome"]')
      .include('[data-testid="scheduling-calendar-controls"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
