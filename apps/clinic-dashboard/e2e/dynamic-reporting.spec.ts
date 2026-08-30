import { test, expect, type Page } from '@playwright/test';
import { login, logout, type LoginCredentials } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import {
  DEMO_ACCOUNTANT,
  DEMO_BRANCH_MANAGER,
  DEMO_DENTIST,
  DEMO_DOCTOR,
  DEMO_GENERAL_MANAGER,
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
  readRegistryCacheTenant,
  waitForRegistryBootstrap,
} from './helpers/dynamic-routing';
import {
  REPORTING_ROLLBACK_BASE,
  accessibleReportIdsFromBootstrap,
  assertReportCatalogContains,
  assertReportCatalogExcludes,
  assertReportingAccessDenied,
  countRegistryBootstrapRequests,
  countReportCatalogCards,
  countReportingExtensionsFromBootstrap,
  gotoReportingHome,
  gotoReportingPath,
  isReportingRollbackServerUp,
  loginOnReportingRollbackBase,
  reportCatalogTitles,
  reportCatalogSection,
  categoryCatalogSection,
  clearReportPreferences,
  reportsRegion,
  waitForReportingLoaded,
} from './helpers/dynamic-reporting';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3000';
const REGISTRY_BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';

test.describe.configure({ mode: 'serial', timeout: 90_000 });

test.beforeEach(({ }, testInfo) => {
  if (!isE2eApiReady()) {
    testInfo.skip(true, E2E_SKIP_REASON);
  }
});

async function loginAndReporting(page: Page, credentials: LoginCredentials) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.removeItem('booking.locale');
  });
  const bootstrap = captureRegistryBootstrap(page);
  await login(page, credentials);
  let response = await bootstrap;
  if (!response?.ok()) {
    response = await page
      .waitForResponse(
        (resp) =>
          resp.url().includes('/tenant/modules/registry/bootstrap') && resp.request().method() === 'GET',
        { timeout: 20_000 },
      )
      .catch(() => null);
  }
  const hasRegistryCache = await page.evaluate(() =>
    Boolean(sessionStorage.getItem('booking.moduleRegistry.bootstrap')),
  );
  expect(response?.ok() || hasRegistryCache, 'registry bootstrap should succeed').toBeTruthy();
  await waitForRegistryBootstrap(page);
  await page.waitForFunction(
    () => Boolean(sessionStorage.getItem('booking.refreshToken')),
    undefined,
    { timeout: 20_000 },
  );
  await page.waitForFunction(
    () => {
      const raw = sessionStorage.getItem('booking.moduleRegistry.bootstrap');
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw) as { data?: { modules?: unknown[] } };
        return Array.isArray(parsed.data?.modules) && parsed.data.modules.length > 5;
      } catch {
        return false;
      }
    },
    undefined,
    { timeout: 45_000 },
  );
  await assertShellVisible(page);
}

async function bootstrapBody(request: import('@playwright/test').APIRequestContext, credentials: {
  email: string;
  password: string;
  tenantId: string;
  deviceName: string;
}) {
  const loginRes = await request.post(`${API_BASE}/auth/login`, {
    headers: { 'x-tenant-id': credentials.tenantId },
    data: {
      email: credentials.email,
      password: credentials.password,
      tenantId: credentials.tenantId,
      deviceName: credentials.deviceName,
    },
  });
  expect(loginRes.ok()).toBeTruthy();
  const { accessToken } = (await loginRes.json()) as { accessToken: string };
  const bootstrapRes = await request.get(`${API_BASE}/tenant/modules/registry/bootstrap`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant-id': credentials.tenantId },
  });
  expect(bootstrapRes.ok()).toBeTruthy();
  return bootstrapRes.json();
}

async function assertLicenseBlocksReportingRoute(
  page: Page,
  tenant: { email: string; password: string; tenantId: string },
) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.evaluate(() => sessionStorage.clear());
  await login(
    page,
    { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId },
    { requireAppShell: false },
  );
  await page.goto('/reports', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) {
    await login(
      page,
      { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId },
      { requireAppShell: false },
    );
    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
  }
  await expect(page.getByTestId('enterprise-license-experience')).toBeVisible({ timeout: 45_000 });
}

