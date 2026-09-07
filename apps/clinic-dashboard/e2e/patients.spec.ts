import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER, DEMO_RECEPTIONIST } from './helpers/demo-credentials';
import { patientNameFromRowLink } from './helpers/patients';
import { globalSearchInput, openGlobalSearch } from './helpers/dynamic-search';

test.describe('Patients module', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('patients list loads for owner', async ({ page }) => {
    await login(page, DEMO_OWNER);

    const listResponse = page.waitForResponse(
      (resp) => resp.url().includes('/patients') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/patients');
    await listResponse;

    await expect(page.locator('#patients-region')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Patients', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export' })).toBeVisible();
  });

  test('global search opens with Ctrl+K and shows dialog', async ({ page }) => {
    await login(page, DEMO_RECEPTIONIST);
    await page.goto('/patients');
    await expect(page.locator('#patients-region')).toBeVisible({ timeout: 15_000 });

    await openGlobalSearch(page);
    await expect(globalSearchInput(page)).toBeVisible();
    await expect(page.getByPlaceholder(/Search patients|patients by name/i)).toBeVisible();
  });

  test('navigating to patient detail shows profile actions', async ({ page }) => {
    await login(page, DEMO_RECEPTIONIST);

    const listResponse = page.waitForResponse(
      (resp) => resp.url().includes('/patients') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/patients');
    await listResponse;
    await expect(page.locator('#patients-region')).toBeVisible({ timeout: 15_000 });

    const firstPatientLink = page.locator('#patients-region table tbody a').first();
    await expect(firstPatientLink).toBeVisible({ timeout: 10_000 });
    await firstPatientLink.click();

    await expect(page).toHaveURL(/\/patients\/.+/);
    await expect(page.locator('#patients-detail-region')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Check in' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'WhatsApp', exact: true })).toBeVisible();
  });

  test('gender filter narrows patient list', async ({ page }) => {
    await login(page, DEMO_RECEPTIONIST);

    const listResponse = page.waitForResponse(
      (resp) => resp.url().includes('/patients') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/patients');
    await listResponse;
    await expect(page.locator('#patients-region')).toBeVisible({ timeout: 15_000 });

    const genderResponse = page.waitForResponse(
      (resp) => resp.url().includes('/patients') && resp.url().includes('gender=female'),
      { timeout: 20_000 },
    );
    await page.getByRole('group', { name: 'Gender filter' }).getByRole('button', { name: 'Female' }).click();
    await genderResponse;
  });

  test('bulk selection bar appears when selecting patients', async ({ page }) => {
    await login(page, DEMO_OWNER);

    const listResponse = page.waitForResponse(
      (resp) => resp.url().includes('/patients') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/patients');
    await listResponse;
    await expect(page.locator('#patients-region')).toBeVisible({ timeout: 15_000 });

    await page.locator('#patients-region table tbody input[type="checkbox"]').first().check();
    await expect(page.getByRole('region', { name: 'Bulk actions' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export selected' })).toBeVisible();
  });

  test('patients list syncs filters to URL', async ({ page }) => {
    await login(page, DEMO_RECEPTIONIST);
    await page.goto('/patients?gender=female&status=all');
    await expect(page.locator('#patients-region')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/gender=female/);
    await expect(page).toHaveURL(/status=all/);
  });

  test('owner can export patient summary from detail', async ({ page }) => {
    await login(page, DEMO_OWNER);

    const listResponse = page.waitForResponse(
      (resp) => resp.url().includes('/patients') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/patients');
    await listResponse;

    const firstPatientLink = page.locator('#patients-region table tbody a').first();
    await expect(firstPatientLink).toBeVisible({ timeout: 10_000 });
    await firstPatientLink.click();
    await expect(page.getByRole('button', { name: 'Export Word' })).toBeVisible();
  });

  test('patient detail shows book appointment for receptionist', async ({ page }) => {
    await login(page, DEMO_RECEPTIONIST);

    const listResponse = page.waitForResponse(
      (resp) => resp.url().includes('/patients') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/patients');
    await listResponse;

    const firstPatientLink = page.locator('#patients-region table tbody a').first();
    await expect(firstPatientLink).toBeVisible({ timeout: 10_000 });
    await firstPatientLink.click();
    await expect(page.locator('#patients-detail-region')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Book appointment' })).toBeVisible();
  });

  test('recent patients panel appears after visiting a patient', async ({ page }) => {
    await login(page, DEMO_RECEPTIONIST);

    const listResponse = page.waitForResponse(
      (resp) => resp.url().includes('/patients') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/patients');
    await listResponse;

    const firstPatientLink = page.locator('#patients-region table tbody a').first();
    await expect(firstPatientLink).toBeVisible({ timeout: 10_000 });
    const patientName = await patientNameFromRowLink(firstPatientLink);
    await firstPatientLink.click();
    await expect(page).toHaveURL(/\/patients\/.+/);
    await expect(page.locator('#patients-detail-region')).toBeVisible({ timeout: 15_000 });

    await page.goto('/patients');
    await expect(page.locator('#patients-region')).toBeVisible({ timeout: 15_000 });
    if (patientName) {
      const recent = page.getByRole('region', { name: 'Recent patients' });
      await expect(recent).toBeVisible({ timeout: 15_000 });
      await expect(recent.getByRole('link', { name: patientName })).toBeVisible({ timeout: 15_000 });
    }
  });

  test('patient detail activity tab supports timeline filters', async ({ page }) => {
    await login(page, DEMO_RECEPTIONIST);

    const listResponse = page.waitForResponse(
      (resp) => resp.url().includes('/patients') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/patients');
    await listResponse;

    const firstPatientLink = page.locator('#patients-region table tbody a').first();
    await expect(firstPatientLink).toBeVisible({ timeout: 10_000 });
    await firstPatientLink.click();
    await expect(page.locator('#patients-detail-region')).toBeVisible();

    await page.getByRole('tab', { name: 'Activity' }).click();
    await expect(page.getByRole('group', { name: 'Timeline filter' })).toBeVisible();
    await page.getByRole('button', { name: 'Appointments', pressed: false }).click();
    await expect(page.getByRole('button', { name: 'Appointments' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('patient detail documents tab shows attachments section', async ({ page }) => {
    await login(page, DEMO_OWNER);

    const listResponse = page.waitForResponse(
      (resp) => resp.url().includes('/patients') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/patients');
    await listResponse;

    const firstPatientLink = page.locator('#patients-region table tbody a').first();
    await expect(firstPatientLink).toBeVisible({ timeout: 10_000 });
    await firstPatientLink.click();
    await expect(page.locator('#patients-detail-region')).toBeVisible();

    await page.getByRole('tab', { name: 'Documents' }).click();
    await expect(page.getByRole('heading', { name: 'Attachments', level: 3 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload document' })).toBeVisible();
  });

  test('owner sees branch filter on patients list', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/patients');
    await expect(page.locator('#patients-region')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Branch')).toBeVisible();
  });

  test('patient detail shows check-out for owner', async ({ page }) => {
    await login(page, DEMO_OWNER);

    const listResponse = page.waitForResponse(
      (resp) => resp.url().includes('/patients') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await page.goto('/patients');
    await listResponse;

    const firstPatientLink = page.locator('#patients-region table tbody a').first();
    await expect(firstPatientLink).toBeVisible({ timeout: 10_000 });
    await firstPatientLink.click();
    await expect(page.locator('#patients-detail-region')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Check out' })).toBeVisible();
  });
});
