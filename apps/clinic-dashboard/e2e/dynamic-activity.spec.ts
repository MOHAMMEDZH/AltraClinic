import { test, expect, type Page } from '@playwright/test';
import { login, logout, type LoginCredentials } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import {
  DEMO_ACCOUNTANT,
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
  readRegistryCacheRaw,
  waitForRegistryBootstrap,
} from './helpers/dynamic-routing';
import { countRegistryBootstrapRequests } from './helpers/dynamic-reporting';
import { gotoReportingHome } from './helpers/dynamic-reporting';
import { gotoAnalyticsHome } from './helpers/dynamic-analytics';
import { gotoBrandingSettings } from './helpers/dynamic-white-label';
import {
  waitForBranchRuntimeProbe,
  gotoDashboardHome,
  invokeBranchRefresh,
  assertConsumerVersionsMatchPublished,
} from './helpers/dynamic-branch';
import {
  ACTIVITY_ROLLBACK_BASE,
  accessibleActivityFeedIdsFromBootstrap,
  accessibleActivityTypeIdsFromBootstrap,
  countActivityExtensionsFromBootstrap,
  gotoDashboardForActivity,
  invokeActivityRefresh,
  isActivityRollbackServerUp,
  loginOnActivityRollbackBase,
  readActivityRuntimeProbe,
  waitForActivityRuntimeProbe,
} from './helpers/dynamic-activity';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3000';
const REGISTRY_BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';

test.describe.configure({ mode: 'serial', timeout: 90_000 });

test.beforeEach(({}, testInfo) => {
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
  await waitForBranchRuntimeProbe(page);
  await waitForActivityRuntimeProbe(page, { tenantId: credentials.tenantId ?? DEMO_TENANT_ID });
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
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) {
    await login(
      page,
      { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId },
      { requireAppShell: false },
    );
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  }
  await expect(page.getByTestId('enterprise-license-experience')).toBeVisible({ timeout: 45_000 });
}

test.describe('Dynamic activity — registry foundation', () => {
  test('owner bootstrap exposes 46 activity contributions', async ({ request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-activity-owner-count',
    });
    expect(countActivityExtensionsFromBootstrap(body)).toBe(46);
    expect(accessibleActivityFeedIdsFromBootstrap(body).length).toBeGreaterThan(0);
    expect(accessibleActivityTypeIdsFromBootstrap(body).length).toBeGreaterThan(0);
  });

  test('owner login publishes activity runtime probe (registry mode)', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForActivityRuntimeProbe(page, {
      tenantId: DEMO_TENANT_ID,
      requireRegistry: true,
    });
    expect(probe.activitySnapshotVersion).toBeTruthy();
    expect(probe.isRegistrySource).toBe(true);
    expect(probe.source).toBe('registry');
    expect(probe.providerKey).toBe('activity.builtin');
    expect(probe.canViewActivity).toBe(true);
    expect(probe.feedCount).toBeGreaterThan(0);
    expect(probe.typeCount).toBeGreaterThan(0);
    expect(probe.hubCount).toBeGreaterThan(0);
  });

  test('general_manager publishes synchronized activity snapshot', async ({ page }) => {
    await loginAndShell(page, DEMO_GENERAL_MANAGER);
    const probe = await waitForActivityRuntimeProbe(page);
    expect(probe.canViewActivity).toBe(true);
    expect(probe.activitySnapshotVersion).toBeTruthy();
    const branch = await assertConsumerVersionsMatchPublished(page);
    expect(branch.consumerVersions.activity == null || branch.consumerVersions.activity === branch.branchSnapshotVersion).toBe(
      true,
    );
  });

  test('doctor shell loads with activity probe (no capability widen)', async ({ page }) => {
    await loginAndShell(page, DEMO_DOCTOR);
    const probe = await waitForActivityRuntimeProbe(page);
    expect(probe.activitySnapshotVersion).toBeTruthy();
    expect(probe.tenantId).toBe(DEMO_TENANT_ID);
  });

  test('dentist shell loads with activity probe', async ({ page }) => {
    await loginAndShell(page, DEMO_DENTIST);
    expect((await waitForActivityRuntimeProbe(page)).activitySnapshotVersion).toBeTruthy();
  });

  test('receptionist shell loads with activity probe', async ({ page }) => {
    await loginAndShell(page, DEMO_RECEPTIONIST);
    const probe = await waitForActivityRuntimeProbe(page);
    expect(probe.activitySnapshotVersion).toBeTruthy();
  });

  test('accountant shell loads with activity probe', async ({ page }) => {
    await loginAndShell(page, DEMO_ACCOUNTANT);
    expect((await waitForActivityRuntimeProbe(page)).activitySnapshotVersion).toBeTruthy();
  });

  test('inventory_manager shell loads with activity probe', async ({ page }) => {
    await loginAndShell(page, DEMO_INVENTORY_MANAGER);
    const probe = await waitForActivityRuntimeProbe(page);
    expect(probe.activitySnapshotVersion).toBeTruthy();
  });

  test('patient user bootstrap stays fail-closed on activity feeds', async ({ request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_PATIENT_USER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-activity-patient',
    });
    const feeds = accessibleActivityFeedIdsFromBootstrap(body);
    const types = accessibleActivityTypeIdsFromBootstrap(body);
    // Patient must never receive the full enterprise activity surface.
    expect(feeds.length).toBeLessThan(7);
    expect(types.length).toBeLessThan(36);
  });
});

