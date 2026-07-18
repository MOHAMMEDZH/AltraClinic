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
  AUDIT_ROLLBACK_BASE,
  accessibleAuditFeedIdsFromBootstrap,
  accessibleAuditTypeIdsFromBootstrap,
  assertNoAuditRecordsInBrowserStorage,
  countAuditExtensionsFromBootstrap,
  gotoAuditSettings,
  gotoDashboardForAudit,
  invokeAuditRefresh,
  isAuditRollbackServerUp,
  loginOnAuditRollbackBase,
  readAuditRuntimeProbe,
  waitForAuditRuntimeProbe,
} from './helpers/dynamic-audit';

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
  await waitForAuditRuntimeProbe(page, { tenantId: credentials.tenantId ?? DEMO_TENANT_ID });
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

test.describe('Dynamic audit — registry foundation', () => {
  test('owner bootstrap exposes 60 audit contributions', async ({ request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-audit-owner-count',
    });
    expect(countAuditExtensionsFromBootstrap(body)).toBe(60);
    expect(accessibleAuditFeedIdsFromBootstrap(body).length).toBeGreaterThan(0);
    expect(accessibleAuditTypeIdsFromBootstrap(body).length).toBeGreaterThan(0);
  });

  test('owner login publishes audit runtime probe (registry mode)', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForAuditRuntimeProbe(page, {
      tenantId: DEMO_TENANT_ID,
      requireRegistry: true,
    });
    expect(probe.auditSnapshotVersion).toBeTruthy();
    expect(probe.isRegistrySource).toBe(true);
    expect(probe.source).toBe('registry');
    expect(probe.providerKey).toBe('audit.builtin');
    expect(probe.canViewAuditCenter).toBe(true);
    expect(probe.feedCount).toBeGreaterThan(0);
    expect(probe.typeCount).toBeGreaterThan(0);
    expect(probe.surfaceCount).toBeGreaterThan(0);
  });

  test('general_manager publishes synchronized audit snapshot', async ({ page }) => {
    await loginAndShell(page, DEMO_GENERAL_MANAGER);
    const probe = await waitForAuditRuntimeProbe(page);
    expect(probe.canViewAuditCenter).toBe(true);
    expect(probe.auditSnapshotVersion).toBeTruthy();
    const branch = await assertConsumerVersionsMatchPublished(page);
    expect(branch.consumerVersions.audit == null || branch.consumerVersions.audit === branch.branchSnapshotVersion).toBe(
      true,
    );
  });

  test('doctor shell loads with audit probe (no capability widen)', async ({ page }) => {
    await loginAndShell(page, DEMO_DOCTOR);
    const probe = await waitForAuditRuntimeProbe(page);
    expect(probe.auditSnapshotVersion).toBeTruthy();
    expect(probe.tenantId).toBe(DEMO_TENANT_ID);
  });

  test('dentist shell loads with audit probe', async ({ page }) => {
    await loginAndShell(page, DEMO_DENTIST);
    expect((await waitForAuditRuntimeProbe(page)).auditSnapshotVersion).toBeTruthy();
  });

  test('receptionist shell loads with audit probe', async ({ page }) => {
    await loginAndShell(page, DEMO_RECEPTIONIST);
    const probe = await waitForAuditRuntimeProbe(page);
    expect(probe.auditSnapshotVersion).toBeTruthy();
  });

  test('accountant shell loads with audit probe', async ({ page }) => {
    await loginAndShell(page, DEMO_ACCOUNTANT);
    expect((await waitForAuditRuntimeProbe(page)).auditSnapshotVersion).toBeTruthy();
  });

  test('inventory_manager shell loads with audit probe', async ({ page }) => {
    await loginAndShell(page, DEMO_INVENTORY_MANAGER);
    const probe = await waitForAuditRuntimeProbe(page);
    expect(probe.auditSnapshotVersion).toBeTruthy();
  });

  test('patient user bootstrap stays fail-closed on audit feeds', async ({ request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_PATIENT_USER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-audit-patient',
    });
    const feeds = accessibleAuditFeedIdsFromBootstrap(body);
    const types = accessibleAuditTypeIdsFromBootstrap(body);
    // Patient must never receive the full enterprise audit surface.
    expect(feeds.length).toBeLessThan(14);
    expect(types.length).toBeLessThan(42);
  });
});

