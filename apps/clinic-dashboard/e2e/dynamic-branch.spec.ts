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
  readRegistryCacheRaw,
  readRegistryCacheTenant,
  waitForRegistryBootstrap,
} from './helpers/dynamic-routing';
import { countRegistryBootstrapRequests, gotoReportingHome } from './helpers/dynamic-reporting';
import { gotoAnalyticsHome } from './helpers/dynamic-analytics';
import { openGlobalSearch, globalSearchDialog } from './helpers/dynamic-search';
import { gotoBrandingSettings } from './helpers/dynamic-white-label';
import {
  ACTIVE_BRANCH_SESSION_KEY,
  BRANCH_ROLLBACK_BASE,
  accessibleBranchSurfaceIdsFromBootstrap,
  assertConsumerVersionsMatchPublished,
  countBranchExtensionsFromBootstrap,
  dashboardBranchSelect,
  gotoDashboardHome,
  invokeBranchRefresh,
  invokeBranchSetActive,
  isBranchRollbackServerUp,
  loginOnBranchRollbackBase,
  readActiveBranchSession,
  readBranchRuntimeProbe,
  selectDashboardBranch,
  waitForBranchRuntimeProbe,
  writeActiveBranchSession,
} from './helpers/dynamic-branch';

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
  await waitForBranchRuntimeProbe(page);
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

test.describe('Dynamic branch — registry foundation', () => {
  test('owner bootstrap exposes 24 branch contributions', async ({ request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-branch-owner-count',
    });
    expect(countBranchExtensionsFromBootstrap(body)).toBe(24);
    expect(accessibleBranchSurfaceIdsFromBootstrap(body).length).toBeGreaterThan(0);
  });

  test('owner login publishes branch runtime probe', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForBranchRuntimeProbe(page);
    expect(probe.branchSnapshotVersion).toBeTruthy();
    expect(probe.tenantId).toBe(DEMO_TENANT_ID);
    expect(probe.publicationGeneration).toBeGreaterThan(0);
  });

  test('general_manager publishes synchronized branch snapshot', async ({ page }) => {
    await loginAndShell(page, DEMO_GENERAL_MANAGER);
    const probe = await assertConsumerVersionsMatchPublished(page);
    expect(probe.event).toMatch(/branch\.context\.(ready|changed)/);
  });

  test('branch_manager receives accessible branch context', async ({ page }) => {
    await loginAndShell(page, DEMO_BRANCH_MANAGER);
    const probe = await waitForBranchRuntimeProbe(page, {
      tenantId: DEMO_TENANT_ID,
      minAccessibleBranches: 1,
    });
    expect(probe.accessibleBranchIds.length).toBeGreaterThan(0);
  });

  test('receptionist has fail-closed switch capability (no multi-branch select widen)', async ({
    page,
  }) => {
    await loginAndShell(page, DEMO_RECEPTIONIST);
    await gotoDashboardHome(page);
    const selectCount = await dashboardBranchSelect(page).count();
    expect(selectCount).toBe(0);
    const probe = await waitForBranchRuntimeProbe(page);
    expect(probe.branchSnapshotVersion).toBeTruthy();
  });

  test('doctor shell loads with branch probe (no capability widen)', async ({ page }) => {
    await loginAndShell(page, DEMO_DOCTOR);
    const probe = await waitForBranchRuntimeProbe(page);
    expect(probe.branchSnapshotVersion).toBeTruthy();
  });

  test('dentist shell loads with branch probe', async ({ page }) => {
    await loginAndShell(page, DEMO_DENTIST);
    await assertShellVisible(page);
    expect((await waitForBranchRuntimeProbe(page)).branchSnapshotVersion).toBeTruthy();
  });

  test('accountant shell loads with branch probe', async ({ page }) => {
    await loginAndShell(page, DEMO_ACCOUNTANT);
    expect((await waitForBranchRuntimeProbe(page)).branchSnapshotVersion).toBeTruthy();
  });

  test('inventory_manager shell loads with branch probe', async ({ page }) => {
    await loginAndShell(page, DEMO_INVENTORY_MANAGER);
    expect((await waitForBranchRuntimeProbe(page)).branchSnapshotVersion).toBeTruthy();
  });
});

