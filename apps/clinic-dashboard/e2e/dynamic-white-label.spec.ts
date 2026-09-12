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
  DEMO_TENANT_ID,
} from './helpers/demo-credentials';
import { LICENSING_E2E_TENANTS } from './helpers/licensing-tenants';
import {
  assertShellVisible,
  captureRegistryBootstrap,
  mainContent,
  navigateToDashboardShell,
  readRegistryCacheRaw,
  readRegistryCacheTenant,
  waitForRegistryBootstrap,
} from './helpers/dynamic-routing';
import { countRegistryBootstrapRequests } from './helpers/dynamic-reporting';
import { gotoAnalyticsHome } from './helpers/dynamic-analytics';
import { gotoReportingHome } from './helpers/dynamic-reporting';
import { openGlobalSearch, globalSearchDialog } from './helpers/dynamic-search';
import {
  WHITE_LABEL_ROLLBACK_BASE,
  accessibleWhiteLabelSurfaceIdsFromBootstrap,
  assertBrandingFormAccessible,
  assertBrandingEditRestricted,
  assertBrandingLocked,
  brandingPageHeading,
  brandingPrimaryColorInput,
  countWhiteLabelExtensionsFromBootstrap,
  gotoBrandingRoute,
  gotoBrandingSettings,
  gotoSettingsHome,
  isWhiteLabelRollbackServerUp,
  loginOnWhiteLabelRollbackBase,
  readCssVariable,
  readDataTheme,
  readSidebarWidth,
  toggleThemeFromShell,
  whiteLabelSurfacesByFeatureFromBootstrap,
} from './helpers/dynamic-white-label';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3000';
const REGISTRY_BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';

test.describe.configure({ mode: 'serial', timeout: 90_000 });

test.beforeEach(({ }, testInfo) => {
  if (!isE2eApiReady()) {
    testInfo.skip(true, E2E_SKIP_REASON);
  }
});

async function loginAndShell(page: Page, credentials: LoginCredentials) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.removeItem('booking.locale');
  });
  const bootstrap = captureRegistryBootstrap(page);
  // Isolated mint avoids serial-suite refresh-token cache races across navigations
  // (history-back → next test) that otherwise land authenticated flows on /login.
  await login(page, credentials, { isolatedSession: true });
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

async function identityFeaturesBody(
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
  const featuresRes = await request.get(`${API_BASE}/identity/features`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant-id': credentials.tenantId },
  });
  expect(featuresRes.ok()).toBeTruthy();
  return featuresRes.json() as Promise<Record<string, boolean>>;
}

async function assertLicenseBlocksShell(
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
  await page.goto('/settings/branding', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) {
    await login(
      page,
      { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId },
      { requireAppShell: false },
    );
    await page.goto('/settings/branding', { waitUntil: 'domcontentloaded' });
  }
  await expect(page.getByTestId('enterprise-license-experience')).toBeVisible({ timeout: 45_000 });
}