test.describe('Dynamic audit — licensing matrix', () => {
  test('starter plan tenant publishes audit probe', async ({ page }) => {
    const starter = LICENSING_E2E_TENANTS.starter;
    await loginAndShell(page, {
      email: starter.email,
      password: starter.password,
      tenantId: starter.tenantId,
    });
    const probe = await waitForAuditRuntimeProbe(page, { tenantId: starter.tenantId });
    expect(probe.tenantId).toBe(starter.tenantId);
  });

  test('professional plan tenant publishes audit probe', async ({ page }) => {
    const professional = LICENSING_E2E_TENANTS.professional;
    await loginAndShell(page, {
      email: professional.email,
      password: professional.password,
      tenantId: professional.tenantId,
    });
    const probe = await waitForAuditRuntimeProbe(page, { tenantId: professional.tenantId });
    expect(probe.tenantId).toBe(professional.tenantId);
  });

  test('enterprise plan tenant publishes audit probe', async ({ page }) => {
    const enterprise = LICENSING_E2E_TENANTS.enterprise;
    await loginAndShell(page, {
      email: enterprise.email,
      password: enterprise.password,
      tenantId: enterprise.tenantId,
    });
    const probe = await waitForAuditRuntimeProbe(page, { tenantId: enterprise.tenantId });
    expect(probe.tenantId).toBe(enterprise.tenantId);
  });

  test('enterprise licensed tenant publishes audit probe', async ({ page }) => {
    const licensed = LICENSING_E2E_TENANTS.licensed;
    await loginAndShell(page, {
      email: licensed.email,
      password: licensed.password,
      tenantId: licensed.tenantId,
    });
    const probe = await waitForAuditRuntimeProbe(page, { tenantId: licensed.tenantId });
    expect(probe.tenantId).toBe(licensed.tenantId);
    expect(probe.auditSnapshotVersion).toBeTruthy();
  });

  test('grace tenant remains fail-closed for shell (no audit widen)', async ({ page }) => {
    await assertLicenseBlocksShell(page, LICENSING_E2E_TENANTS.grace);
  });

  test('suspended tenant remains fail-closed for shell', async ({ page }) => {
    await assertLicenseBlocksShell(page, LICENSING_E2E_TENANTS.suspended);
  });

  test('expired tenant remains fail-closed for shell', async ({ page }) => {
    await assertLicenseBlocksShell(page, LICENSING_E2E_TENANTS.expired);
  });
});

test.describe('Dynamic audit — capabilities & security', () => {
  test('owner capabilities project from snapshot (no client RBAC widen)', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForAuditRuntimeProbe(page, { requireRegistry: true });
    expect(probe.canViewAuditCenter).toBe(true);
    expect(probe.feedIds).toEqual(expect.arrayContaining(['all-authorized']));
    for (const flag of [
      probe.canViewSecurityAudit,
      probe.canViewClinicalAudit,
      probe.canViewFinancialAudit,
      probe.canViewCrossBranchAudit,
      probe.canSearchAudit,
      probe.canExportAudit,
      probe.canVerifyAuditIntegrity,
      probe.canManageRetentionPolicies,
      probe.canPlaceLegalHold,
      probe.canViewSensitiveAuditDetails,
    ]) {
      expect(typeof flag).toBe('boolean');
    }
  });

  test('feed ids are a subset of bootstrap-accessible feeds', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-audit-feed-subset',
    });
    const bootstrapFeeds = new Set(accessibleAuditFeedIdsFromBootstrap(body));
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForAuditRuntimeProbe(page, { requireRegistry: true });
    for (const feedId of probe.feedIds) {
      expect(bootstrapFeeds.has(feedId), `unexpected feed widen: ${feedId}`).toBe(true);
    }
  });

  test('tenant isolation — probe tenant matches login tenant', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForAuditRuntimeProbe(page);
    expect(probe.tenantId).toBe(DEMO_TENANT_ID);
    expect(probe.userId).toBeTruthy();
  });

  test('restricted loading never exposes audit center before registry ready', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.evaluate(() => sessionStorage.clear());
    const pre = await readAuditRuntimeProbe(page);
    expect(pre?.canViewAuditCenter ?? false).toBe(false);

    await loginAndShell(page, DEMO_OWNER);
    const post = await waitForAuditRuntimeProbe(page);
    expect(post.canViewAuditCenter).toBe(true);
  });

  test('browser storage never caches unrestricted audit records', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await waitForAuditRuntimeProbe(page, { requireRegistry: true });
    const { session, local } = await page.evaluate(() => ({
      session: sessionStorage.getItem('booking.moduleRegistry.bootstrap'),
      local: localStorage.getItem('booking.moduleRegistry.bootstrap'),
    }));
    assertNoAuditRecordsInBrowserStorage(session, local);
  });
});