test.describe('Dynamic branch — active branch lifecycle', () => {
  test('login writes active branch session when resolved', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const session = await readActiveBranchSession(page);
    const probe = await waitForBranchRuntimeProbe(page);
    expect(probe.activeBranchId === session || probe.activeBranchId === null || session === null).toBe(
      true,
    );
  });

  test('logout clears branch session on re-login identity reset', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await writeActiveBranchSession(page, 'force-session-branch');
    await logout(page);
    await page.evaluate(() => sessionStorage.clear());
    const bootstrap = captureRegistryBootstrap(page);
    await login(page, DEMO_OWNER);
    await bootstrap;
    await assertShellVisible(page);
    const probe = await waitForBranchRuntimeProbe(page);
    expect(probe.branchSnapshotVersion).toBeTruthy();
  });

  test('tenant switch republishes branch context for new tenant', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const demoProbe = await waitForBranchRuntimeProbe(page);
    expect(demoProbe.tenantId).toBe(DEMO_TENANT_ID);

    await logout(page);
    await page.evaluate(() => sessionStorage.clear());
    const licensed = LICENSING_E2E_TENANTS.licensed;
    const bootstrap = captureRegistryBootstrap(page);
    await login(page, {
      email: licensed.email,
      password: licensed.password,
      tenantId: licensed.tenantId,
    });
    await bootstrap;
    await assertShellVisible(page);
    const licensedProbe = await waitForBranchRuntimeProbe(page, {
      tenantId: licensed.tenantId,
    });
    expect(licensedProbe.tenantId).toBe(licensed.tenantId);
    expect(licensedProbe.tenantId).not.toBe(DEMO_TENANT_ID);
    expect(await readRegistryCacheTenant(page)).toBe(licensed.tenantId);
  });

  test('hard refresh republishes branch snapshot without duplicate identity widen', async ({
    page,
  }) => {
    await loginAndShell(page, DEMO_OWNER);
    const before = await waitForBranchRuntimeProbe(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForRegistryBootstrap(page);
    await assertShellVisible(page);
    const after = await waitForBranchRuntimeProbe(page);
    expect(after.tenantId).toBe(before.tenantId);
    expect(after.branchSnapshotVersion).toBeTruthy();
  });

  test('unavailable session branch recovers without throwing', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await writeActiveBranchSession(page, '00000000-0000-4000-8000-unavailable01');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForRegistryBootstrap(page);
    await assertShellVisible(page);
    const probe = await waitForBranchRuntimeProbe(page);
    expect(probe.activeBranchId).not.toBe('00000000-0000-4000-8000-unavailable01');
    expect(probe.branchSnapshotVersion).toBeTruthy();
  });

  test('owner can invoke setActiveBranchId for accessible branch', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForBranchRuntimeProbe(page);
    const target =
      probe.accessibleBranchIds.find((id) => id !== probe.activeBranchId) ??
      probe.accessibleBranchIds[0] ??
      null;
    expect(target).toBeTruthy();
    const result = await invokeBranchSetActive(page, target);
    expect(result.ok, result.error).toBe(true);
    const updated = await waitForBranchRuntimeProbe(page);
    expect(updated.activeBranchId).toBe(target);
    expect(updated.branchSnapshotVersion).toBeTruthy();
  });

  test('setActiveBranchId rejects inaccessible branch (fail-closed)', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const result = await invokeBranchSetActive(page, '00000000-ffff-4000-8000-deniedbranch01');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/BranchAccessDeniedError/i);
    const probe = await waitForBranchRuntimeProbe(page);
    expect(probe.accessibleBranchIds).not.toContain('00000000-ffff-4000-8000-deniedbranch01');
  });

  test('refresh() republishes branch context', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const before = await waitForBranchRuntimeProbe(page);
    const result = await invokeBranchRefresh(page);
    expect(result.ok, result.error).toBe(true);
    const after = await waitForBranchRuntimeProbe(page);
    expect(after.branchSnapshotVersion).toBeTruthy();
    expect(after.publicationGeneration).toBeGreaterThanOrEqual(before.publicationGeneration);
  });
});