test.describe('Dynamic reporting — role catalogs (registry mode)', () => {
  test('owner reporting', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-report-owner',
    });
    const expectedIds = accessibleReportIdsFromBootstrap(body);
    expect(expectedIds.length).toBeGreaterThan(20);

    await loginAndReporting(page, DEMO_OWNER);
    await gotoReportingHome(page);
    const count = await countReportCatalogCards(page);
    expect(count).toBe(expectedIds.length);
    await assertReportCatalogContains(page, /Executive dashboard/i);
    await assertReportCatalogContains(page, /Billing summary/i);
  });

  test('general_manager reporting', async ({ page }) => {
    await loginAndReporting(page, DEMO_GENERAL_MANAGER);
    await gotoReportingHome(page);
    const count = await countReportCatalogCards(page);
    expect(count).toBeGreaterThan(15);
    await assertReportCatalogContains(page, /Executive dashboard/i);
  });

  test('branch_manager reporting', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_BRANCH_MANAGER.email,
      password: DEMO_BRANCH_MANAGER.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-report-branch',
    });
    const reportingMod = body.modules.find((m: { moduleId: string }) => m.moduleId === 'reporting');
    expect(reportingMod?.userAccessible).toBe(false);
    const ids = accessibleReportIdsFromBootstrap(body);
    expect(ids.length).toBeGreaterThan(5);

    await loginAndReporting(page, DEMO_BRANCH_MANAGER);
    await expect(page.getByRole('link', { name: 'Reports' })).toHaveCount(0);
    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Reporting', level: 1 })).toHaveCount(0);
  });

  test('accountant reporting', async ({ page }) => {
    await loginAndReporting(page, DEMO_ACCOUNTANT);
    await gotoReportingHome(page);
    await assertReportCatalogContains(page, /Billing summary/i);
    await assertReportCatalogContains(page, /Revenue summary/i);
    await assertReportCatalogExcludes(page, /Dental treatment plans/i);
  });

  test('receptionist reporting', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_RECEPTIONIST.email,
      password: DEMO_RECEPTIONIST.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-report-receptionist',
    });
    const reportingMod = body.modules.find((m: { moduleId: string }) => m.moduleId === 'reporting');
    expect(reportingMod?.userAccessible).toBe(false);

    await loginAndReporting(page, DEMO_RECEPTIONIST);
    await expect(page.getByRole('link', { name: 'Reports' })).toHaveCount(0);
    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Reporting', level: 1 })).toHaveCount(0);
  });

  test('doctor reporting', async ({ page }) => {
    await loginAndReporting(page, DEMO_DOCTOR);
    await gotoReportingHome(page);
    await assertReportCatalogContains(page, /Clinical activity/i);
    await assertReportCatalogExcludes(page, /Billing summary/i);
  });

  test('dentist reporting', async ({ page }) => {
    await loginAndReporting(page, DEMO_DENTIST);
    await gotoReportingHome(page);
    await assertReportCatalogContains(page, /Dental treatment plans/i);
    await assertReportCatalogExcludes(page, /Billing summary/i);
  });

  test('specialist reporting', async ({ page }) => {
    await loginAndReporting(page, DEMO_SPECIALIST);
    await gotoReportingHome(page);
    await assertReportCatalogContains(page, /Beauty sessions/i);
    await assertReportCatalogExcludes(page, /Billing summary/i);
  });

  test('inventory_manager reporting', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_INVENTORY_MANAGER.email,
      password: DEMO_INVENTORY_MANAGER.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-report-inventory',
    });
    const reportingMod = body.modules.find((m: { moduleId: string }) => m.moduleId === 'reporting');
    expect(reportingMod?.userAccessible).toBe(false);

    await loginAndReporting(page, DEMO_INVENTORY_MANAGER);
    await expect(page.getByRole('link', { name: 'Reports' })).toHaveCount(0);
    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Reporting', level: 1 })).toHaveCount(0);
  });

  test('patient reporting', async ({ page }) => {
    await login(page, DEMO_PATIENT_USER);
    await expect(page.getByRole('link', { name: 'Reports' })).toHaveCount(0);
    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Reporting', level: 1 })).toHaveCount(0);
  });

  test('super_admin bootstrap verification', async ({ request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-report-super-admin-bootstrap',
    });
    const reportingExtensions = countReportingExtensionsFromBootstrap(body);
    expect(reportingExtensions).toBeGreaterThan(40);
    const ids = accessibleReportIdsFromBootstrap(body);
    expect(ids).toContain('executive-dashboard');
    expect(ids).toContain('billing-summary');
  });
});