test.describe('Dynamic audit — cache & refresh', () => {
  test('audit refresh does not spam registry bootstrap', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const before = await waitForAuditRuntimeProbe(page);
    const count = await countRegistryBootstrapRequests(page, async () => {
      await invokeAuditRefresh(page);
      await page.waitForTimeout(800);
    });
    expect(count).toBeLessThanOrEqual(2);
    const after = await waitForAuditRuntimeProbe(page);
    expect(after.tenantId).toBe(before.tenantId);
  });

  test('soft navigation reuses registry cache and keeps audit probe', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const rawBefore = await readRegistryCacheRaw(page);
    expect(rawBefore).toBeTruthy();
    const versionBefore = (await waitForAuditRuntimeProbe(page)).auditSnapshotVersion;
    await gotoDashboardForAudit(page);
    await gotoBrandingSettings(page);
    await gotoReportingHome(page);
    await gotoAuditSettings(page);
    const rawAfter = await readRegistryCacheRaw(page);
    expect(rawAfter).toBeTruthy();
    const versionAfter = (await waitForAuditRuntimeProbe(page)).auditSnapshotVersion;
    expect(versionAfter).toBeTruthy();
    expect(versionBefore).toBeTruthy();
  });

  test('logout clears session; re-login publishes new audit probe', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await waitForAuditRuntimeProbe(page);
    await logout(page);
    await page.evaluate(() => sessionStorage.clear());
    await loginAndShell(page, DEMO_GENERAL_MANAGER);
    const probe = await waitForAuditRuntimeProbe(page);
    expect(probe.auditSnapshotVersion).toBeTruthy();
    expect(probe.tenantId).toBe(DEMO_TENANT_ID);
  });

  test('tenant switch invalidates prior audit identity', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const ownerProbe = await waitForAuditRuntimeProbe(page);
    expect(ownerProbe.tenantId).toBe(DEMO_TENANT_ID);

    await logout(page);
    await page.evaluate(() => sessionStorage.clear());
    const licensed = LICENSING_E2E_TENANTS.licensed;
    await loginAndShell(page, {
      email: licensed.email,
      password: licensed.password,
      tenantId: licensed.tenantId,
    });
    const licensedProbe = await waitForAuditRuntimeProbe(page, { tenantId: licensed.tenantId });
    expect(licensedProbe.tenantId).toBe(licensed.tenantId);
    expect(licensedProbe.tenantId).not.toBe(DEMO_TENANT_ID);
  });

  test('branch refresh keeps audit consumer synchronized', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await invokeBranchRefresh(page);
    await page.waitForTimeout(500);
    const branch = await waitForBranchRuntimeProbe(page);
    const audit = await waitForAuditRuntimeProbe(page);
    expect(audit.branchSnapshotVersion === null || audit.branchSnapshotVersion === branch.branchSnapshotVersion).toBe(
      true,
    );
  });
});

