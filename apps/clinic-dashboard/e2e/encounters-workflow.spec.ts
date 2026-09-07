import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_DOCTOR } from './helpers/demo-credentials';

test.describe('EMR full clinical workflow', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('create → document SOAP → complete → sign', async ({ page }) => {
    // Use a non-canonical demo encounter so combined batches do not mutate e1000000-…001
    // relied on by encounters.spec.ts lifecycle assertions.
    const workflowEncounterId = 'e1000000-0000-4000-8000-000000000003';
    await login(page, DEMO_DOCTOR);
    await page.goto(`/encounters/${workflowEncounterId}`);
    await expect(page.locator('#encounters-detail-region')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('tab', { name: /Clinical notes|notes/i }).click();
    const subjective = page.locator('#soap-subjective');
    await expect(subjective).toBeVisible();
    await subjective.fill('E2E subjective documentation');

    const saveBtn = page.getByRole('button', { name: 'Save documentation' });
    await saveBtn.click();
    await expect(page.getByText(/saved|Clinical documentation saved/i)).toBeVisible({ timeout: 10_000 });

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Mark complete' }).click();
    await expect(page.getByText(/complete|marked complete/i).first()).toBeVisible({ timeout: 10_000 });

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Sign & finalize' }).click();
    await expect(
      page.locator('#encounters-detail-region').getByText(/signed|finalized|read-only/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