test.describe('Dynamic reporting — licensing lifecycle', () => {
  test('expired tenant', async ({ page }) => {
    await assertLicenseBlocksReportingRoute(page, LICENSING_E2E_TENANTS.expired);
  });

  test('suspended tenant', async ({ page }) => {
    await assertLicenseBlocksReportingRoute(page, LICENSING_E2E_TENANTS.suspended);
  });

  test('grace tenant', async ({ page }) => {
    await assertLicenseBlocksReportingRoute(page, LICENSING_E2E_TENANTS.grace);
  });

  test('starter plan', async ({ page, request }) => {
    const tenant = LICENSING_E2E_TENANTS.starter;
    const body = await bootstrapBody(request, {
      email: tenant.email,
      password: tenant.password,
      tenantId: tenant.tenantId,
      deviceName: 'pw-report-starter',
    });
    const analytics = body.modules.find((m: { moduleId: string }) => m.moduleId === 'analytics');
    expect(analytics?.userAccessible).toBe(false);
    const ids = accessibleReportIdsFromBootstrap(body);
    expect(ids).not.toContain('executive-dashboard');

    await login(page, { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId });
    await gotoReportingHome(page);
    await assertReportCatalogExcludes(page, /Executive dashboard/i);
  });

  test('professional plan', async ({ page, request }) => {
    const tenant = LICENSING_E2E_TENANTS.professional;
    const body = await bootstrapBody(request, {
      email: tenant.email,
      password: tenant.password,
      tenantId: tenant.tenantId,
      deviceName: 'pw-report-professional',
    });
    const ids = accessibleReportIdsFromBootstrap(body);
    expect(ids.length).toBeGreaterThan(10);

    await login(page, { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId });
    await gotoReportingHome(page);
    const count = await countReportCatalogCards(page);
    expect(count).toBe(ids.length);
  });

  test('enterprise plan', async ({ page, request }) => {
    const tenant = LICENSING_E2E_TENANTS.enterprise;
    const body = await bootstrapBody(request, {
      email: tenant.email,
      password: tenant.password,
      tenantId: tenant.tenantId,
      deviceName: 'pw-report-enterprise',
    });
    const analytics = body.modules.find((m: { moduleId: string }) => m.moduleId === 'analytics');
    expect(analytics?.userAccessible).toBe(true);

    await login(page, { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId });
    await gotoReportingHome(page);
    await assertReportCatalogContains(page, /Executive dashboard/i);
  });
});

