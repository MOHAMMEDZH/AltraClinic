import { test, expect, type Page } from '@playwright/test';
import { login, logout, type LoginCredentials } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import {
  DEMO_ACCOUNTANT,
  DEMO_DENTIST,
  DEMO_DOCTOR,
  DEMO_INVENTORY_MANAGER,
  DEMO_OWNER,
  DEMO_PATIENT_USER,
  DEMO_RECEPTIONIST,
  DEMO_SPECIALIST,
  DEMO_TENANT_ID,
} from './helpers/demo-credentials';
import { LICENSING_E2E_TENANTS } from './helpers/licensing-tenants';
import {
  assertShellVisible,
  captureRegistryBootstrap,
  readRegistryCacheRaw,
  waitForRegistryBootstrap,
} from './helpers/dynamic-routing';
import {
  assertDashboardWidgetHidden,
  assertDashboardWidgetVisible,
  assertNoDuplicateOverviewRequests,
  countDashboardWidgets,
  dashboardAccessibleResourcesFromBootstrap,
  dashboardRegion,
  dashboardWidgetTitles,
  gotoDashboard,
  waitForDashboardLoaded,
} from './helpers/dynamic-dashboard';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3000';
const ROLLBACK_BASE = process.env.PLAYWRIGHT_ROLLBACK_URL ?? 'http://127.0.0.1:5174';

test.describe.configure({ mode: 'serial', timeout: 90_000 });

test.beforeEach(({ }, testInfo) => {
  if (!isE2eApiReady()) {
    testInfo.skip(true, E2E_SKIP_REASON);
  }
});

async function loginAndDashboard(page: Page, credentials: LoginCredentials) {
  await page.goto('/login');
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.removeItem('booking.locale');
  });
  const bootstrap = captureRegistryBootstrap(page);
  await login(page, credentials);
  const response = await bootstrap;
  expect(response?.ok(), 'registry bootstrap should succeed').toBeTruthy();
  await waitForRegistryBootstrap(page);
  await gotoDashboard(page);
}

test.describe('Dynamic dashboard — role dashboards (registry mode)', () => {
  test('owner dashboard', async ({ page }) => {
    await loginAndDashboard(page, DEMO_OWNER);
    await assertDashboardWidgetVisible(page, /Quick actions/i);
    await assertDashboardWidgetVisible(page, /Business health|Revenue/i);
    const count = await countDashboardWidgets(page);
    expect(count).toBeGreaterThan(8);
  });

  test('receptionist dashboard', async ({ page }) => {
    await loginAndDashboard(page, DEMO_RECEPTIONIST);
    await assertDashboardWidgetVisible(page, /Queue/i);
    await assertDashboardWidgetVisible(page, /Appointments today|Today/i);
    await assertDashboardWidgetHidden(page, /Revenue trend|Revenue chart/i);
  });

  test('doctor dashboard', async ({ page }) => {
    await loginAndDashboard(page, DEMO_DOCTOR);
    await assertDashboardWidgetVisible(page, /Treatment|Clinical/i);
    await assertDashboardWidgetHidden(page, /Outstanding|Business health/i);
  });

  test('dentist dashboard', async ({ page }) => {
    await loginAndDashboard(page, DEMO_DENTIST);
    await assertDashboardWidgetVisible(page, /Treatment|Clinical|Patients/i);
    await assertDashboardWidgetHidden(page, /Inventory alerts/i);
  });

  test('beauty specialist dashboard', async ({ page }) => {
    await loginAndDashboard(page, DEMO_SPECIALIST);
    await assertDashboardWidgetVisible(page, /Quick actions/i);
    await assertDashboardWidgetVisible(page, /Treatment|Patients|Appointments/i);
  });

  test('inventory manager dashboard', async ({ page }) => {
    await loginAndDashboard(page, DEMO_INVENTORY_MANAGER);
    await assertDashboardWidgetVisible(page, /Inventory|Low stock/i);
    await assertDashboardWidgetHidden(page, /Recent activit|Audit activit/i);
  });

  test('accountant dashboard', async ({ page }) => {
    await loginAndDashboard(page, DEMO_ACCOUNTANT);
    await assertDashboardWidgetVisible(page, /Revenue|Outstanding/i);
    await assertDashboardWidgetVisible(page, /Business health/i);
  });

  test('patient dashboard', async ({ page }) => {
    await loginAndDashboard(page, DEMO_PATIENT_USER);
    await assertShellVisible(page);
    const count = await countDashboardWidgets(page);
    expect(count).toBeGreaterThan(0);
    await assertDashboardWidgetHidden(page, /Business health/i);
  });
});

