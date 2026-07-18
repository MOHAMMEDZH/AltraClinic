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
import { countRegistryBootstrapRequests } from './helpers/dynamic-reporting';
import {
  globalSearchDialog,
  openGlobalSearch,
  performGlobalSearch,
} from './helpers/dynamic-search';
import { gotoReportingHome } from './helpers/dynamic-reporting';
import {
  ANALYTICS_ROLLBACK_BASE,
  accessibleAnalyticsDomainIdsFromBootstrap,
  accessibleAnalyticsHubIdsFromBootstrap,
  accessibleAnalyticsWidgetIdsFromBootstrap,
  analyticsCategoryNav,
  analyticsDomainsSection,
  analyticsRegion,
  assertAnalyticsDomainContains,
  assertBuilderWidgetContains,
  clearAnalyticsPreferences,
  countAnalyticsDomainCards,
  countAnalyticsExtensionsFromBootstrap,
  countBuilderWidgets,
  gotoAnalyticsHome,
  gotoAnalyticsPath,
  isAnalyticsRollbackServerUp,
  loginOnAnalyticsRollbackBase,
  waitForAnalyticsLoaded,
} from './helpers/dynamic-analytics';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3000';
const REGISTRY_BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';

test.describe.configure({ mode: 'serial', timeout: 90_000 });

test.beforeEach(({ }, testInfo) => {
  if (!isE2eApiReady()) {
    testInfo.skip(true, E2E_SKIP_REASON);
  }
});

async function loginAndAnalytics(page: Page, credentials: LoginCredentials) {
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
  await assertShellVisible(page);
}