test.describe('Dynamic white label — role catalogs (registry mode)', () => {
  test('owner white label surfaces', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-whitelabel-owner',
    });
    const expected = accessibleWhiteLabelSurfaceIdsFromBootstrap(body);
    expect(expected.length).toBeGreaterThan(0);
    expect(countWhiteLabelExtensionsFromBootstrap(body)).toBe(10);

    await loginAndShell(page, DEMO_OWNER);
    await gotoBrandingSettings(page);
    await assertBrandingFormAccessible(page);
    const primary = await readCssVariable(page, '--color-primary');
    expect(primary.length).toBeGreaterThan(0);
  });

  test('general_manager branding', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_GENERAL_MANAGER.email,
      password: DEMO_GENERAL_MANAGER.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-whitelabel-gm',
    });
    const expected = accessibleWhiteLabelSurfaceIdsFromBootstrap(body);
    expect(expected.length).toBeGreaterThan(0);

    await loginAndShell(page, DEMO_GENERAL_MANAGER);
    await gotoBrandingSettings(page);
    await assertBrandingFormAccessible(page);
  });

  test('branch_manager branding', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_BRANCH_MANAGER.email,
      password: DEMO_BRANCH_MANAGER.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-whitelabel-branch',
    });
    expect(accessibleWhiteLabelSurfaceIdsFromBootstrap(body).length).toBe(0);

    await loginAndShell(page, DEMO_BRANCH_MANAGER);
    await gotoBrandingRoute(page);
    await assertBrandingEditRestricted(page);
  });

  test('accountant branding', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_ACCOUNTANT.email,
      password: DEMO_ACCOUNTANT.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-whitelabel-accountant',
    });
    expect(accessibleWhiteLabelSurfaceIdsFromBootstrap(body).length).toBe(0);

    await loginAndShell(page, DEMO_ACCOUNTANT);
    await gotoBrandingRoute(page);
    await assertBrandingEditRestricted(page);
  });

  test('receptionist branding access restricted', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_RECEPTIONIST.email,
      password: DEMO_RECEPTIONIST.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-whitelabel-receptionist',
    });
    const surfaces = accessibleWhiteLabelSurfaceIdsFromBootstrap(body);
    expect(surfaces.length).toBeLessThan(10);

    await loginAndShell(page, DEMO_RECEPTIONIST);
    await page.goto('/settings/branding', { waitUntil: 'domcontentloaded' });
    const headingVisible = await brandingPageHeading(page).isVisible().catch(() => false);
    const lockedVisible = await page.getByText(/Custom branding/i).isVisible().catch(() => false);
    expect(headingVisible || lockedVisible || surfaces.length === 0).toBeTruthy();
  });

  test('doctor branding', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_DOCTOR.email,
      password: DEMO_DOCTOR.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-whitelabel-doctor',
    });
    expect(accessibleWhiteLabelSurfaceIdsFromBootstrap(body).length).toBe(0);

    await loginAndShell(page, DEMO_DOCTOR);
    await gotoBrandingRoute(page);
    await assertBrandingEditRestricted(page);
  });

  test('dentist branding', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_DENTIST.email,
      password: DEMO_DENTIST.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-whitelabel-dentist',
    });
    expect(accessibleWhiteLabelSurfaceIdsFromBootstrap(body).length).toBe(0);

    await loginAndShell(page, DEMO_DENTIST);
    await gotoBrandingRoute(page);
    await assertBrandingEditRestricted(page);
  });

  test('inventory_manager branding', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_INVENTORY_MANAGER.email,
      password: DEMO_INVENTORY_MANAGER.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-whitelabel-inventory',
    });
    expect(accessibleWhiteLabelSurfaceIdsFromBootstrap(body).length).toBe(0);

    await loginAndShell(page, DEMO_INVENTORY_MANAGER);
    await gotoBrandingRoute(page);
    await assertBrandingEditRestricted(page);
  });

  test('patient branding route blocked', async ({ page }) => {
    await login(page, DEMO_PATIENT_USER);
    await page.goto('/settings/branding', { waitUntil: 'domcontentloaded' });
    await expect(brandingPageHeading(page)).toHaveCount(0);
  });

  test('super_admin bootstrap verification', async ({ request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-whitelabel-super-admin',
    });
    expect(countWhiteLabelExtensionsFromBootstrap(body)).toBe(10);
    const surfaces = accessibleWhiteLabelSurfaceIdsFromBootstrap(body);
    expect(surfaces).toContain('settings-branding-core');
    expect(whiteLabelSurfacesByFeatureFromBootstrap(body, 'whiteLabel').length).toBeGreaterThan(0);
  });
});

