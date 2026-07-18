import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER, DEMO_TENANT_ID } from './helpers/demo-credentials';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3000';

test.describe('Clinic dashboard smoke', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('dashboard overview API returns live metrics for owner', async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      headers: { 'x-tenant-id': DEMO_TENANT_ID },
      data: {
        email: DEMO_OWNER.email,
        password: DEMO_OWNER.password,
        tenantId: DEMO_TENANT_ID,
        deviceName: 'playwright-dashboard',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = (await loginRes.json()) as { accessToken: string };

    const overviewRes = await request.get(`${API_BASE}/dashboard/overview`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': DEMO_TENANT_ID,
      },
    });
    expect(overviewRes.ok(), await overviewRes.text()).toBeTruthy();

    const body = (await overviewRes.json()) as { kpis: { totalPatients: number } };
    expect(body.kpis.totalPatients).not.toBe(1842);
  });

  test('dashboard branches API lists active branches for owner', async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      headers: { 'x-tenant-id': DEMO_TENANT_ID },
      data: {
        email: DEMO_OWNER.email,
        password: DEMO_OWNER.password,
        tenantId: DEMO_TENANT_ID,
        deviceName: 'playwright-dashboard-branches',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = (await loginRes.json()) as { accessToken: string };

    const branchesRes = await request.get(`${API_BASE}/dashboard/branches`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': DEMO_TENANT_ID,
      },
    });
    expect(branchesRes.ok(), await branchesRes.text()).toBeTruthy();

    const body = (await branchesRes.json()) as { branches: Array<{ name: string }> };
    expect(body.branches.length).toBeGreaterThanOrEqual(2);
    expect(body.branches.some((b) => b.name === 'North Branch')).toBe(true);
  });

  test('dashboard overview API returns 30-day trends when range=30d', async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      headers: { 'x-tenant-id': DEMO_TENANT_ID },
      data: {
        email: DEMO_OWNER.email,
        password: DEMO_OWNER.password,
        tenantId: DEMO_TENANT_ID,
        deviceName: 'playwright-dashboard-range',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = (await loginRes.json()) as { accessToken: string };

    const overviewRes = await request.get(`${API_BASE}/dashboard/overview?range=30d`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': DEMO_TENANT_ID,
      },
    });
    expect(overviewRes.ok(), await overviewRes.text()).toBeTruthy();

    const body = (await overviewRes.json()) as {
      revenueTrend: unknown[];
      appointmentTrend: unknown[];
    };
    expect(body.revenueTrend).toHaveLength(30);
    expect(body.appointmentTrend).toHaveLength(30);
  });

  test('owner dashboard loads widgets from live overview', async ({ page }) => {
    const overviewStatuses: number[] = [];
    page.on('response', (resp) => {
      if (resp.url().includes('/dashboard/overview') && resp.request().method() === 'GET') {
        overviewStatuses.push(resp.status());
      }
    });

    await login(page, DEMO_OWNER);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
    await expect(page.getByText('Owner dashboard')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'KPI overview', level: 2 })).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole('navigation', { name: 'Quick actions' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();

    await expect
      .poll(() => overviewStatuses.some((status) => status >= 200 && status < 300), {
        timeout: 20_000,
      })
      .toBe(true);
    await expect(page.getByText('Live API unavailable — displaying sample metrics.')).toHaveCount(
      0,
    );
    await expect(page.getByText('1,842')).toHaveCount(0);
  });

  test('range toolbar refetches overview with range=30d', async ({ page }) => {
    const overviewUrls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/dashboard/overview') && req.method() === 'GET') {
        overviewUrls.push(req.url());
      }
    });

    await login(page, DEMO_OWNER);
    await page.goto('/');
    await page.locator('#dashboard-region').waitFor({ state: 'visible' });

    await page.getByRole('button', { name: '30 days' }).click();

    await expect
      .poll(() => overviewUrls.some((url) => url.includes('range=30d')), { timeout: 10_000 })
      .toBe(true);
  });

  test('branch selector refetches overview with branchId', async ({ page }) => {
    const overviewUrls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/dashboard/overview') && req.method() === 'GET') {
        overviewUrls.push(req.url());
      }
    });

    await login(page, DEMO_OWNER);
    await page.goto('/');
    await page.locator('#dashboard-region').waitFor({ state: 'visible' });

    await page.getByLabel('Branch').selectOption({ label: 'North Branch' });

    await expect
      .poll(
        () =>
          overviewUrls.some((url) =>
            url.includes('branchId=a1000000-0000-4000-8000-000000000008'),
          ),
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test('dashboard widget filter narrows visible widgets', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/');
    await page.locator('#dashboard-region').waitFor({ state: 'visible' });

    await page.getByLabel('Filter widgets…').fill('revenue');
    await expect(page.getByRole('heading', { name: 'Revenue summary', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quick actions', level: 2 })).toHaveCount(0);
  });

  test('quick actions navigate to appointments', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/');
    await page.locator('#dashboard-region').waitFor({ state: 'visible' });

    await page.getByRole('navigation', { name: 'Quick actions' }).getByRole('link', {
      name: 'Appointments',
    }).click();
    await expect(page).toHaveURL(/\/appointments$/);
  });

  test('owner dashboard shows business health from live API', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/');
    await page.locator('#dashboard-region').waitFor({ state: 'visible' });

    await expect(
      page.getByRole('heading', { name: 'Business health metrics', level: 2 }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test('export Excel and Word buttons are available on dashboard', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/');
    await page.locator('#dashboard-region').waitFor({ state: 'visible' });

    await expect(page.getByRole('button', { name: 'Export Excel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export Word' })).toBeVisible();
  });

  test('KPI patients card navigates to patients list', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/');
    await page.locator('#dashboard-region').waitFor({ state: 'visible' });

    await page.getByRole('link', { name: /Patients:/i }).click();
    await expect(page).toHaveURL(/\/patients$/);
  });

  test('category filter narrows widgets and syncs URL', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/');
    await page.locator('#dashboard-region').waitFor({ state: 'visible' });

    await page.getByRole('button', { name: 'Finance' }).click();
    await expect(page).toHaveURL(/category=finance/);
    await expect(page.getByRole('heading', { name: 'Revenue summary', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Quick actions', level: 2 })).toHaveCount(0);
  });

  test('outstanding payments drill-down opens billing with focus', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/');
    await page.locator('#dashboard-region').waitFor({ state: 'visible' });

    await page
      .getByRole('link', { name: /Outstanding:/i })
      .click();
    await expect(page).toHaveURL(/\/billing\/outstanding/);
  });
});