async function bootstrapBody(
  request: import('@playwright/test').APIRequestContext,
  credentials: {
    email: string;
    password: string;
    tenantId: string;
    deviceName: string;
  },
) {
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

async function assertLicenseBlocksAnalyticsRoute(
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
  await page.goto('/analytics', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) {
    await login(
      page,
      { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId },
      { requireAppShell: false },
    );
    await page.goto('/analytics', { waitUntil: 'domcontentloaded' });
  }
  await expect(page.getByTestId('enterprise-license-experience')).toBeVisible({ timeout: 45_000 });
}

test.describe('Dynamic analytics — role catalogs (registry mode)', () => {
  test('owner analytics', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-analytics-owner',
    });
    const expectedIds = accessibleAnalyticsDomainIdsFromBootstrap(body);
    expect(expectedIds.length).toBe(11);
    const widgets = accessibleAnalyticsWidgetIdsFromBootstrap(body);
    expect(widgets.length).toBeGreaterThanOrEqual(8);
    const hubs = accessibleAnalyticsHubIdsFromBootstrap(body);
    expect(hubs).toEqual(expect.arrayContaining(['catalog', 'builder', 'export-center']));

    await loginAndAnalytics(page, DEMO_OWNER);
    await gotoAnalyticsHome(page);
    const count = await countAnalyticsDomainCards(page);
    expect(count).toBe(expectedIds.length);
    await assertAnalyticsDomainContains(page, /Financial analytics/i);
    await assertAnalyticsDomainContains(page, /Executive dashboard/i);
    await analyticsRegion(page).waitFor({ state: 'visible' });
  });

  test('general_manager analytics', async ({ page }) => {
    await loginAndAnalytics(page, DEMO_GENERAL_MANAGER);
    await gotoAnalyticsHome(page);
    const count = await countAnalyticsDomainCards(page);
    expect(count).toBeGreaterThan(8);
    await assertAnalyticsDomainContains(page, /Operations analytics/i);
  });

  test('branch_manager analytics', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_BRANCH_MANAGER.email,
      password: DEMO_BRANCH_MANAGER.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-analytics-branch',
    });
    const analyticsMod = body.modules.find((m: { moduleId: string }) => m.moduleId === 'analytics');
    expect(analyticsMod?.userAccessible).toBe(true);
    const ids = accessibleAnalyticsDomainIdsFromBootstrap(body);
    expect(ids.length).toBeGreaterThan(5);

    await loginAndAnalytics(page, DEMO_BRANCH_MANAGER);
    await gotoAnalyticsHome(page);
    await assertAnalyticsDomainContains(page, /Branch analytics/i);
  });

  test('accountant analytics', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_ACCOUNTANT.email,
      password: DEMO_ACCOUNTANT.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-analytics-accountant',
    });
    const ids = accessibleAnalyticsDomainIdsFromBootstrap(body);
    expect(ids.length).toBeGreaterThan(5);

    await loginAndAnalytics(page, DEMO_ACCOUNTANT);
    await gotoAnalyticsHome(page);
    await assertAnalyticsDomainContains(page, /Financial analytics/i);
    const count = await countAnalyticsDomainCards(page);
    expect(count).toBe(ids.length);
  });

  test('receptionist analytics', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_RECEPTIONIST.email,
      password: DEMO_RECEPTIONIST.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-analytics-receptionist',
    });
    const analyticsMod = body.modules.find((m: { moduleId: string }) => m.moduleId === 'analytics');
    expect(analyticsMod?.userAccessible).toBe(false);

    await loginAndAnalytics(page, DEMO_RECEPTIONIST);
    await expect(page.getByRole('link', { name: 'Analytics', exact: true })).toHaveCount(0);
    await page.goto('/analytics', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Analytics hub', level: 1 })).toHaveCount(0);
  });

  test('doctor analytics', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_DOCTOR.email,
      password: DEMO_DOCTOR.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-analytics-doctor',
    });
    const ids = accessibleAnalyticsDomainIdsFromBootstrap(body);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain('clinical');

    await loginAndAnalytics(page, DEMO_DOCTOR);
    await gotoAnalyticsHome(page);
    expect(await countAnalyticsDomainCards(page)).toBe(ids.length);
    await assertAnalyticsDomainContains(page, /Clinical analytics/i);
  });

  test('dentist analytics', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_DENTIST.email,
      password: DEMO_DENTIST.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-analytics-dentist',
    });
    const ids = accessibleAnalyticsDomainIdsFromBootstrap(body);
    expect(ids).toContain('dental');

    await loginAndAnalytics(page, DEMO_DENTIST);
    await gotoAnalyticsHome(page);
    expect(await countAnalyticsDomainCards(page)).toBe(ids.length);
    await assertAnalyticsDomainContains(page, /Dental analytics/i);
  });

  test('specialist analytics', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_SPECIALIST.email,
      password: DEMO_SPECIALIST.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-analytics-specialist',
    });
    const ids = accessibleAnalyticsDomainIdsFromBootstrap(body);
    expect(ids).toContain('beauty');

    await loginAndAnalytics(page, DEMO_SPECIALIST);
    await gotoAnalyticsHome(page);
    expect(await countAnalyticsDomainCards(page)).toBe(ids.length);
    await assertAnalyticsDomainContains(page, /Beauty analytics/i);
  });

  test('inventory_manager analytics', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_INVENTORY_MANAGER.email,
      password: DEMO_INVENTORY_MANAGER.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-analytics-inventory',
    });
    const ids = accessibleAnalyticsDomainIdsFromBootstrap(body);
    expect(ids).toContain('inventory');

    await loginAndAnalytics(page, DEMO_INVENTORY_MANAGER);
    await gotoAnalyticsHome(page);
    expect(await countAnalyticsDomainCards(page)).toBe(ids.length);
    await assertAnalyticsDomainContains(page, /Inventory analytics/i);
  });

  test('patient analytics', async ({ page }) => {
    await login(page, DEMO_PATIENT_USER);
    await expect(page.getByRole('link', { name: 'Analytics', exact: true })).toHaveCount(0);
    await page.goto('/analytics', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Analytics hub', level: 1 })).toHaveCount(0);
  });

  test('super_admin bootstrap verification', async ({ request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-analytics-super-admin-bootstrap',
    });
    const analyticsExtensions = countAnalyticsExtensionsFromBootstrap(body);
    expect(analyticsExtensions).toBeGreaterThan(20);
    const ids = accessibleAnalyticsDomainIdsFromBootstrap(body);
    expect(ids).toContain('executive');
    expect(ids).toContain('financial');
    const widgets = accessibleAnalyticsWidgetIdsFromBootstrap(body);
    expect(widgets).toContain('revenueTrend');
  });
});