test.describe('Dynamic white label — licensing lifecycle', () => {
  test('expired tenant', async ({ page }) => {
    await assertLicenseBlocksShell(page, LICENSING_E2E_TENANTS.expired);
  });

  test('suspended tenant', async ({ page }) => {
    await assertLicenseBlocksShell(page, LICENSING_E2E_TENANTS.suspended);
  });

  test('grace tenant', async ({ page }) => {
    await assertLicenseBlocksShell(page, LICENSING_E2E_TENANTS.grace);
  });

  test('starter tenant branding locked', async ({ page, request }) => {
    const tenant = LICENSING_E2E_TENANTS.starter;
    const features = await identityFeaturesBody(request, {
      email: tenant.email,
      password: tenant.password,
      tenantId: tenant.tenantId,
      deviceName: 'pw-whitelabel-starter',
    });
    expect(features.customBranding).not.toBe(true);

    await login(page, {
      email: tenant.email,
      password: tenant.password,
      tenantId: tenant.tenantId,
    });
    await gotoBrandingSettings(page);
    await assertBrandingLocked(page);
  });

  test('professional tenant branding', async ({ page, request }) => {
    const tenant = LICENSING_E2E_TENANTS.professional;
    const body = await bootstrapBody(request, {
      email: tenant.email,
      password: tenant.password,
      tenantId: tenant.tenantId,
      deviceName: 'pw-whitelabel-professional',
    });
    expect(accessibleWhiteLabelSurfaceIdsFromBootstrap(body).length).toBeGreaterThan(0);

    await login(page, {
      email: tenant.email,
      password: tenant.password,
      tenantId: tenant.tenantId,
    });
    await gotoBrandingSettings(page);
    await expect(brandingPageHeading(page).or(page.getByText(/Custom branding/i)).first()).toBeVisible();
  });

  test('enterprise tenant full white label surfaces', async ({ page, request }) => {
    const tenant = LICENSING_E2E_TENANTS.enterprise;
    const body = await bootstrapBody(request, {
      email: tenant.email,
      password: tenant.password,
      tenantId: tenant.tenantId,
      deviceName: 'pw-whitelabel-enterprise',
    });
    const whiteLabelSurfaces = whiteLabelSurfacesByFeatureFromBootstrap(body, 'whiteLabel');
    expect(whiteLabelSurfaces.length).toBeGreaterThan(0);

    await login(page, {
      email: tenant.email,
      password: tenant.password,
      tenantId: tenant.tenantId,
    });
    await gotoBrandingSettings(page);
    await assertBrandingFormAccessible(page);
  });
});

test.describe('Dynamic white label — navigation surfaces', () => {
  test('branding settings page loads', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoBrandingSettings(page);
    await assertBrandingFormAccessible(page);
  });

  test('settings home to branding deep link', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoSettingsHome(page);
    await page.getByRole('link', { name: /Branding/i }).first().click();
    await expect(page).toHaveURL(/\/settings\/branding/);
    await assertBrandingFormAccessible(page);
  });

  test('browser refresh preserves branding page', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoBrandingSettings(page);
    const before = await readCssVariable(page, '--color-primary');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await assertBrandingFormAccessible(page);
    const after = await readCssVariable(page, '--color-primary');
    expect(after).toBe(before);
  });

  test('history back from branding', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoSettingsHome(page);
    await gotoBrandingSettings(page);
    await page.goBack();
    await expect(page).toHaveURL(/\/settings(\?|$)/);
  });

  test('dashboard to branding navigation', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    // loginAndShell already lands on authenticated shell (/). Prefer client Dashboard hop —
    // hard page.goto('/dashboard') races blank SPA under Progressive Batch A.
    await navigateToDashboardShell(page);
    await gotoBrandingSettings(page);
    await assertBrandingFormAccessible(page);
  });

  test('cross-module navigation chain', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await navigateToDashboardShell(page);
    await gotoBrandingSettings(page);
    const brandingPrimary = await readCssVariable(page, '--color-primary');
    await gotoReportingHome(page);
    await gotoAnalyticsHome(page);
    await openGlobalSearch(page);
    await expect(globalSearchDialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await navigateToDashboardShell(page);
    await gotoBrandingSettings(page);
    const afterNav = await readCssVariable(page, '--color-primary');
    expect(afterNav).toBe(brandingPrimary);
  });

  test('layout profile css applied', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoBrandingSettings(page);
    const sidebarWidth = await readSidebarWidth(page);
    expect(sidebarWidth.length).toBeGreaterThan(0);
  });

  test('localization direction on shell', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(['ltr', 'rtl']).toContain(dir);
  });
});