test.describe('Dynamic audit — existing runtime continuity', () => {
  test('audit settings config path remains healthy for owner', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoAuditSettings(page);
    await expect(mainContent(page)).toBeVisible();
    const probe = await waitForAuditRuntimeProbe(page);
    expect(probe.canViewAuditCenter).toBe(true);
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('Dashboard → Reports → Analytics keeps audit probe tenant continuity', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const start = await waitForAuditRuntimeProbe(page);
    await gotoDashboardHome(page);
    await gotoReportingHome(page);
    await gotoAnalyticsHome(page);
    const end = await waitForAuditRuntimeProbe(page);
    expect(end.tenantId).toBe(start.tenantId);
    expect(end.providerKey).toBe('audit.builtin');
  });

  test('browser refresh preserves registry audit mode', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const before = await waitForAuditRuntimeProbe(page, { requireRegistry: true });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForRegistryBootstrap(page);
    await assertShellVisible(page);
    const after = await waitForAuditRuntimeProbe(page, {
      tenantId: DEMO_TENANT_ID,
      requireRegistry: true,
    });
    expect(after.isRegistrySource).toBe(true);
    expect(after.tenantId).toBe(before.tenantId);
  });
});

test.describe('Dynamic audit — performance', () => {
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

  test('audit probe does not rebuild storm on idle', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const v1 = (await waitForAuditRuntimeProbe(page)).auditSnapshotVersion;
    await page.waitForTimeout(1_000);
    const v2 = (await waitForAuditRuntimeProbe(page)).auditSnapshotVersion;
    expect(v2).toBe(v1);
  });
});

test.describe('Dynamic audit — rollback mode (5181)', () => {
  test('audit rollback server is reachable', async () => {
    const up = await isAuditRollbackServerUp();
    expect(up, `Audit rollback dashboard must run at ${AUDIT_ROLLBACK_BASE}`).toBe(true);
  });

  test('static audit rollback preserves shell login', async ({ page }) => {
    const up = await isAuditRollbackServerUp();
    expect(up).toBe(true);

    await page.context().clearCookies();
    await loginOnAuditRollbackBase(page, AUDIT_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await expect(page.locator('header button[class*="userBtn"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('rollback mode publishes static-only audit probe', async ({ page }) => {
    const up = await isAuditRollbackServerUp();
    expect(up).toBe(true);

    await page.context().clearCookies();
    await loginOnAuditRollbackBase(page, AUDIT_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await page.goto(`${AUDIT_ROLLBACK_BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });

    const probe = await waitForAuditRuntimeProbe(page, { tenantId: DEMO_TENANT_ID });
    expect(probe.isRegistrySource).toBe(false);
    expect(probe.source).toBe('static-only');
    expect(probe.canViewAuditCenter).toBe(true);
    expect(probe.providerKey).toBe('audit.builtin');
    expect(probe.feedCount).toBeGreaterThan(0);
  });

  test('registry (5173) and rollback (5181) both expose audit for owner', async ({ page }) => {
    const up = await isAuditRollbackServerUp();
    expect(up).toBe(true);

    await loginAndShell(page, DEMO_OWNER);
    const registryProbe = await waitForAuditRuntimeProbe(page, { requireRegistry: true });
    expect(registryProbe.isRegistrySource).toBe(true);

    await page.context().clearCookies();
    await loginOnAuditRollbackBase(page, AUDIT_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await page.goto(`${AUDIT_ROLLBACK_BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
    const rollbackProbe = await waitForAuditRuntimeProbe(page, { tenantId: DEMO_TENANT_ID });
    expect(rollbackProbe.isRegistrySource).toBe(false);
    expect(rollbackProbe.source).toBe('static-only');
    expect(rollbackProbe.canViewAuditCenter).toBe(true);
  });

  test('rollback fail-closed — no capability widen beyond static snapshot', async ({ page }) => {
    const up = await isAuditRollbackServerUp();
    expect(up).toBe(true);

    await page.context().clearCookies();
    await loginOnAuditRollbackBase(page, AUDIT_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await page.goto(`${AUDIT_ROLLBACK_BASE}/`, { waitUntil: 'domcontentloaded' });
    const probe = await waitForAuditRuntimeProbe(page);
    expect(probe.source).toBe('static-only');
    expect(probe.feedCount).toBeLessThanOrEqual(14);
    expect(probe.surfaceCount).toBeLessThanOrEqual(4);
  });
});