test.describe('Dynamic dashboard — licensing lifecycle', () => {
  test('expired tenant', async ({ page }) => {
    const tenant = LICENSING_E2E_TENANTS.expired;
    await login(page, { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId }, { requireAppShell: false });
    await page.goto('/');
    await expect(page.getByTestId('enterprise-license-experience')).toBeVisible({ timeout: 45_000 });
  });

  test('suspended tenant', async ({ page }) => {
    const tenant = LICENSING_E2E_TENANTS.suspended;
    await login(page, { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId }, { requireAppShell: false });
    await page.goto('/');
    await expect(page.getByTestId('enterprise-license-experience')).toBeVisible({ timeout: 45_000 });
  });

  test('grace/read-only tenant', async ({ page }) => {
    const tenant = LICENSING_E2E_TENANTS.grace;
    await login(page, { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId }, { requireAppShell: false });
    await page.goto('/settings');
    await expect(page.getByTestId('enterprise-license-experience')).toBeVisible({ timeout: 45_000 });
  });

  test('starter plan', async ({ page, request }) => {
    const tenant = LICENSING_E2E_TENANTS.starter;
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      headers: { 'x-tenant-id': tenant.tenantId },
      data: { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId, deviceName: 'pw-dash-starter' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = (await loginRes.json()) as { accessToken: string };
    const bootstrapRes = await request.get(`${API_BASE}/tenant/modules/registry/bootstrap`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant-id': tenant.tenantId },
    });
    const body = await bootstrapRes.json();
    const analytics = body.modules.find((m: { moduleId: string }) => m.moduleId === 'analytics');
    expect(analytics?.userAccessible).toBe(false);

    await login(page, { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId });
    await gotoDashboard(page);
    await assertDashboardWidgetHidden(page, /Revenue trend|Business health/i);
  });

  test('enterprise plan', async ({ page, request }) => {
    const tenant = LICENSING_E2E_TENANTS.enterprise;
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      headers: { 'x-tenant-id': tenant.tenantId },
      data: { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId, deviceName: 'pw-dash-enterprise' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = (await loginRes.json()) as { accessToken: string };
    const bootstrapRes = await request.get(`${API_BASE}/tenant/modules/registry/bootstrap`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant-id': tenant.tenantId },
    });
    const body = await bootstrapRes.json();
    const analytics = body.modules.find((m: { moduleId: string }) => m.moduleId === 'analytics');
    expect(analytics?.userAccessible).toBe(true);

    await login(page, { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId });
    await gotoDashboard(page);
    await assertDashboardWidgetVisible(page, /Business health|Revenue/i);
  });
});

test.describe('Dynamic dashboard — widget visibility and blocking', () => {
  test('widget visibility', async ({ page }) => {
    await loginAndDashboard(page, DEMO_OWNER);
    const titles = await dashboardWidgetTitles(page);
    expect(titles.length).toBeGreaterThan(5);
    expect(titles.some((t) => /Quick actions/i.test(t))).toBe(true);
  });

  test('hidden widget', async ({ page }) => {
    await loginAndDashboard(page, DEMO_RECEPTIONIST);
    await assertDashboardWidgetHidden(page, /Revenue trend|Revenue chart/i);
  });

  test('dependency blocked widget', async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      headers: { 'x-tenant-id': DEMO_TENANT_ID },
      data: {
        email: DEMO_OWNER.email,
        password: DEMO_OWNER.password,
        tenantId: DEMO_TENANT_ID,
        deviceName: 'pw-dash-deps',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = (await loginRes.json()) as { accessToken: string };
    const bootstrapRes = await request.get(`${API_BASE}/tenant/modules/registry/bootstrap`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant-id': DEMO_TENANT_ID },
    });
    const body = await bootstrapRes.json();
    const analytics = body.modules.find((m: { moduleId: string }) => m.moduleId === 'analytics');
    expect(analytics?.dependencies?.length).toBeGreaterThan(0);
    const blocked = body.modules.filter((m: { lockReason?: string }) => m.lockReason === 'dependency');
    for (const mod of blocked) {
      const resources = dashboardAccessibleResourcesFromBootstrap({ modules: [mod] });
      expect(resources.length).toBe(0);
    }
  });

  test('license blocked widget', async ({ page }) => {
    const tenant = LICENSING_E2E_TENANTS.starter;
    await login(page, { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId });
    await gotoDashboard(page);
    await assertDashboardWidgetHidden(page, /Revenue trend/i);
  });
});