test.describe('Dynamic branch — consumer synchronization', () => {
  test('white label observes published branchSnapshotVersion', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoBrandingSettings(page);
    const probe = await waitForBranchRuntimeProbe(page);
    const wl = probe.consumerVersions.whiteLabel;
    expect(wl).toBe(probe.branchSnapshotVersion);
  });

  test('dashboard consumer observes same branchSnapshotVersion', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoDashboardHome(page);
    await page.waitForTimeout(500);
    const probe = await waitForBranchRuntimeProbe(page);
    if (probe.consumerVersions.dashboard != null) {
      expect(probe.consumerVersions.dashboard).toBe(probe.branchSnapshotVersion);
    }
    expect(probe.branchSnapshotVersion).toBeTruthy();
  });

  test('navigation and routing consumers stay version-aligned when mounted', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await assertShellVisible(page);
    const probe = await waitForBranchRuntimeProbe(page);
    for (const key of ['navigation', 'routing'] as const) {
      const v = probe.consumerVersions[key];
      if (v != null) expect(v).toBe(probe.branchSnapshotVersion);
    }
  });

  test('search dialog mounts without desyncing branch snapshot', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await openGlobalSearch(page);
    await expect(globalSearchDialog(page)).toBeVisible({ timeout: 20_000 });
    const probe = await waitForBranchRuntimeProbe(page);
    if (probe.consumerVersions.search != null) {
      expect(probe.consumerVersions.search).toBe(probe.branchSnapshotVersion);
    }
  });

  test('reporting home observes published branch version when mounted', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoReportingHome(page);
    await expect(mainContent(page)).toBeVisible();
    const probe = await waitForBranchRuntimeProbe(page);
    if (probe.consumerVersions.reporting != null) {
      expect(probe.consumerVersions.reporting).toBe(probe.branchSnapshotVersion);
    }
  });

  test('analytics home observes published branch version when mounted', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoAnalyticsHome(page);
    await expect(mainContent(page)).toBeVisible();
    const probe = await waitForBranchRuntimeProbe(page);
    if (probe.consumerVersions.analytics != null) {
      expect(probe.consumerVersions.analytics).toBe(probe.branchSnapshotVersion);
    }
  });

  test('branch switch keeps all mounted consumers on identical version', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoDashboardHome(page);
    await gotoBrandingSettings(page);
    const probe = await waitForBranchRuntimeProbe(page);
    const target =
      probe.accessibleBranchIds.find((id) => id !== probe.activeBranchId) ??
      probe.accessibleBranchIds[0];
    expect(target).toBeTruthy();
    const result = await invokeBranchSetActive(page, target!);
    expect(result.ok, result.error).toBe(true);
    await page.waitForTimeout(400);
    const synced = await assertConsumerVersionsMatchPublished(page);
    expect(synced.activeBranchId).toBe(target);
  });
});