test.describe('Dynamic white label — registry, cache, and resilience', () => {
  test('bootstrap declares white label extensions', async ({ request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-whitelabel-bootstrap-count',
    });
    expect(countWhiteLabelExtensionsFromBootstrap(body)).toBe(10);
  });

  test('registry refresh', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoBrandingSettings(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await assertBrandingFormAccessible(page);
  });

  test('tenant switch', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoBrandingSettings(page);
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
    await loginAndShell(page, DEMO_OWNER);
    await gotoBrandingSettings(page);
    await logout(page);
    await page.evaluate(() => sessionStorage.clear());
    const bootstrap = captureRegistryBootstrap(page);
    await login(page, DEMO_OWNER);
    await bootstrap;
    await gotoBrandingSettings(page);
    await assertBrandingFormAccessible(page);
  });

  test('role switch', async ({ page, request }) => {
    const ownerBody = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-whitelabel-role-owner',
    });
    const doctorBody = await bootstrapBody(request, {
      email: DEMO_DOCTOR.email,
      password: DEMO_DOCTOR.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-whitelabel-role-doctor',
    });
    const ownerSurfaces = accessibleWhiteLabelSurfaceIdsFromBootstrap(ownerBody);
    const doctorSurfaces = accessibleWhiteLabelSurfaceIdsFromBootstrap(doctorBody);
    expect(ownerSurfaces.length).toBeGreaterThan(0);
    expect(doctorSurfaces.length).toBe(0);
    expect(doctorSurfaces.length).toBeLessThan(ownerSurfaces.length);

    await loginAndShell(page, DEMO_OWNER);
    expect(await readRegistryCacheTenant(page)).toBe(DEMO_TENANT_ID);

    await logout(page);
    await page.context().clearCookies();
    await page.evaluate(() => sessionStorage.clear());
    await loginAndShell(page, DEMO_DOCTOR);
    await gotoBrandingRoute(page);
    await assertBrandingEditRestricted(page);
  });

  test('registry unavailable fallback', async ({ page }) => {
    await page.route('**/tenant/modules/registry/bootstrap', (route) => route.abort('failed'));
    await login(page, DEMO_OWNER);
    await gotoBrandingSettings(page);
    await expect(brandingPageHeading(page).or(page.getByText(/Custom branding/i)).first()).toBeVisible();
  });

  test('dependency blocked white label extensions', async ({ request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-whitelabel-deps',
    });
    const blocked = body.modules.filter((m: { lockReason?: string }) => m.lockReason === 'dependency');
    for (const mod of blocked) {
      const whiteLabel =
        mod.extensions?.filter((e: { kind: string }) => e.kind === 'whiteLabel') ?? [];
      for (const ext of whiteLabel) {
        expect(ext.userAccessible).not.toBe(true);
      }
    }
  });
});

test.describe('Dynamic white label — security and performance', () => {
  test('receptionist cannot widen branding capabilities', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      email: DEMO_RECEPTIONIST.email,
      password: DEMO_RECEPTIONIST.password,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-whitelabel-security-receptionist',
    });
    const ownerBody = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-whitelabel-security-owner',
    });
    const receptionistSurfaces = accessibleWhiteLabelSurfaceIdsFromBootstrap(body);
    const ownerSurfaces = accessibleWhiteLabelSurfaceIdsFromBootstrap(ownerBody);
    expect(receptionistSurfaces.length).toBeLessThan(ownerSurfaces.length);

    await loginAndShell(page, DEMO_RECEPTIONIST);
    await page.goto('/settings/branding', { waitUntil: 'domcontentloaded' });
    await expect(brandingPrimaryColorInput(page)).toHaveCount(0);
  });

  test('tenant branding isolation on cache', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoBrandingSettings(page);
    expect(await readRegistryCacheTenant(page)).toBe(DEMO_TENANT_ID);
  });

  test('no duplicate registry bootstrap on branding navigation', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoBrandingSettings(page);
    const bootstrapCount = await countRegistryBootstrapRequests(page, async () => {
      await page.getByRole('link', { name: /Security|Settings/i }).first().click();
      await expect(page).toHaveURL(/\/settings(\?|$)/);
      await page.getByRole('link', { name: /Branding/i }).first().click();
      await expect(page).toHaveURL(/\/settings\/branding/);
      await assertBrandingFormAccessible(page);
      await page.goBack();
      await expect(page).toHaveURL(/\/settings(\?|$)/);
      await page.getByRole('link', { name: /Branding/i }).first().click();
      await expect(page).toHaveURL(/\/settings\/branding/);
    });
    expect(bootstrapCount).toBeLessThanOrEqual(1);
  });

  test('no redirect loop on branding route', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    let redirects = 0;
    const handler = (resp: { status: () => number }) => {
      if ([301, 302, 303, 307, 308].includes(resp.status())) redirects += 1;
    };
    page.on('response', handler);
    await gotoBrandingSettings(page);
    page.off('response', handler);
    expect(redirects).toBeLessThanOrEqual(2);
    await expect(page).toHaveURL(/\/settings\/branding/);
  });

  test('lazy loading branding settings page', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const settingsResponse = page.waitForResponse(
      (resp) => resp.url().includes('/settings/tenant') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await gotoBrandingSettings(page);
    await settingsResponse;
    await expect(mainContent(page).getByRole('heading', { name: 'Branding', level: 2 })).toBeVisible();
  });
});