test.describe('Dynamic reporting — navigation surfaces', () => {
  test('reporting home', async ({ page }) => {
    await loginAndReporting(page, DEMO_OWNER);
    await gotoReportingHome(page);
    await expect(page.getByRole('heading', { name: 'Reporting', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Report catalog', level: 2 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Report builder' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Export center' }).first()).toBeVisible();
  });

  test('report builder', async ({ page }) => {
    await loginAndReporting(page, DEMO_OWNER);
    await gotoReportingPath(page, '/reports/builder');
    await expect(page.getByRole('heading', { name: 'Report builder', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fields & measures', level: 2 })).toBeVisible();
  });

  test('report category billing', async ({ page }) => {
    await loginAndReporting(page, DEMO_OWNER);
    await gotoReportingPath(page, '/reports/category/billing');
    await expect(page.getByRole('heading', { name: /billing/i, level: 1 })).toBeVisible();
    await expect(categoryCatalogSection(page).getByRole('heading', { name: /Billing summary/i, level: 3 })).toBeVisible();
  });

  test('export center', async ({ page }) => {
    await loginAndReporting(page, DEMO_OWNER);
    await gotoReportingPath(page, '/reports/export');
    await expect(page.getByRole('heading', { name: 'Export center', level: 1 })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Analytics exports' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Operational reports' })).toBeVisible();
  });

  test('favorites', async ({ page }) => {
    await loginAndReporting(page, DEMO_OWNER);
    await gotoReportingHome(page);
    await clearReportPreferences(page);
    await page.getByRole('navigation').getByRole('link', { name: 'Dashboard', exact: true }).click();
    await gotoReportingHome(page);
    const firstFavoriteBtn = reportCatalogSection(page).getByRole('button', { name: 'Add to favorites' }).first();
    await firstFavoriteBtn.click();
    await expect(page.getByRole('region', { name: /favorite reports/i })).toBeVisible();
  });

  test('recent reports', async ({ page }) => {
    await loginAndReporting(page, DEMO_OWNER);
    await gotoReportingHome(page);
    await clearReportPreferences(page);
    await page.getByRole('navigation').getByRole('link', { name: 'Dashboard', exact: true }).click();
    await gotoReportingHome(page);
    await reportCatalogSection(page)
      .getByRole('button', { name: /Executive summary export/i })
      .click();
    await expect(page.getByRole('heading', { name: 'Recently opened', level: 2 })).toBeVisible();
    await expect(page.getByRole('region', { name: /recently opened/i })).toContainText('Executive summary export');
  });

  test('saved definitions', async ({ page }) => {
    await loginAndReporting(page, DEMO_OWNER);
    await gotoReportingPath(page, '/reports/builder');
    await page.getByRole('button', { name: 'Saved definitions' }).click();
    await expect(page.getByRole('heading', { name: 'Saved report definitions' })).toBeVisible();
  });

  test('quick actions and deep link', async ({ page }) => {
    await loginAndReporting(page, DEMO_OWNER);
    await gotoReportingHome(page);
    await page.getByRole('link', { name: 'Live analytics' }).click();
    await expect(page).toHaveURL(/\/analytics/);
    await page.goto('/reports/category/scheduling', { waitUntil: 'domcontentloaded' });
    await waitForReportingLoaded(page);
    await assertReportCatalogContains(page, /Scheduling performance/i);
  });

  test('browser refresh', async ({ page }) => {
    await loginAndReporting(page, DEMO_OWNER);
    await gotoReportingHome(page);
    const before = await reportCatalogTitles(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForReportingLoaded(page);
    const after = await reportCatalogTitles(page);
    expect(after.length).toBe(before.length);
  });

  test('history back', async ({ page }) => {
    await loginAndReporting(page, DEMO_OWNER);
    await gotoReportingHome(page);
    await page.getByRole('link', { name: 'Report builder' }).click();
    await expect(page).toHaveURL(/\/reports\/builder/);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await waitForReportingLoaded(page);
    await expect(page).toHaveURL(/\/reports$/);
  });

  test('unknown report route', async ({ page }) => {
    await loginAndReporting(page, DEMO_OWNER);
    await gotoReportingPath(page, '/reports/not-a-real-report-id');
    await expect(page.getByRole('alert').filter({ hasText: /report not found/i })).toBeVisible();
  });

  test('unknown category route', async ({ page }) => {
    await loginAndReporting(page, DEMO_OWNER);
    await page.goto('/reports/category/not-a-category', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('alert').filter({ hasText: /category not found|not found/i })).toBeVisible({
      timeout: 30_000,
    });
  });
});

test.describe('Dynamic reporting — registry, cache, and resilience', () => {
  test('registry bootstrap reporting extensions', async ({ request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-report-bootstrap',
    });
    expect(countReportingExtensionsFromBootstrap(body)).toBeGreaterThan(40);
  });

  test('registry refresh', async ({ page }) => {
    await loginAndReporting(page, DEMO_OWNER);
    await gotoReportingHome(page);
    const before = await countReportCatalogCards(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForReportingLoaded(page);
    const after = await countReportCatalogCards(page);
    expect(after).toBe(before);
  });

  test('tenant switch', async ({ page }) => {
    await loginAndReporting(page, DEMO_OWNER);
    await gotoReportingHome(page);
    const ownerCache = await readRegistryCacheRaw(page);
    expect(ownerCache).toContain(DEMO_TENANT_ID);

    await logout(page);
    await page.evaluate(() => sessionStorage.clear());
    const licensed = LICENSING_E2E_TENANTS.licensed;
    const bootstrap = captureRegistryBootstrap(page);
    await login(page, { email: licensed.email, password: licensed.password, tenantId: licensed.tenantId });
    await bootstrap;
    const licensedCache = await readRegistryCacheRaw(page);
    expect(licensedCache).toContain(licensed.tenantId);
    expect(licensedCache).not.toContain(DEMO_TENANT_ID);
    expect(await readRegistryCacheTenant(page)).toBe(licensed.tenantId);
  });

  test('logout/login', async ({ page }) => {
    await loginAndReporting(page, DEMO_OWNER);
    await gotoReportingHome(page);
    await logout(page);
    await page.evaluate(() => sessionStorage.clear());
    const bootstrap = captureRegistryBootstrap(page);
    await login(page, DEMO_OWNER);
    await bootstrap;
    await gotoReportingHome(page);
    await assertReportCatalogContains(page, /Executive dashboard/i);
  });

  test('role switch', async ({ page }) => {
    await loginAndReporting(page, DEMO_OWNER);
    await gotoReportingHome(page);
    await assertReportCatalogContains(page, /Billing summary/i);
    await logout(page);
    await page.context().clearCookies();
    await page.evaluate(() => sessionStorage.clear());
    const bootstrap = captureRegistryBootstrap(page);
    await login(page, DEMO_DOCTOR);
    await bootstrap;
    await gotoReportingHome(page);
    await assertReportCatalogExcludes(page, /Billing summary/i);
    await assertReportCatalogContains(page, /Clinical activity/i);
  });

  test('registry unavailable fallback', async ({ page }) => {
    // Contract: registry bootstrap failure → static-fallback catalog (nonzero for owner),
    // never a silent empty success. Simulate unavailable with HTTP 503 (not a fake catalog).
    const bootstrapStatuses: number[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/tenant/modules/registry/bootstrap') && response.request().method() === 'GET') {
        bootstrapStatuses.push(response.status());
      }
    });

    await loginAndReporting(page, DEMO_OWNER);
    await gotoReportingHome(page);
    expect(await countReportCatalogCards(page)).toBeGreaterThan(5);
    const baselineSource = await page.locator('#reports-region').getAttribute('data-reporting-source');
    expect(baselineSource === 'registry' || baselineSource === 'static-fallback' || baselineSource === 'static-only').toBeTruthy();

    await page.route('**/tenant/modules/registry/bootstrap', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'registry unavailable' }),
      });
    });
    await page.evaluate(() => {
      for (const key of [...Object.keys(sessionStorage)]) {
        if (/registry|moduleRegistry|reporting/i.test(key)) {
          sessionStorage.removeItem(key);
        }
      }
    });

    // Full navigation remounts providers so load() hits the 503 path.
    await page.goto('/reports', { waitUntil: 'domcontentloaded' });
    await waitForReportingLoaded(page);
    await expect(page.locator('#reports-region')).not.toHaveAttribute('aria-busy', 'true', { timeout: 45_000 });
    await expect(page.locator('#reports-region')).toHaveAttribute('data-reporting-source', 'static-fallback', {
      timeout: 45_000,
    });
    await expect(page.locator('#reports-region')).toHaveAttribute('data-registry-status', 'error');
    expect(bootstrapStatuses.some((status) => status === 503)).toBeTruthy();
    await expect
      .poll(async () => countReportCatalogCards(page), {
        timeout: 45_000,
        intervals: [500, 1000, 2000],
      })
      .toBeGreaterThan(5);
  });

  test('dependency blocked reporting', async ({ request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-report-deps',
    });
    const blocked = body.modules.filter((m: { lockReason?: string }) => m.lockReason === 'dependency');
    for (const mod of blocked) {
      const reporting = mod.extensions?.filter((e: { kind: string }) => e.kind === 'reporting') ?? [];
      for (const ext of reporting) {
        expect(ext.userAccessible).not.toBe(true);
      }
    }
  });
});