test.describe('Dynamic dashboard — refresh and navigation', () => {
  test('dashboard refresh', async ({ page }) => {
    await loginAndDashboard(page, DEMO_OWNER);
    const before = await countDashboardWidgets(page);
    await page.getByRole('button', { name: /Refresh/i }).click();
    await waitForDashboardLoaded(page);
    const after = await countDashboardWidgets(page);
    expect(after).toBe(before);
  });

  test('browser refresh', async ({ page }) => {
    await loginAndDashboard(page, DEMO_OWNER);
    const before = await dashboardWidgetTitles(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForDashboardLoaded(page);
    const after = await dashboardWidgetTitles(page);
    expect(after.length).toBe(before.length);
  });

  test('deep link', async ({ page }) => {
    await loginAndDashboard(page, DEMO_OWNER);
    await page.goto('/?category=finance', { waitUntil: 'domcontentloaded' });
    await waitForDashboardLoaded(page);
    await expect(page).toHaveURL(/category=finance/);
    const count = await countDashboardWidgets(page);
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Dynamic dashboard — cache isolation', () => {
  test('tenant switch', async ({ page }) => {
    await loginAndDashboard(page, DEMO_OWNER);
    const ownerCache = await readRegistryCacheRaw(page);
    expect(ownerCache).toContain(DEMO_TENANT_ID);
    const ownerWidgets = await countDashboardWidgets(page);

    await logout(page);
    await page.evaluate(() => sessionStorage.clear());
    const licensed = LICENSING_E2E_TENANTS.licensed;
    const bootstrap = captureRegistryBootstrap(page);
    await login(page, { email: licensed.email, password: licensed.password, tenantId: licensed.tenantId });
    await bootstrap;

    const licensedCache = await readRegistryCacheRaw(page);
    expect(licensedCache).toContain(licensed.tenantId);
    expect(licensedCache).not.toContain(DEMO_TENANT_ID);

    await gotoDashboard(page);
    const licensedWidgets = await countDashboardWidgets(page);
    expect(licensedWidgets).toBeGreaterThan(0);
    expect(licensedCache).not.toContain(DEMO_TENANT_ID);
  });

  test('logout/login', async ({ page }) => {
    await loginAndDashboard(page, DEMO_OWNER);
    await logout(page);
    await page.evaluate(() => sessionStorage.clear());
    const bootstrap = captureRegistryBootstrap(page);
    await login(page, DEMO_OWNER);
    await bootstrap;
    await gotoDashboard(page);
    await assertDashboardWidgetVisible(page, /Quick actions/i);
  });

  test('role change', async ({ page }) => {
    await loginAndDashboard(page, DEMO_OWNER);
    await assertDashboardWidgetVisible(page, /Business health/i);
    await logout(page);
    await page.evaluate(() => sessionStorage.clear());
    const bootstrap = captureRegistryBootstrap(page);
    await login(page, DEMO_RECEPTIONIST);
    await bootstrap;
    await gotoDashboard(page);
    await assertDashboardWidgetHidden(page, /Business health/i);
    await assertDashboardWidgetVisible(page, /Queue/i);
  });
});

test.describe('Dynamic dashboard — resilience and rollback', () => {
  test('registry unavailable', async ({ page }) => {
    await page.route('**/tenant/modules/registry/bootstrap', (route) => route.abort('failed'));
    await login(page, DEMO_OWNER);
    await gotoDashboard(page);
    await assertDashboardWidgetVisible(page, /Quick actions/i);
    const count = await countDashboardWidgets(page);
    expect(count).toBeGreaterThan(3);
  });

  test('rollback mode', async ({ page }) => {
    const rollbackUp = await fetch(ROLLBACK_BASE, { signal: AbortSignal.timeout(10_000) })
      .then((r) => r.ok)
      .catch(() => false);
    test.skip(!rollbackUp, `Rollback dashboard not running at ${ROLLBACK_BASE}`);

    await page.goto(`${ROLLBACK_BASE}/login`);
    const loginForm = page.locator('form').first();
    await loginForm.waitFor({ timeout: 20_000 });
    await loginForm.locator('input[autocomplete="organization"]').fill(DEMO_TENANT_ID);
    await loginForm.locator('input[type="email"]').fill(DEMO_OWNER.email);
    await loginForm.locator('input[type="password"]').fill(DEMO_OWNER.password);
    await loginForm.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });

    await page.goto(`${ROLLBACK_BASE}/`, { waitUntil: 'domcontentloaded' });
    await waitForDashboardLoaded(page);
    const rollbackCount = await countDashboardWidgets(page);

    await page.goto(`${process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173'}/login`);
    const regForm = page.locator('form').first();
    await regForm.waitFor({ timeout: 20_000 });
    await regForm.locator('input[autocomplete="organization"]').fill(DEMO_TENANT_ID);
    await regForm.locator('input[type="email"]').fill(DEMO_OWNER.email);
    await regForm.locator('input[type="password"]').fill(DEMO_OWNER.password);
    await regForm.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
    await gotoDashboard(page);
    const registryCount = await countDashboardWidgets(page);
    expect(registryCount).toBe(rollbackCount);
  });
});

test.describe('Dynamic dashboard — RTL, layout, preferences, UX', () => {
  test('Arabic RTL', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('booking.locale', 'ar-SY');
    });
    await loginAndDashboard(page, DEMO_OWNER);
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('rtl');
    await expect(dashboardRegion(page)).toBeVisible();
    const count = await countDashboardWidgets(page);
    expect(count).toBeGreaterThan(3);
  });

  test('widget layout persistence', async ({ page }) => {
    await loginAndDashboard(page, DEMO_OWNER);
    await page.getByRole('button', { name: /^Customize$/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByRole('button', { name: /Save layout/i }).click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForDashboardLoaded(page);
    const count = await countDashboardWidgets(page);
    expect(count).toBeGreaterThan(3);
  });

  test('dashboard preferences', async ({ page }) => {
    await loginAndDashboard(page, DEMO_OWNER);
    await page.getByRole('button', { name: /Finance/i }).click();
    await waitForDashboardLoaded(page);
    const count = await countDashboardWidgets(page);
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(15);
  });

  test('empty dashboard', async ({ page }) => {
    await loginAndDashboard(page, DEMO_OWNER);
    await page.getByRole('searchbox', { name: /Filter widgets/i }).fill('zzzz-no-widget-matches-zzzz');
    await expect(dashboardRegion(page).getByRole('status')).toBeVisible({ timeout: 10_000 });
  });

  test('loading state', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const region = dashboardRegion(page);
    await expect(region).toBeVisible({ timeout: 30_000 });
    await waitForDashboardLoaded(page);
    await expect(region.locator('[aria-busy="true"]')).toHaveCount(0);
  });

  test('no widget flash', async ({ page }) => {
    await loginAndDashboard(page, DEMO_OWNER);
    const initial = await countDashboardWidgets(page);
    await page.waitForTimeout(2_000);
    const later = await countDashboardWidgets(page);
    expect(later).toBe(initial);
  });
});