test.describe('Dynamic activity — licensing matrix', () => {
  test('starter plan tenant publishes activity probe', async ({ page }) => {
    const starter = LICENSING_E2E_TENANTS.starter;
    await loginAndShell(page, {
      email: starter.email,
      password: starter.password,
      tenantId: starter.tenantId,
    });
    const probe = await waitForActivityRuntimeProbe(page, { tenantId: starter.tenantId });
    expect(probe.tenantId).toBe(starter.tenantId);
  });

  test('professional plan tenant publishes activity probe', async ({ page }) => {
    const professional = LICENSING_E2E_TENANTS.professional;
    await loginAndShell(page, {
      email: professional.email,
      password: professional.password,
      tenantId: professional.tenantId,
    });
    const probe = await waitForActivityRuntimeProbe(page, { tenantId: professional.tenantId });
    expect(probe.tenantId).toBe(professional.tenantId);
  });

  test('enterprise plan tenant publishes activity probe', async ({ page }) => {
    const enterprise = LICENSING_E2E_TENANTS.enterprise;
    await loginAndShell(page, {
      email: enterprise.email,
      password: enterprise.password,
      tenantId: enterprise.tenantId,
    });
    const probe = await waitForActivityRuntimeProbe(page, { tenantId: enterprise.tenantId });
    expect(probe.tenantId).toBe(enterprise.tenantId);
  });

  test('enterprise licensed tenant publishes activity probe', async ({ page }) => {
    const licensed = LICENSING_E2E_TENANTS.licensed;
    await loginAndShell(page, {
      email: licensed.email,
      password: licensed.password,
      tenantId: licensed.tenantId,
    });
    const probe = await waitForActivityRuntimeProbe(page, { tenantId: licensed.tenantId });
    expect(probe.tenantId).toBe(licensed.tenantId);
    expect(probe.activitySnapshotVersion).toBeTruthy();
  });

  test('grace tenant remains fail-closed for shell (no activity widen)', async ({ page }) => {
    await assertLicenseBlocksShell(page, LICENSING_E2E_TENANTS.grace);
  });

  test('suspended tenant remains fail-closed for shell', async ({ page }) => {
    await assertLicenseBlocksShell(page, LICENSING_E2E_TENANTS.suspended);
  });

  test('expired tenant remains fail-closed for shell', async ({ page }) => {
    await assertLicenseBlocksShell(page, LICENSING_E2E_TENANTS.expired);
  });
});