test.describe('Dynamic reporting — security and performance', () => {
  test('unauthorized catalog entries hidden', async ({ page }) => {
    await loginAndReporting(page, DEMO_DOCTOR);
    await gotoReportingHome(page);
    await assertReportCatalogExcludes(page, /Billing summary/i);
    await gotoReportingPath(page, '/reports/category/billing');
    await expect(categoryCatalogSection(page).getByRole('heading', { level: 3 })).toHaveCount(0);
  });

  test('direct unauthorized category URL', async ({ page }) => {
    await loginAndReporting(page, DEMO_ACCOUNTANT);
    await gotoReportingPath(page, '/reports/category/dental');
    await expect(categoryCatalogSection(page).getByRole('heading', { name: /Dental treatment plans/i, level: 3 })).toHaveCount(0);
  });

  test('no duplicate registry bootstrap on reporting navigation', async ({ page }) => {
    await loginAndReporting(page, DEMO_OWNER);
    const bootstrapCount = await countRegistryBootstrapRequests(page, async () => {
      await gotoReportingHome(page);
      await gotoReportingPath(page, '/reports/builder');
      await gotoReportingPath(page, '/reports/export');
    });
    expect(bootstrapCount).toBeLessThanOrEqual(1);
  });

  test('no redirect loop on reporting home', async ({ page }) => {
    await loginAndReporting(page, DEMO_OWNER);
    let redirects = 0;
    const handler = (resp: { status: () => number }) => {
      if ([301, 302, 303, 307, 308].includes(resp.status())) redirects += 1;
    };
    page.on('response', handler);
    await gotoReportingHome(page);
    page.off('response', handler);
    expect(redirects).toBeLessThanOrEqual(2);
    await expect(page).toHaveURL(/\/reports/);
  });
});

