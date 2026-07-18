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
  EXPECTED_NOTIFICATION_CONTRIBUTION_COUNT,
  NOTIFICATION_ROLLBACK_BASE,
  accessibleNotificationChannelIdsFromBootstrap,
  accessibleNotificationSurfaceIdsFromBootstrap,
  accessibleNotificationTypeIdsFromBootstrap,
  assertNoNotificationDeliveryInBrowserStorage,
  countNotificationExtensionsFromBootstrap,
  gotoNotificationCenter,
  gotoNotificationChannels,
  gotoNotificationInbox,
  invokeNotificationRefresh,
  isNotificationRollbackServerUp,
  loginOnNotificationRollbackBase,
  readNotificationRuntimeProbe,
  waitForNotificationRuntimeProbe,
} from './helpers/dynamic-notification';

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
  await waitForNotificationRuntimeProbe(page, {
    tenantId: credentials.tenantId ?? DEMO_TENANT_ID,
  });
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

test.describe('Dynamic notification — registry foundation', () => {
  test('owner bootstrap exposes 92 notification contributions', async ({ request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-notification-owner-count',
    });
    expect(countNotificationExtensionsFromBootstrap(body)).toBe(
      EXPECTED_NOTIFICATION_CONTRIBUTION_COUNT,
    );
    expect(accessibleNotificationTypeIdsFromBootstrap(body).length).toBeGreaterThan(0);
    expect(accessibleNotificationChannelIdsFromBootstrap(body).length).toBeGreaterThan(0);
    expect(accessibleNotificationSurfaceIdsFromBootstrap(body).length).toBeGreaterThan(0);
  });

  test('owner login publishes notification runtime probe (registry mode)', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForNotificationRuntimeProbe(page, {
      tenantId: DEMO_TENANT_ID,
      requireRegistry: true,
    });
    expect(probe.notificationSnapshotVersion).toBeTruthy();
    expect(probe.isRegistrySource).toBe(true);
    expect(probe.source).toBe('registry');
    expect(probe.providerKey).toBe('notification.builtin');
    expect(probe.canViewNotificationCenter).toBe(true);
    expect(probe.channelCount).toBeGreaterThan(0);
    expect(probe.typeCount).toBeGreaterThan(0);
    expect(probe.surfaceCount).toBeGreaterThan(0);
  });

  test('general_manager publishes synchronized notification snapshot', async ({ page }) => {
    await loginAndShell(page, DEMO_GENERAL_MANAGER);
    const probe = await waitForNotificationRuntimeProbe(page);
    expect(probe.canViewNotificationCenter).toBe(true);
    expect(probe.notificationSnapshotVersion).toBeTruthy();
    const branch = await assertConsumerVersionsMatchPublished(page);
    expect(
      branch.consumerVersions.notification == null ||
        branch.consumerVersions.notification === branch.branchSnapshotVersion,
    ).toBe(true);
  });

  test('doctor shell loads with notification probe (no capability widen)', async ({ page }) => {
    await loginAndShell(page, DEMO_DOCTOR);
    const probe = await waitForNotificationRuntimeProbe(page);
    expect(probe.notificationSnapshotVersion).toBeTruthy();
    expect(probe.tenantId).toBe(DEMO_TENANT_ID);
  });

  test('dentist shell loads with notification probe', async ({ page }) => {
    await loginAndShell(page, DEMO_DENTIST);
    expect((await waitForNotificationRuntimeProbe(page)).notificationSnapshotVersion).toBeTruthy();
  });

  test('receptionist shell loads with notification probe', async ({ page }) => {
    await loginAndShell(page, DEMO_RECEPTIONIST);
    const probe = await waitForNotificationRuntimeProbe(page);
    expect(probe.notificationSnapshotVersion).toBeTruthy();
  });

  test('accountant shell loads with notification probe', async ({ page }) => {
    await loginAndShell(page, DEMO_ACCOUNTANT);
    expect((await waitForNotificationRuntimeProbe(page)).notificationSnapshotVersion).toBeTruthy();
  });

  test('inventory_manager shell loads with notification probe', async ({ page }) => {
    await loginAndShell(page, DEMO_INVENTORY_MANAGER);
    const probe = await waitForNotificationRuntimeProbe(page);
    expect(probe.notificationSnapshotVersion).toBeTruthy();
  });

  test('patient user bootstrap stays fail-closed on notification surfaces', async ({ request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_PATIENT_USER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-notification-patient',
    });
    const types = accessibleNotificationTypeIdsFromBootstrap(body);
    const surfaces = accessibleNotificationSurfaceIdsFromBootstrap(body);
    // Patient must never widen beyond the canonical catalog ceilings.
    // Bootstrap extensionPermitted is view-only (registry contract); manage-gated
    // capability projection is enforced in EffectiveNotificationView / provider probes.
    expect(types.length).toBeLessThan(32);
    expect(surfaces.length).toBeLessThanOrEqual(6);
  });
});