test.describe('Dynamic activity — capabilities & security', () => {
  test('owner capabilities project from snapshot (no page hasPermission)', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForActivityRuntimeProbe(page, { requireRegistry: true });
    expect(probe.canViewActivity).toBe(true);
    expect(probe.feedIds).toEqual(expect.arrayContaining(['global']));
    // Capabilities are boolean projections only — never undefined widen.
    for (const flag of [
      probe.canViewClinicalFeed,
      probe.canViewFinancialFeed,
      probe.canViewInventoryFeed,
      probe.canViewSecurityFeed,
      probe.canViewBranchFeed,
      probe.canViewMyFeed,
    ]) {
      expect(typeof flag).toBe('boolean');
    }
  });

  test('feed ids are a subset of bootstrap-accessible feeds', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-activity-feed-subset',
    });
    const bootstrapFeeds = new Set(accessibleActivityFeedIdsFromBootstrap(body));
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForActivityRuntimeProbe(page, { requireRegistry: true });
    for (const feedId of probe.feedIds) {
      expect(bootstrapFeeds.has(feedId), `unexpected feed widen: ${feedId}`).toBe(true);
    }
  });

  test('tenant isolation — probe tenant matches login tenant', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForActivityRuntimeProbe(page);
    expect(probe.tenantId).toBe(DEMO_TENANT_ID);
    expect(probe.userId).toBeTruthy();
  });

  test('restricted loading never exposes feeds before registry ready', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.evaluate(() => sessionStorage.clear());
    // Before login there should be no activity probe with canViewActivity.
    const pre = await readActivityRuntimeProbe(page);
    expect(pre?.canViewActivity ?? false).toBe(false);

    await loginAndShell(page, DEMO_OWNER);
    const post = await waitForActivityRuntimeProbe(page);
    expect(post.canViewActivity).toBe(true);
  });
});

test.describe('Dynamic activity — cache & refresh', () => {
  test('activity refresh does not spam registry bootstrap', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const before = await waitForActivityRuntimeProbe(page);
    const count = await countRegistryBootstrapRequests(page, async () => {
      await invokeActivityRefresh(page);
      await page.waitForTimeout(800);
    });
    expect(count).toBeLessThanOrEqual(2);
    const after = await waitForActivityRuntimeProbe(page);
    expect(after.tenantId).toBe(before.tenantId);
  });

  test('soft navigation reuses registry cache and keeps activity probe', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const rawBefore = await readRegistryCacheRaw(page);
    expect(rawBefore).toBeTruthy();
    const versionBefore = (await waitForActivityRuntimeProbe(page)).activitySnapshotVersion;
    await gotoDashboardForActivity(page);
    await gotoBrandingSettings(page);
    await gotoReportingHome(page);
    const rawAfter = await readRegistryCacheRaw(page);
    expect(rawAfter).toBeTruthy();
    const versionAfter = (await waitForActivityRuntimeProbe(page)).activitySnapshotVersion;
    expect(versionAfter).toBeTruthy();
    expect(versionBefore).toBeTruthy();
  });

  test('logout clears session; re-login publishes new activity probe', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await waitForActivityRuntimeProbe(page);
    await logout(page);
    await page.evaluate(() => sessionStorage.clear());
    await loginAndShell(page, DEMO_GENERAL_MANAGER);
    const probe = await waitForActivityRuntimeProbe(page);
    expect(probe.activitySnapshotVersion).toBeTruthy();
    expect(probe.tenantId).toBe(DEMO_TENANT_ID);
  });

  test('tenant switch invalidates prior activity identity', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const ownerProbe = await waitForActivityRuntimeProbe(page);
    expect(ownerProbe.tenantId).toBe(DEMO_TENANT_ID);

    await logout(page);
    await page.evaluate(() => sessionStorage.clear());
    const licensed = LICENSING_E2E_TENANTS.licensed;
    await loginAndShell(page, {
      email: licensed.email,
      password: licensed.password,
      tenantId: licensed.tenantId,
    });
    const licensedProbe = await waitForActivityRuntimeProbe(page, { tenantId: licensed.tenantId });
    expect(licensedProbe.tenantId).toBe(licensed.tenantId);
    expect(licensedProbe.tenantId).not.toBe(DEMO_TENANT_ID);
  });

  test('branch refresh keeps activity consumer synchronized', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await invokeBranchRefresh(page);
    await page.waitForTimeout(500);
    const branch = await waitForBranchRuntimeProbe(page);
    const activity = await waitForActivityRuntimeProbe(page);
    expect(activity.branchSnapshotVersion === null || activity.branchSnapshotVersion === branch.branchSnapshotVersion).toBe(
      true,
    );
  });
});