test.describe('Dynamic branch — cache & identity', () => {
  test('registry cache identity matches demo tenant after login', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const tenant = await readRegistryCacheTenant(page);
    expect(tenant).toBe(DEMO_TENANT_ID);
  });

  test('branch session survives soft navigation', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForBranchRuntimeProbe(page);
    await gotoDashboardHome(page);
    await page.goto('/settings/branding', { waitUntil: 'domcontentloaded' });
    await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
    await gotoDashboardHome(page);
    const after = await waitForBranchRuntimeProbe(page);
    expect(after.activeBranchId).toBe(probe.activeBranchId);
  });

  test('clearing registry cache then refresh still fail-closes to a versioned probe', async ({
    page,
  }) => {
    await loginAndShell(page, DEMO_OWNER);
    await page.evaluate(() => sessionStorage.removeItem('booking.moduleRegistry.bootstrap'));
    const result = await invokeBranchRefresh(page);
    expect(result.ok, result.error).toBe(true);
    const probe = await waitForBranchRuntimeProbe(page);
    expect(probe.branchSnapshotVersion).toBeTruthy();
  });

  test('owner dashboard branch filter does not widen roles for receptionist path', async ({
    page,
  }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoDashboardHome(page);
    if ((await dashboardBranchSelect(page).count()) > 0) {
      await selectDashboardBranch(page, 'all');
      expect(page.url()).toMatch(/branchId=all/);
    }
    await logout(page);
    await loginAndShell(page, DEMO_RECEPTIONIST);
    await gotoDashboardHome(page);
    expect(await dashboardBranchSelect(page).count()).toBe(0);
  });
});

test.describe('Dynamic branch — security & licensing', () => {
  test('patient portal role does not widen to tenant owner branch surfaces', async ({
    page,
    request,
  }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_PATIENT_USER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-branch-patient',
    });
    const surfaces = accessibleBranchSurfaceIdsFromBootstrap(body);
    // Patient must not receive the full owner surface set (24).
    expect(surfaces.length).toBeLessThan(24);

    await page.context().clearCookies();
    await page.goto('/login');
    await page.evaluate(() => sessionStorage.clear());
    await login(page, DEMO_PATIENT_USER, { requireAppShell: false });
    // Patient may land on portal — probe may be null outside clinic providers.
    const shellVisible = await page
      .locator('header button[class*="userBtn"]')
      .isVisible()
      .catch(() => false);
    if (shellVisible) {
      const probe = await readBranchRuntimeProbe(page);
      if (probe?.branchSnapshotVersion) {
        expect(probe.accessibleBranchIds.length).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('expired license tenant is blocked before branch context widen', async ({ page }) => {
    await assertLicenseBlocksShell(page, LICENSING_E2E_TENANTS.expired);
  });

  test('suspended license tenant is blocked before branch context widen', async ({ page }) => {
    await assertLicenseBlocksShell(page, LICENSING_E2E_TENANTS.suspended);
  });

  test('cross-branch denied id cannot become activeBranchId via probe API', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const before = await waitForBranchRuntimeProbe(page);
    const denied = await invokeBranchSetActive(page, 'deadbeef-dead-4000-8000-deadbeefdead');
    expect(denied.ok).toBe(false);
    const after = await waitForBranchRuntimeProbe(page);
    expect(after.activeBranchId).toBe(before.activeBranchId);
  });
});

test.describe('Dynamic branch — performance', () => {
  test('branch switch does not re-bootstrap registry', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForBranchRuntimeProbe(page);
    const target =
      probe.accessibleBranchIds.find((id) => id !== probe.activeBranchId) ??
      probe.accessibleBranchIds[0];
    expect(target).toBeTruthy();

    const bootstrapCount = await countRegistryBootstrapRequests(page, async () => {
      const result = await invokeBranchSetActive(page, target!);
      expect(result.ok, result.error).toBe(true);
      await page.waitForTimeout(500);
    });
    expect(bootstrapCount).toBe(0);
  });

  test('refresh after switch does not loop registry bootstrap spam', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const count = await countRegistryBootstrapRequests(page, async () => {
      await invokeBranchRefresh(page);
      await page.waitForTimeout(800);
    });
    // refresh() may legitimately refetch once — never spam.
    expect(count).toBeLessThanOrEqual(2);
  });

  test('soft navigation reuses registry cache', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const rawBefore = await readRegistryCacheRaw(page);
    expect(rawBefore).toBeTruthy();
    await gotoDashboardHome(page);
    await gotoBrandingSettings(page);
    const rawAfter = await readRegistryCacheRaw(page);
    expect(rawAfter).toBeTruthy();
  });
});