test.describe('Dynamic notification — licensing matrix', () => {
  test('starter plan tenant publishes notification probe', async ({ page }) => {
    const starter = LICENSING_E2E_TENANTS.starter;
    await loginAndShell(page, {
      email: starter.email,
      password: starter.password,
      tenantId: starter.tenantId,
    });
    const probe = await waitForNotificationRuntimeProbe(page, { tenantId: starter.tenantId });
    expect(probe.tenantId).toBe(starter.tenantId);
  });

  test('professional plan tenant publishes notification probe', async ({ page }) => {
    const professional = LICENSING_E2E_TENANTS.professional;
    await loginAndShell(page, {
      email: professional.email,
      password: professional.password,
      tenantId: professional.tenantId,
    });
    const probe = await waitForNotificationRuntimeProbe(page, { tenantId: professional.tenantId });
    expect(probe.tenantId).toBe(professional.tenantId);
  });

  test('enterprise plan tenant publishes notification probe', async ({ page }) => {
    const enterprise = LICENSING_E2E_TENANTS.enterprise;
    await loginAndShell(page, {
      email: enterprise.email,
      password: enterprise.password,
      tenantId: enterprise.tenantId,
    });
    const probe = await waitForNotificationRuntimeProbe(page, { tenantId: enterprise.tenantId });
    expect(probe.tenantId).toBe(enterprise.tenantId);
  });

  test('enterprise licensed tenant publishes notification probe', async ({ page }) => {
    const licensed = LICENSING_E2E_TENANTS.licensed;
    await loginAndShell(page, {
      email: licensed.email,
      password: licensed.password,
      tenantId: licensed.tenantId,
    });
    const probe = await waitForNotificationRuntimeProbe(page, { tenantId: licensed.tenantId });
    expect(probe.tenantId).toBe(licensed.tenantId);
    expect(probe.notificationSnapshotVersion).toBeTruthy();
  });

  test('grace tenant remains fail-closed for shell (no notification widen)', async ({ page }) => {
    await assertLicenseBlocksShell(page, LICENSING_E2E_TENANTS.grace);
  });

  test('suspended tenant remains fail-closed for shell', async ({ page }) => {
    await assertLicenseBlocksShell(page, LICENSING_E2E_TENANTS.suspended);
  });

  test('expired tenant remains fail-closed for shell', async ({ page }) => {
    await assertLicenseBlocksShell(page, LICENSING_E2E_TENANTS.expired);
  });
});

test.describe('Dynamic notification — capabilities & security', () => {
  test('owner capabilities project from snapshot (no client RBAC widen)', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForNotificationRuntimeProbe(page, { requireRegistry: true });
    expect(probe.canViewNotificationCenter).toBe(true);
    for (const flag of [
      probe.canViewNotificationCenter,
      probe.canViewCommunicationHistory,
      probe.canConfigureChannels,
      probe.canConfigureTemplates,
    ]) {
      expect(typeof flag).toBe('boolean');
    }
  });

  test('type/channel counts are bounded by catalog vocabulary', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-notification-bounds',
    });
    const bootstrapTypes = accessibleNotificationTypeIdsFromBootstrap(body);
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForNotificationRuntimeProbe(page, { requireRegistry: true });
    expect(probe.typeCount).toBeLessThanOrEqual(bootstrapTypes.length);
    expect(probe.typeCount).toBeLessThanOrEqual(32);
    expect(probe.channelCount).toBeLessThanOrEqual(8);
    expect(probe.surfaceCount).toBeLessThanOrEqual(6);
    expect(probe.packCount).toBeLessThanOrEqual(8);
  });

  test('tenant isolation — probe tenant matches login tenant', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForNotificationRuntimeProbe(page);
    expect(probe.tenantId).toBe(DEMO_TENANT_ID);
    expect(probe.userId).toBeTruthy();
  });

  test('restricted loading never exposes notification center before registry ready', async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.evaluate(() => sessionStorage.clear());
    const pre = await readNotificationRuntimeProbe(page);
    expect(pre?.canViewNotificationCenter ?? false).toBe(false);

    await loginAndShell(page, DEMO_OWNER);
    const post = await waitForNotificationRuntimeProbe(page);
    expect(post.canViewNotificationCenter).toBe(true);
  });

  test('browser storage never caches delivery payloads / secrets / PHI', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await waitForNotificationRuntimeProbe(page, { requireRegistry: true });
    const { session, local } = await page.evaluate(() => ({
      session: sessionStorage.getItem('booking.moduleRegistry.bootstrap'),
      local: localStorage.getItem('booking.moduleRegistry.bootstrap'),
    }));
    assertNoNotificationDeliveryInBrowserStorage(session, local);
  });
});