test.describe('Dynamic reporting — rollback mode', () => {
  test('static reporting rollback parity', async ({ page }) => {
    const rollbackUp = await isReportingRollbackServerUp();
    test.skip(!rollbackUp, `Reporting rollback dashboard not running at ${REPORTING_ROLLBACK_BASE}`);

    await loginOnReportingRollbackBase(page, REPORTING_ROLLBACK_BASE, {
      tenantId: DEMO_TENANT_ID,
      email: DEMO_OWNER.email,
      password: DEMO_OWNER.password,
    });
    await page.goto(`${REPORTING_ROLLBACK_BASE}/reports`, { waitUntil: 'domcontentloaded' });
    await waitForReportingLoaded(page);
    const rollbackCount = await countReportCatalogCards(page);
    expect(rollbackCount).toBeGreaterThan(20);

    await page.goto(`${REGISTRY_BASE}/login`);
    const regForm = page.locator('form').first();
    await regForm.waitFor({ timeout: 20_000 });
    await regForm.locator('input[autocomplete="organization"]').fill(DEMO_TENANT_ID);
    await regForm.locator('input[type="email"]').fill(DEMO_OWNER.email);
    await regForm.locator('input[type="password"]').fill(DEMO_OWNER.password);
    await regForm.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
    await gotoReportingHome(page);
    const registryCount = await countReportCatalogCards(page);
    expect(registryCount).toBe(rollbackCount);
  });
});