test.describe('Dynamic activity — existing runtime continuity', () => {
  test('dashboard recent-activities config path remains healthy for owner', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoDashboardHome(page);
    await expect(mainContent(page)).toBeVisible();
    const probe = await waitForActivityRuntimeProbe(page);
    expect(probe.canViewActivity).toBe(true);
    await expect(page.locator('#dashboard-region, #main-content').first()).toBeVisible();
  });

  test('Dashboard → Reports → Analytics keeps activity probe tenant continuity', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const start = await waitForActivityRuntimeProbe(page);
    await gotoDashboardHome(page);
    await gotoReportingHome(page);
    await gotoAnalyticsHome(page);
    const end = await waitForActivityRuntimeProbe(page);
    expect(end.tenantId).toBe(start.tenantId);
    expect(end.providerKey).toBe('activity.builtin');
  });

  test('browser refresh preserves registry activity mode', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const before = await waitForActivityRuntimeProbe(page, { requireRegistry: true });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForRegistryBootstrap(page);
    await assertShellVisible(page);
    const after = await waitForActivityRuntimeProbe(page, {
      tenantId: DEMO_TENANT_ID,
      requireRegistry: true,
    });
    expect(after.isRegistrySource).toBe(true);
    expect(after.tenantId).toBe(before.tenantId);
  });
});

test.describe('Dynamic activity — performance', () => {
  test('no redirect loop on soft dashboard navigation', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoDashboardHome(page);
    const url1 = page.url();
    await page.getByRole('navigation').getByRole('link', { name: 'Dashboard', exact: true }).click();
    await page.waitForTimeout(400);
    const url2 = page.url();
    expect(url2.includes('/login')).toBe(false);
    expect(url1.includes('5173') || url1.startsWith(REGISTRY_BASE)).toBeTruthy();
  });

  test('activity probe does not rebuild storm on idle', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const v1 = (await waitForActivityRuntimeProbe(page)).activitySnapshotVersion;
    await page.waitForTimeout(1_000);
    const v2 = (await waitForActivityRuntimeProbe(page)).activitySnapshotVersion;
    expect(v2).toBe(v1);
  });
});

test.describe('Dynamic activity — rollback mode (5180)', () => {
  test('activity rollback server is reachable', async () => {
    const up = await isActivityRollbackServerUp();
    expect(up, `Activity rollback dashboard must run at ${ACTIVITY_ROLLBACK_BASE}`).toBe(true);
  });

  test('static activity rollback preserves shell login', async ({ page }) => {
    const up = await isActivityRollbackServerUp();
    expect(up).toBe(true);

    await page.context().clearCookies();
    await loginOnActivityRollbackBase(page, ACTIVITY_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await expect(page.locator('header button[class*="userBtn"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('rollback mode publishes static-only activity probe', async ({ page }) => {
    const up = await isActivityRollbackServerUp();
    expect(up).toBe(true);

    await page.context().clearCookies();
    await loginOnActivityRollbackBase(page, ACTIVITY_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await page.goto(`${ACTIVITY_ROLLBACK_BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });

    const probe = await waitForActivityRuntimeProbe(page, { tenantId: DEMO_TENANT_ID });
    expect(probe.isRegistrySource).toBe(false);
    expect(probe.source).toBe('static-only');
    expect(probe.canViewActivity).toBe(true);
    expect(probe.providerKey).toBe('activity.builtin');
    expect(probe.feedCount).toBeGreaterThan(0);
  });

  test('registry (5173) and rollback (5180) both expose activity for owner', async ({ page }) => {
    const up = await isActivityRollbackServerUp();
    expect(up).toBe(true);

    await loginAndShell(page, DEMO_OWNER);
    const registryProbe = await waitForActivityRuntimeProbe(page, { requireRegistry: true });
    expect(registryProbe.isRegistrySource).toBe(true);

    await page.context().clearCookies();
    await loginOnActivityRollbackBase(page, ACTIVITY_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await page.goto(`${ACTIVITY_ROLLBACK_BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
    const rollbackProbe = await waitForActivityRuntimeProbe(page, { tenantId: DEMO_TENANT_ID });
    expect(rollbackProbe.isRegistrySource).toBe(false);
    expect(rollbackProbe.source).toBe('static-only');
    expect(rollbackProbe.canViewActivity).toBe(true);
  });

  test('rollback fail-closed — no capability widen beyond static snapshot', async ({ page }) => {
    const up = await isActivityRollbackServerUp();
    expect(up).toBe(true);

    await page.context().clearCookies();
    await loginOnActivityRollbackBase(page, ACTIVITY_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await page.goto(`${ACTIVITY_ROLLBACK_BASE}/`, { waitUntil: 'domcontentloaded' });
    const probe = await waitForActivityRuntimeProbe(page);
    expect(probe.source).toBe('static-only');
    expect(probe.feedCount).toBeLessThanOrEqual(7);
    expect(probe.hubCount).toBeLessThanOrEqual(3);
  });
});