test.describe('Dynamic analytics — licensing lifecycle', () => {
  test('expired tenant', async ({ page }) => {
    await assertLicenseBlocksAnalyticsRoute(page, LICENSING_E2E_TENANTS.expired);
  });

  test('suspended tenant', async ({ page }) => {
    await assertLicenseBlocksAnalyticsRoute(page, LICENSING_E2E_TENANTS.suspended);
  });

  test('grace tenant', async ({ page }) => {
    await assertLicenseBlocksAnalyticsRoute(page, LICENSING_E2E_TENANTS.grace);
  });

  test('starter plan', async ({ page, request }) => {
    const tenant = LICENSING_E2E_TENANTS.starter;
    const body = await bootstrapBody(request, {
      email: tenant.email,
      password: tenant.password,
      tenantId: tenant.tenantId,
      deviceName: 'pw-analytics-starter',
    });
    const analytics = body.modules.find((m: { moduleId: string }) => m.moduleId === 'analytics');
    expect(analytics?.userAccessible).toBe(false);
    const ids = accessibleAnalyticsDomainIdsFromBootstrap(body);
    expect(ids).not.toContain('executive');

    await login(page, { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId });
    await page.goto('/analytics', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Analytics hub', level: 1 })).toHaveCount(0);
  });

  test('business plan', async ({ page, request }) => {
    const tenant = LICENSING_E2E_TENANTS.professional;
    const body = await bootstrapBody(request, {
      email: tenant.email,
      password: tenant.password,
      tenantId: tenant.tenantId,
      deviceName: 'pw-analytics-business',
    });
    const ids = accessibleAnalyticsDomainIdsFromBootstrap(body);
    expect(ids.length).toBeGreaterThan(5);

    await login(page, { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId });
    await gotoAnalyticsHome(page);
    const count = await countAnalyticsDomainCards(page);
    expect(count).toBe(ids.length);
  });

  test('enterprise plan', async ({ page, request }) => {
    const tenant = LICENSING_E2E_TENANTS.enterprise;
    const body = await bootstrapBody(request, {
      email: tenant.email,
      password: tenant.password,
      tenantId: tenant.tenantId,
      deviceName: 'pw-analytics-enterprise',
    });
    const analytics = body.modules.find((m: { moduleId: string }) => m.moduleId === 'analytics');
    expect(analytics?.userAccessible).toBe(true);

    await login(page, { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId });
    await gotoAnalyticsHome(page);
    await assertAnalyticsDomainContains(page, /Executive dashboard/i);
  });
});

test.describe('Dynamic analytics — navigation surfaces', () => {
  test('analytics home', async ({ page }) => {
    await loginAndAnalytics(page, DEMO_OWNER);
    await gotoAnalyticsHome(page);
    await expect(page.getByRole('heading', { name: 'Analytics hub', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Executive summary', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Analytics domains', level: 2 })).toBeVisible();
    await expect(page.getByRole('link', { name: /Dashboard builder/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Export center/i }).first()).toBeVisible();
  });

  test('analytics builder', async ({ page }) => {
    await loginAndAnalytics(page, DEMO_OWNER);
    await gotoAnalyticsPath(page, '/analytics/builder');
    await expect(page.getByRole('heading', { name: 'Analytics dashboard builder', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save layout' })).toBeVisible();
    const widgetCount = await countBuilderWidgets(page);
    expect(widgetCount).toBeGreaterThanOrEqual(8);
    await assertBuilderWidgetContains(page, /Revenue analytics/i);
  });

  test('financial domain', async ({ page }) => {
    await loginAndAnalytics(page, DEMO_OWNER);
    await gotoAnalyticsPath(page, '/analytics/financial');
    await expect(page.getByRole('heading', { name: 'Financial analytics', level: 1 })).toBeVisible();
    await expect(analyticsCategoryNav(page).getByRole('link', { name: /Financial analytics/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('export center', async ({ page }) => {
    await loginAndAnalytics(page, DEMO_OWNER);
    await gotoAnalyticsPath(page, '/analytics/export');
    await expect(page.getByRole('heading', { name: 'Analytics export center', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export PDF' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Print dashboard' })).toBeVisible();
  });

  test('favorites', async ({ page }) => {
    await loginAndAnalytics(page, DEMO_OWNER);
    await gotoAnalyticsHome(page);
    await clearAnalyticsPreferences(page);
    await page.getByRole('navigation').getByRole('link', { name: 'Dashboard', exact: true }).click();
    await gotoAnalyticsHome(page);
    const firstFavoriteBtn = analyticsDomainsSection(page).getByRole('button', { name: 'Add to favorites' }).first();
    await firstFavoriteBtn.click();
    await expect(page.getByRole('region', { name: /favorite dashboards/i })).toBeVisible();
  });

  test('recents', async ({ page }) => {
    await loginAndAnalytics(page, DEMO_OWNER);
    await gotoAnalyticsHome(page);
    await clearAnalyticsPreferences(page);
    await analyticsDomainsSection(page).getByRole('button', { name: /Financial analytics/i }).first().click();
    await expect(page).toHaveURL(/\/analytics\/financial/);
    await page.waitForFunction(() => {
      const raw = localStorage.getItem('clinic-analytics-recents');
      return Boolean(raw && raw.includes('financial'));
    });
    await gotoAnalyticsHome(page);
    await expect(page.getByRole('region', { name: /recently viewed/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('region', { name: /recently viewed/i })).toContainText(/Financial analytics/i);
  });

  test('category nav domains', async ({ page }) => {
    await loginAndAnalytics(page, DEMO_OWNER);
    await gotoAnalyticsHome(page);
    const navLinks = analyticsCategoryNav(page).getByRole('link');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(10);
    await navLinks.filter({ hasText: /Operations analytics/i }).click();
    await expect(page).toHaveURL(/\/analytics\/operations/);
  });

  test('browser refresh', async ({ page }) => {
    await loginAndAnalytics(page, DEMO_OWNER);
    await gotoAnalyticsHome(page);
    const before = await countAnalyticsDomainCards(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAnalyticsLoaded(page);
    const after = await countAnalyticsDomainCards(page);
    expect(after).toBe(before);
  });

  test('history back', async ({ page }) => {
    await loginAndAnalytics(page, DEMO_OWNER);
    await gotoAnalyticsHome(page);
    await page.getByRole('link', { name: /Dashboard builder/i }).click();
    await expect(page).toHaveURL(/\/analytics\/builder/);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await waitForAnalyticsLoaded(page);
    await expect(page).toHaveURL(/\/analytics(\?|$)/);
  });

  test('cross-module navigation chain', async ({ page }) => {
    await loginAndAnalytics(page, DEMO_OWNER);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('#dashboard-region').waitFor({ state: 'visible', timeout: 30_000 });
    await gotoAnalyticsHome(page);
    await expect(page.getByRole('heading', { name: 'Analytics hub', level: 1 })).toBeVisible();
    await page.getByRole('link', { name: 'Reports' }).first().click();
    await expect(page).toHaveURL(/\/reports/);
    await gotoReportingHome(page);
    await page.getByRole('link', { name: 'Live analytics' }).click();
    await expect(page).toHaveURL(/\/analytics/);
    await openGlobalSearch(page);
    await performGlobalSearch(page, 'Sarah');
    await expect(globalSearchDialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('navigation').getByRole('link', { name: 'Dashboard', exact: true }).click();
    await page.locator('#dashboard-region').waitFor({ state: 'visible', timeout: 30_000 });
  });
});

test.describe('Dynamic analytics — registry, cache, and resilience', () => {
  test('registry bootstrap analytics extensions', async ({ request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-analytics-bootstrap',
    });
    expect(countAnalyticsExtensionsFromBootstrap(body)).toBeGreaterThan(20);
  });

  test('registry refresh', async ({ page }) => {
    await loginAndAnalytics(page, DEMO_OWNER);
    await gotoAnalyticsHome(page);
    const before = await countAnalyticsDomainCards(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAnalyticsLoaded(page);
    const after = await countAnalyticsDomainCards(page);
    expect(after).toBe(before);
  });

  test('tenant switch', async ({ page }) => {
    await loginAndAnalytics(page, DEMO_OWNER);
    await gotoAnalyticsHome(page);
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
    await loginAndAnalytics(page, DEMO_OWNER);
    await gotoAnalyticsHome(page);
    await logout(page);
    await page.evaluate(() => sessionStorage.clear());
    const bootstrap = captureRegistryBootstrap(page);
    await login(page, DEMO_OWNER);
    await bootstrap;
    await gotoAnalyticsHome(page);
    await assertAnalyticsDomainContains(page, /Financial analytics/i);
  });

  test('role switch', async ({ page, request }) => {
    const ownerBody = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-analytics-role-owner',
    });
    const doctorBody = await bootstrapBody(request, {
      email: DEMO_DOCTOR.email,
      password: DEMO_DOCTOR.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-analytics-role-doctor',
    });
    const ownerIds = accessibleAnalyticsDomainIdsFromBootstrap(ownerBody);
    const doctorIds = accessibleAnalyticsDomainIdsFromBootstrap(doctorBody);
    expect(doctorIds.length).toBeLessThanOrEqual(ownerIds.length);

    await loginAndAnalytics(page, DEMO_OWNER);
    await gotoAnalyticsHome(page);
    expect(await countAnalyticsDomainCards(page)).toBe(ownerIds.length);

    await logout(page);
    await page.context().clearCookies();
    await page.evaluate(() => sessionStorage.clear());
    const bootstrap = captureRegistryBootstrap(page);
    await login(page, DEMO_DOCTOR);
    await bootstrap;
    await gotoAnalyticsHome(page);
    expect(await countAnalyticsDomainCards(page)).toBe(doctorIds.length);
    await assertAnalyticsDomainContains(page, /Clinical analytics/i);
  });

  test('registry unavailable fallback', async ({ page }) => {
    await page.route('**/tenant/modules/registry/bootstrap', (route) => route.abort('failed'));
    await login(page, DEMO_OWNER);
    await gotoAnalyticsHome(page);
    const count = await countAnalyticsDomainCards(page);
    expect(count).toBeGreaterThan(5);
  });

  test('dependency blocked analytics', async ({ request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-analytics-deps',
    });
    const blocked = body.modules.filter((m: { lockReason?: string }) => m.lockReason === 'dependency');
    for (const mod of blocked) {
      const analytics =
        mod.extensions?.filter((e: { kind: string }) => e.kind === 'analytics') ?? [];
      for (const ext of analytics) {
        expect(ext.userAccessible).not.toBe(true);
      }
    }
  });
});

test.describe('Dynamic analytics — security and performance', () => {
  test('unauthorized domains hidden', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_RECEPTIONIST.email,
      password: DEMO_RECEPTIONIST.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-analytics-security-receptionist',
    });
    const analyticsMod = body.modules.find((m: { moduleId: string }) => m.moduleId === 'analytics');
    expect(analyticsMod?.userAccessible).toBe(false);

    await loginAndAnalytics(page, DEMO_RECEPTIONIST);
    await page.goto('/analytics/financial', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Financial analytics', level: 1 })).toHaveCount(0);
  });

  test('hidden builder widgets', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_DOCTOR.email,
      password: DEMO_DOCTOR.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-analytics-security-doctor-widgets',
    });
    const widgetIds = accessibleAnalyticsWidgetIdsFromBootstrap(body);
    expect(widgetIds.length).toBeGreaterThan(0);

    await loginAndAnalytics(page, DEMO_DOCTOR);
    await gotoAnalyticsPath(page, '/analytics/builder');
    expect(await countBuilderWidgets(page)).toBe(widgetIds.length);
  });

  test('no duplicate registry bootstrap on analytics navigation', async ({ page }) => {
    await loginAndAnalytics(page, DEMO_OWNER);
    await gotoAnalyticsHome(page);
    const bootstrapCount = await countRegistryBootstrapRequests(page, async () => {
      await analyticsCategoryNav(page).getByRole('link', { name: /Operations analytics/i }).click();
      await expect(page).toHaveURL(/\/analytics\/operations/);
      await analyticsCategoryNav(page).getByRole('link', { name: /Financial analytics/i }).click();
      await expect(page).toHaveURL(/\/analytics\/financial/);
      await analyticsCategoryNav(page).getByRole('link', { name: /Overview/i }).click();
      await expect(page).toHaveURL(/\/analytics(\?|$)/);
    });
    expect(bootstrapCount).toBeLessThanOrEqual(1);
  });

  test('no redirect loop on analytics home', async ({ page }) => {
    await loginAndAnalytics(page, DEMO_OWNER);
    let redirects = 0;
    const handler = (resp: { status: () => number }) => {
      if ([301, 302, 303, 307, 308].includes(resp.status())) redirects += 1;
    };
    page.on('response', handler);
    await gotoAnalyticsHome(page);
    page.off('response', handler);
    expect(redirects).toBeLessThanOrEqual(2);
    await expect(page).toHaveURL(/\/analytics/);
  });

  test('lazy loading analytics region', async ({ page }) => {
    await loginAndAnalytics(page, DEMO_OWNER);
    const overviewResponse = page.waitForResponse(
      (resp) => resp.url().includes('/analytics/overview') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await gotoAnalyticsHome(page);
    await overviewResponse;
    await analyticsRegion(page).waitFor({ state: 'visible' });
    await expect(page.getByText('Live API unavailable — displaying sample metrics.')).toHaveCount(0);
  });
});

test.describe('Dynamic analytics — rollback mode', () => {
  test('static analytics rollback parity', async ({ page }) => {
    const rollbackUp = await isAnalyticsRollbackServerUp();
    test.skip(!rollbackUp, `Analytics rollback dashboard not running at ${ANALYTICS_ROLLBACK_BASE}`);

    await loginOnAnalyticsRollbackBase(page, ANALYTICS_ROLLBACK_BASE, {
      tenantId: DEMO_TENANT_ID,
      email: DEMO_OWNER.email,
      password: DEMO_OWNER.password,
    });
    await page.goto(`${ANALYTICS_ROLLBACK_BASE}/analytics`, { waitUntil: 'domcontentloaded' });
    await waitForAnalyticsLoaded(page);
    const rollbackCount = await countAnalyticsDomainCards(page);
    expect(rollbackCount).toBe(11);

    await page.goto(`${REGISTRY_BASE}/login`);
    const regForm = page.locator('form').first();
    await regForm.waitFor({ timeout: 20_000 });
    await regForm.locator('input[autocomplete="organization"]').fill(DEMO_TENANT_ID);
    await regForm.locator('input[type="email"]').fill(DEMO_OWNER.email);
    await regForm.locator('input[type="password"]').fill(DEMO_OWNER.password);
    await regForm.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
    await gotoAnalyticsHome(page);
    const registryCount = await countAnalyticsDomainCards(page);
    expect(registryCount).toBe(rollbackCount);
  });
});