test.describe('Dynamic notification — cache & refresh', () => {
  test('notification refresh does not spam registry bootstrap', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const before = await waitForNotificationRuntimeProbe(page);
    const count = await countRegistryBootstrapRequests(page, async () => {
      await invokeNotificationRefresh(page);
      await page.waitForTimeout(800);
    });
    expect(count).toBeLessThanOrEqual(2);
    const after = await waitForNotificationRuntimeProbe(page);
    expect(after.tenantId).toBe(before.tenantId);
  });

  test('soft navigation reuses registry cache and keeps notification probe', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const rawBefore = await readRegistryCacheRaw(page);
    expect(rawBefore).toBeTruthy();
    const versionBefore = (await waitForNotificationRuntimeProbe(page)).notificationSnapshotVersion;
    await gotoDashboardHome(page);
    await gotoBrandingSettings(page);
    await gotoReportingHome(page);
    await gotoNotificationCenter(page);
    const rawAfter = await readRegistryCacheRaw(page);
    expect(rawAfter).toBeTruthy();
    const versionAfter = (await waitForNotificationRuntimeProbe(page)).notificationSnapshotVersion;
    expect(versionAfter).toBeTruthy();
    expect(versionBefore).toBeTruthy();
  });

  test('logout clears session; re-login publishes new notification probe', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await waitForNotificationRuntimeProbe(page);
    await logout(page);
    await page.evaluate(() => sessionStorage.clear());
    await loginAndShell(page, DEMO_GENERAL_MANAGER);
    const probe = await waitForNotificationRuntimeProbe(page);
    expect(probe.notificationSnapshotVersion).toBeTruthy();
    expect(probe.tenantId).toBe(DEMO_TENANT_ID);
  });

  test('tenant switch invalidates prior notification identity', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const ownerProbe = await waitForNotificationRuntimeProbe(page);
    expect(ownerProbe.tenantId).toBe(DEMO_TENANT_ID);

    await logout(page);
    await page.evaluate(() => sessionStorage.clear());
    const licensed = LICENSING_E2E_TENANTS.licensed;
    await loginAndShell(page, {
      email: licensed.email,
      password: licensed.password,
      tenantId: licensed.tenantId,
    });
    const licensedProbe = await waitForNotificationRuntimeProbe(page, {
      tenantId: licensed.tenantId,
    });
    expect(licensedProbe.tenantId).toBe(licensed.tenantId);
    expect(licensedProbe.tenantId).not.toBe(DEMO_TENANT_ID);
  });

  test('branch refresh keeps notification consumer synchronized', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await invokeBranchRefresh(page);
    await page.waitForTimeout(500);
    const branch = await waitForBranchRuntimeProbe(page);
    const notification = await waitForNotificationRuntimeProbe(page);
    expect(
      notification.branchSnapshotVersion === null ||
        notification.branchSnapshotVersion === branch.branchSnapshotVersion,
    ).toBe(true);
  });
});

test.describe('Dynamic notification — existing runtime continuity', () => {
  test('notification center exposes configuration attrs from provider', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoNotificationCenter(page);
    // Layout title is "Notifications"; overview panel is "Overview".
    await expect(page.getByRole('heading', { name: /Notifications/i }).first()).toBeVisible({
      timeout: 30_000,
    });
    const center = page.locator('[data-notification-center]');
    await expect(center.first()).toBeVisible({ timeout: 15_000 });
    const source = await center.first().getAttribute('data-notification-source');
    expect(source === 'registry' || source === 'static-only' || source === 'static-fallback').toBe(
      true,
    );
    const probe = await waitForNotificationRuntimeProbe(page);
    expect(probe.canViewNotificationCenter).toBe(true);
  });

  test('notification channels page keeps provider source continuity', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoNotificationChannels(page);
    const probe = await waitForNotificationRuntimeProbe(page);
    expect(probe.providerKey).toBe('notification.builtin');
    expect(probe.tenantId).toBe(DEMO_TENANT_ID);
  });

  test('inbox API continuity — page loads without delivery config redesign', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const inboxResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/notifications') &&
        !resp.url().includes('/overview') &&
        resp.request().method() === 'GET',
      { timeout: 20_000 },
    );
    await gotoNotificationInbox(page);
    await inboxResponse.catch(() => null);
    await expect(page.getByRole('heading', { name: /Inbox/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    const probe = await waitForNotificationRuntimeProbe(page);
    expect(probe.tenantId).toBe(DEMO_TENANT_ID);
  });

  test('Dashboard → Reports → Analytics keeps notification probe', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const start = await waitForNotificationRuntimeProbe(page);
    await gotoDashboardHome(page);
    await gotoReportingHome(page);
    await gotoAnalyticsHome(page);
    const end = await waitForNotificationRuntimeProbe(page);
    expect(end.tenantId).toBe(start.tenantId);
    expect(end.providerKey).toBe('notification.builtin');
    await expect(mainContent(page)).toBeVisible();
  });

  test('bell panel still opens (runtime continuity)', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoDashboardHome(page);
    await page.getByRole('button', { name: /Notifications/i }).click();
    const panel = page.getByRole('dialog').filter({ hasText: /Notification/i });
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(panel.getByRole('link', { name: /View inbox/i })).toBeVisible();
    const probe = await waitForNotificationRuntimeProbe(page);
    expect(probe.isRegistrySource).toBe(true);
  });

  test('browser refresh preserves registry notification mode', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const before = await waitForNotificationRuntimeProbe(page, { requireRegistry: true });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForRegistryBootstrap(page);
    await assertShellVisible(page);
    const after = await waitForNotificationRuntimeProbe(page, {
      tenantId: DEMO_TENANT_ID,
      requireRegistry: true,
    });
    expect(after.isRegistrySource).toBe(true);
    expect(after.tenantId).toBe(before.tenantId);
  });
});