test.describe('Dynamic dashboard — performance and security', () => {
  test('no duplicate API requests on dashboard entry', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await assertNoDuplicateOverviewRequests(page, async () => {
      await gotoDashboard(page);
    });
  });

  test('hidden widgets never render for receptionist', async ({ page }) => {
    await loginAndDashboard(page, DEMO_RECEPTIONIST);
    await assertDashboardWidgetHidden(page, /Revenue trend|Revenue chart|Business health/i);
    const resources = await page.evaluate(() => document.querySelectorAll('#dashboard-region section').length);
    expect(resources).toBeGreaterThan(0);
  });

  test('bootstrap API parity for receptionist dashboard resources', async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      headers: { 'x-tenant-id': DEMO_TENANT_ID },
      data: {
        email: DEMO_RECEPTIONIST.email,
        password: DEMO_RECEPTIONIST.password,
        tenantId: DEMO_TENANT_ID,
        deviceName: 'pw-dash-receptionist-bootstrap',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = (await loginRes.json()) as { accessToken: string };
    const bootstrapRes = await request.get(`${API_BASE}/tenant/modules/registry/bootstrap`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant-id': DEMO_TENANT_ID },
    });
    const body = await bootstrapRes.json();
    const resources = dashboardAccessibleResourcesFromBootstrap(body);
    expect(resources).toContain('api.queue');
    expect(resources).not.toContain('api.analytics');
  });
});
