import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { login } from './helpers/auth';
import { DEMO_OWNER } from './helpers/demo-credentials';

const downloadDir = path.join(process.cwd(), 'e2e', '.qa-downloads');

test.describe('QA — export & report UI', () => {
  test.beforeAll(() => {
    fs.mkdirSync(downloadDir, { recursive: true });
  });

  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(90_000);
    await page.context().setExtraHTTPHeaders({});
    await login(page, DEMO_OWNER);
  });

  test('dashboard: live data, export Excel and Word download', async ({ page }) => {
    const overviewOk = page.waitForResponse(
      (r) => r.url().includes('/dashboard/overview') && r.request().method() === 'GET' && r.ok(),
    );
    await page.goto('/');
    await overviewOk;
    await page.locator('#dashboard-region').waitFor({ state: 'visible' });

    await expect(page.getByText('Live API unavailable')).toHaveCount(0);

    const excelDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export Excel' }).click();
    const excel = await excelDownload;
    expect(excel.suggestedFilename()).toMatch(/\.xlsx$/i);
    await excel.saveAs(path.join(downloadDir, excel.suggestedFilename()));

    const wordDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export Word' }).click();
    const word = await wordDownload;
    expect(word.suggestedFilename()).toMatch(/\.docx$/i);
    await word.saveAs(path.join(downloadDir, word.suggestedFilename()));
  });

  test('analytics: live data, exports, generate report, download seeded report', async ({ page }) => {
    const overviewOk = page.waitForResponse(
      (r) => r.url().includes('/analytics/overview') && r.request().method() === 'GET' && r.ok(),
      { timeout: 45_000 },
    );
    await page.goto('/analytics/executive');
    await overviewOk;
    await page.locator('#analytics-region').waitFor({ state: 'visible', timeout: 45_000 });

    await expect(page.getByText('Live API unavailable')).toHaveCount(0);
    await expect(page.getByText('Monthly revenue summary')).toBeVisible({ timeout: 45_000 });

    const excelDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export Excel' }).first().click();
    const excel = await excelDownload;
    expect(excel.suggestedFilename()).toMatch(/\.xlsx$/i);

    const wordDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export Word' }).first().click();
    const word = await wordDownload;
    expect(word.suggestedFilename()).toMatch(/\.docx$/i);

    const reportsBefore = await page.getByRole('listitem').filter({ hasText: 'Analytics (' }).count();

    const createReport = page.waitForResponse(
      (r) => r.url().includes('/analytics/reports') && r.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await page.getByRole('button', { name: 'Generate report' }).click();
    const createResp = await createReport;
    expect(createResp.ok(), `Generate report failed: ${createResp.status()}`).toBeTruthy();
    await expect(page.getByRole('listitem').filter({ hasText: 'Analytics (' })).toHaveCount(
      reportsBefore + 1,
      { timeout: 15_000 },
    );

    const downloadReport = page.waitForEvent('download');
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Monthly revenue summary' })
      .getByRole('button', { name: 'Download' })
      .click();
    const reportFile = await downloadReport;
    expect(reportFile.suggestedFilename()).toMatch(/\.(csv|xlsx|pdf|json)$/i);
    await reportFile.saveAs(path.join(downloadDir, reportFile.suggestedFilename()));
  });
});