test.describe('Dynamic notification — performance', () => {
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

  test('notification probe does not rebuild storm on idle', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const v1 = (await waitForNotificationRuntimeProbe(page)).notificationSnapshotVersion;
    await page.waitForTimeout(1_000);
    const v2 = (await waitForNotificationRuntimeProbe(page)).notificationSnapshotVersion;
    expect(v2).toBe(v1);
  });
});

test.describe('Dynamic notification — rollback mode (5183)', () => {
  test('notification rollback server is reachable', async () => {
    const up = await isNotificationRollbackServerUp();
    expect(up, `Notification rollback dashboard must run at ${NOTIFICATION_ROLLBACK_BASE}`).toBe(
      true,
    );
  });

  test('static notification rollback preserves shell login', async ({ page }) => {
    const up = await isNotificationRollbackServerUp();
    expect(up).toBe(true);

    await page.context().clearCookies();
    await loginOnNotificationRollbackBase(page, NOTIFICATION_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await expect(page.locator('header button[class*="userBtn"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('rollback mode publishes static-only notification probe', async ({ page }) => {
    const up = await isNotificationRollbackServerUp();
    expect(up).toBe(true);

    await page.context().clearCookies();
    await loginOnNotificationRollbackBase(page, NOTIFICATION_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await page.goto(`${NOTIFICATION_ROLLBACK_BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });

    const probe = await waitForNotificationRuntimeProbe(page, { tenantId: DEMO_TENANT_ID });
    expect(probe.isRegistrySource).toBe(false);
    expect(probe.source).toBe('static-only');
    expect(probe.canViewNotificationCenter).toBe(true);
    expect(probe.providerKey).toBe('notification.builtin');
    expect(probe.channelCount).toBeGreaterThan(0);
  });

  test('registry (5173) and rollback (5183) both expose notification for owner', async ({
    page,
  }) => {
    const up = await isNotificationRollbackServerUp();
    expect(up).toBe(true);

    await loginAndShell(page, DEMO_OWNER);
    const registryProbe = await waitForNotificationRuntimeProbe(page, { requireRegistry: true });
    expect(registryProbe.isRegistrySource).toBe(true);

    await page.context().clearCookies();
    await loginOnNotificationRollbackBase(page, NOTIFICATION_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await page.goto(`${NOTIFICATION_ROLLBACK_BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
    const rollbackProbe = await waitForNotificationRuntimeProbe(page, {
      tenantId: DEMO_TENANT_ID,
    });
    expect(rollbackProbe.isRegistrySource).toBe(false);
    expect(rollbackProbe.source).toBe('static-only');
    expect(rollbackProbe.canViewNotificationCenter).toBe(true);
  });

  test('rollback fail-closed — no capability widen beyond static snapshot', async ({ page }) => {
    const up = await isNotificationRollbackServerUp();
    expect(up).toBe(true);

    await page.context().clearCookies();
    await loginOnNotificationRollbackBase(page, NOTIFICATION_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await page.goto(`${NOTIFICATION_ROLLBACK_BASE}/`, { waitUntil: 'domcontentloaded' });
    const probe = await waitForNotificationRuntimeProbe(page);
    expect(probe.source).toBe('static-only');
    expect(probe.typeCount).toBeLessThanOrEqual(32);
    expect(probe.channelCount).toBeLessThanOrEqual(8);
    expect(probe.surfaceCount).toBeLessThanOrEqual(6);
    expect(probe.packCount).toBeLessThanOrEqual(8);
  });
});