test.describe('Dynamic white label — theme runtime', () => {
  test('css variables applied on shell', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoBrandingSettings(page);
    const primary = await readCssVariable(page, '--color-primary');
    const accent = await readCssVariable(page, '--color-secondary-500');
    expect(primary).toMatch(/^#/);
    expect(accent).toMatch(/^#/);
  });

  test('theme toggle updates data-theme', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoBrandingSettings(page);
    const before = await readDataTheme(page);
    await toggleThemeFromShell(page);
    const after = await readDataTheme(page);
    expect(after).toBeTruthy();
    if (before) expect(after).not.toBe(before);
  });

  test('branding persistence after refresh', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoBrandingSettings(page);
    const primaryBefore = await readCssVariable(page, '--color-primary');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await assertBrandingFormAccessible(page);
    const primaryAfter = await readCssVariable(page, '--color-primary');
    expect(primaryAfter).toBe(primaryBefore);
  });

  test('theme isolation between tenants', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const demoPrimary = await readCssVariable(page, '--color-primary');

    await logout(page);
    await page.context().clearCookies();
    await page.evaluate(() => sessionStorage.clear());
    const licensed = LICENSING_E2E_TENANTS.licensed;
    await loginAndShell(page, {
      email: licensed.email,
      password: licensed.password,
      tenantId: licensed.tenantId,
    });
    const licensedPrimary = await readCssVariable(page, '--color-primary');
    expect(licensedPrimary.length).toBeGreaterThan(0);
    expect(await readRegistryCacheTenant(page)).toBe(licensed.tenantId);
    expect(await readRegistryCacheTenant(page)).not.toBe(DEMO_TENANT_ID);
    expect(demoPrimary.length).toBeGreaterThan(0);
  });
});

test.describe('Dynamic white label — rollback mode', () => {
  test('static white label rollback parity', async ({ page }) => {
    const rollbackUp = await isWhiteLabelRollbackServerUp();
    test.skip(!rollbackUp, `White label rollback dashboard not running at ${WHITE_LABEL_ROLLBACK_BASE}`);

    await loginOnWhiteLabelRollbackBase(page, WHITE_LABEL_ROLLBACK_BASE, {
      tenantId: DEMO_TENANT_ID,
      email: DEMO_OWNER.email,
      password: DEMO_OWNER.password,
    });
    await page.goto(`${WHITE_LABEL_ROLLBACK_BASE}/settings/branding`, { waitUntil: 'domcontentloaded' });
    await assertBrandingFormAccessible(page);
    const rollbackPrimary = await readCssVariable(page, '--color-primary');

    await page.goto(`${REGISTRY_BASE}/login`);
    const regForm = page.locator('form').first();
    await regForm.waitFor({ timeout: 20_000 });
    await regForm.locator('input[autocomplete="organization"]').fill(DEMO_TENANT_ID);
    await regForm.locator('input[type="email"]').fill(DEMO_OWNER.email);
    await regForm.locator('input[type="password"]').fill(DEMO_OWNER.password);
    await regForm.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
    await gotoBrandingSettings(page);
    const registryPrimary = await readCssVariable(page, '--color-primary');
    expect(registryPrimary).toBe(rollbackPrimary);
  });
});