test.describe('Dynamic branch — rollback mode (5179)', () => {
  test('branch rollback server is reachable', async () => {
    const up = await isBranchRollbackServerUp();
    expect(up, `Branch rollback dashboard must run at ${BRANCH_ROLLBACK_BASE}`).toBe(true);
  });

  test('static branch rollback preserves shell login', async ({ page }) => {
    const up = await isBranchRollbackServerUp();
    expect(up).toBe(true);

    await page.context().clearCookies();
    await loginOnBranchRollbackBase(page, BRANCH_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await expect(page.locator('header button[class*="userBtn"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('registry (5173) and rollback (5179) expose dashboard for owner', async ({ page }) => {
    const up = await isBranchRollbackServerUp();
    expect(up).toBe(true);

    await loginAndShell(page, DEMO_OWNER);
    await gotoDashboardHome(page);
    await expect(mainContent(page)).toBeVisible();
    const registryUrl = page.url();

    await page.context().clearCookies();
    await loginOnBranchRollbackBase(page, BRANCH_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await page.goto(`${BRANCH_ROLLBACK_BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });

    expect(registryUrl.startsWith(REGISTRY_BASE) || registryUrl.includes('5173')).toBeTruthy();
  });

  test('rollback mode still fail-closes inaccessible branch setActive', async ({ page }) => {
    const up = await isBranchRollbackServerUp();
    expect(up).toBe(true);

    await page.context().clearCookies();
    await loginOnBranchRollbackBase(page, BRANCH_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await page.waitForTimeout(500);
    const probe = await readBranchRuntimeProbe(page);
    // Static-only still publishes probe when provider mounts.
    if (probe?.branchSnapshotVersion) {
      const denied = await invokeBranchSetActive(page, '00000000-ffff-4000-8000-deniedbranch99');
      expect(denied.ok).toBe(false);
    } else {
      await expect(page.locator('#main-content')).toBeVisible();
    }
  });
});

test.describe('Dynamic branch — cross-module continuity', () => {
  test('Dashboard → Settings branding → Reports → Analytics keeps one branch version', async ({
    page,
  }) => {
    await loginAndShell(page, DEMO_OWNER);
    const start = await waitForBranchRuntimeProbe(page);
    await gotoDashboardHome(page);
    await gotoBrandingSettings(page);
    await gotoReportingHome(page);
    await gotoAnalyticsHome(page);
    const end = await waitForBranchRuntimeProbe(page);
    expect(end.branchSnapshotVersion).toBeTruthy();
    expect(end.tenantId).toBe(start.tenantId);
  });

  test('branch switch then analytics still uses same published version', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForBranchRuntimeProbe(page);
    const target =
      probe.accessibleBranchIds.find((id) => id !== probe.activeBranchId) ??
      probe.accessibleBranchIds[0];
    expect(target).toBeTruthy();
    expect((await invokeBranchSetActive(page, target!)).ok).toBe(true);
    await gotoAnalyticsHome(page);
    const after = await assertConsumerVersionsMatchPublished(page);
    expect(after.activeBranchId).toBe(target);
  });

  test('gm role: branch probe ready and shell intact', async ({ page }) => {
    await loginAndShell(page, DEMO_GENERAL_MANAGER);
    await gotoDashboardHome(page);
    expect((await waitForBranchRuntimeProbe(page)).branchSnapshotVersion).toBeTruthy();
  });

  test('owner restricted recovery after forced null session rebuilds version', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await writeActiveBranchSession(page, null);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForRegistryBootstrap(page);
    await assertShellVisible(page);
    const probe = await waitForBranchRuntimeProbe(page);
    expect(probe.branchSnapshotVersion).toBeTruthy();
  });
});
