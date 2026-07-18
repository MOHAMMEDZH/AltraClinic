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
import { DEMO_SARAH_PATIENT_ID, gotoPatientDetail } from './helpers/patients';
import {
  EXPECTED_JOURNEY_CONTRIBUTION_COUNT,
  JOURNEY_ROLLBACK_BASE,
  accessibleJourneyPackIdsFromBootstrap,
  accessibleJourneyStageIdsFromBootstrap,
  accessibleJourneySurfaceIdsFromBootstrap,
  assertNoJourneyRecordsInBrowserStorage,
  countJourneyExtensionsFromBootstrap,
  gotoAppointmentsForJourney,
  gotoDashboardForJourney,
  gotoPatientsList,
  gotoQueueForJourney,
  invokeJourneyRefresh,
  isJourneyRollbackServerUp,
  loginOnJourneyRollbackBase,
  readJourneyRuntimeProbe,
  waitForJourneyRuntimeProbe,
} from './helpers/dynamic-journey';

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
  await waitForJourneyRuntimeProbe(page, { tenantId: credentials.tenantId ?? DEMO_TENANT_ID });
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

test.describe('Dynamic journey — registry foundation', () => {
  test('owner bootstrap exposes 65 journey contributions', async ({ request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-journey-owner-count',
    });
    expect(countJourneyExtensionsFromBootstrap(body)).toBe(EXPECTED_JOURNEY_CONTRIBUTION_COUNT);
    expect(accessibleJourneyStageIdsFromBootstrap(body).length).toBeGreaterThan(0);
    expect(accessibleJourneySurfaceIdsFromBootstrap(body).length).toBeGreaterThan(0);
  });

  test('owner login publishes journey runtime probe (registry mode)', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForJourneyRuntimeProbe(page, {
      tenantId: DEMO_TENANT_ID,
      requireRegistry: true,
    });
    expect(probe.journeySnapshotVersion).toBeTruthy();
    expect(probe.isRegistrySource).toBe(true);
    expect(probe.source).toBe('registry');
    expect(probe.providerKey).toBe('journey.builtin');
    expect(probe.canViewJourney).toBe(true);
    expect(probe.stageCount).toBeGreaterThan(0);
    expect(probe.transitionCount).toBeGreaterThan(0);
    expect(probe.surfaceCount).toBeGreaterThan(0);
  });

  test('general_manager publishes synchronized journey snapshot', async ({ page }) => {
    await loginAndShell(page, DEMO_GENERAL_MANAGER);
    const probe = await waitForJourneyRuntimeProbe(page);
    expect(probe.canViewJourney).toBe(true);
    expect(probe.journeySnapshotVersion).toBeTruthy();
    const branch = await assertConsumerVersionsMatchPublished(page);
    expect(
      branch.consumerVersions.journey == null ||
        branch.consumerVersions.journey === branch.branchSnapshotVersion,
    ).toBe(true);
  });

  test('doctor shell loads with journey probe (no capability widen)', async ({ page }) => {
    await loginAndShell(page, DEMO_DOCTOR);
    const probe = await waitForJourneyRuntimeProbe(page);
    expect(probe.journeySnapshotVersion).toBeTruthy();
    expect(probe.tenantId).toBe(DEMO_TENANT_ID);
  });

  test('dentist shell loads with journey probe', async ({ page }) => {
    await loginAndShell(page, DEMO_DENTIST);
    expect((await waitForJourneyRuntimeProbe(page)).journeySnapshotVersion).toBeTruthy();
  });

  test('receptionist shell loads with journey probe', async ({ page }) => {
    await loginAndShell(page, DEMO_RECEPTIONIST);
    const probe = await waitForJourneyRuntimeProbe(page);
    expect(probe.journeySnapshotVersion).toBeTruthy();
  });

  test('accountant shell loads with journey probe', async ({ page }) => {
    await loginAndShell(page, DEMO_ACCOUNTANT);
    expect((await waitForJourneyRuntimeProbe(page)).journeySnapshotVersion).toBeTruthy();
  });

  test('inventory_manager shell loads with journey probe', async ({ page }) => {
    await loginAndShell(page, DEMO_INVENTORY_MANAGER);
    const probe = await waitForJourneyRuntimeProbe(page);
    expect(probe.journeySnapshotVersion).toBeTruthy();
  });

  test('patient user bootstrap stays fail-closed on journey surfaces', async ({ request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_PATIENT_USER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-journey-patient',
    });
    const stages = accessibleJourneyStageIdsFromBootstrap(body);
    const surfaces = accessibleJourneySurfaceIdsFromBootstrap(body);
    const packs = accessibleJourneyPackIdsFromBootstrap(body);
    // Patient must never receive the full enterprise journey configuration surface.
    expect(stages.length).toBeLessThan(21);
    expect(surfaces.length).toBeLessThan(4);
    expect(packs.length).toBeLessThan(4);
  });
});

test.describe('Dynamic journey — licensing matrix', () => {
  test('starter plan tenant publishes journey probe', async ({ page }) => {
    const starter = LICENSING_E2E_TENANTS.starter;
    await loginAndShell(page, {
      email: starter.email,
      password: starter.password,
      tenantId: starter.tenantId,
    });
    const probe = await waitForJourneyRuntimeProbe(page, { tenantId: starter.tenantId });
    expect(probe.tenantId).toBe(starter.tenantId);
  });

  test('professional plan tenant publishes journey probe', async ({ page }) => {
    const professional = LICENSING_E2E_TENANTS.professional;
    await loginAndShell(page, {
      email: professional.email,
      password: professional.password,
      tenantId: professional.tenantId,
    });
    const probe = await waitForJourneyRuntimeProbe(page, { tenantId: professional.tenantId });
    expect(probe.tenantId).toBe(professional.tenantId);
  });

  test('enterprise plan tenant publishes journey probe', async ({ page }) => {
    const enterprise = LICENSING_E2E_TENANTS.enterprise;
    await loginAndShell(page, {
      email: enterprise.email,
      password: enterprise.password,
      tenantId: enterprise.tenantId,
    });
    const probe = await waitForJourneyRuntimeProbe(page, { tenantId: enterprise.tenantId });
    expect(probe.tenantId).toBe(enterprise.tenantId);
  });

  test('enterprise licensed tenant publishes journey probe', async ({ page }) => {
    const licensed = LICENSING_E2E_TENANTS.licensed;
    await loginAndShell(page, {
      email: licensed.email,
      password: licensed.password,
      tenantId: licensed.tenantId,
    });
    const probe = await waitForJourneyRuntimeProbe(page, { tenantId: licensed.tenantId });
    expect(probe.tenantId).toBe(licensed.tenantId);
    expect(probe.journeySnapshotVersion).toBeTruthy();
  });

  test('grace tenant remains fail-closed for shell (no journey widen)', async ({ page }) => {
    await assertLicenseBlocksShell(page, LICENSING_E2E_TENANTS.grace);
  });

  test('suspended tenant remains fail-closed for shell', async ({ page }) => {
    await assertLicenseBlocksShell(page, LICENSING_E2E_TENANTS.suspended);
  });

  test('expired tenant remains fail-closed for shell', async ({ page }) => {
    await assertLicenseBlocksShell(page, LICENSING_E2E_TENANTS.expired);
  });
});

test.describe('Dynamic journey — capabilities & security', () => {
  test('owner capabilities project from snapshot (no client RBAC widen)', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForJourneyRuntimeProbe(page, { requireRegistry: true });
    expect(probe.canViewJourney).toBe(true);
    expect(probe.canViewPatientTimeline).toBe(true);
    for (const flag of [
      probe.canViewJourney,
      probe.canViewPatientTimeline,
      probe.canConfigureJourney,
      probe.canUseJourneyPacks,
    ]) {
      expect(typeof flag).toBe('boolean');
    }
  });

  test('stage count is bounded by bootstrap-accessible stages', async ({ page, request }) => {
    const body = await bootstrapBody(request, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
      deviceName: 'pw-journey-stage-subset',
    });
    const bootstrapStages = accessibleJourneyStageIdsFromBootstrap(body);
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForJourneyRuntimeProbe(page, { requireRegistry: true });
    expect(probe.stageCount).toBeLessThanOrEqual(bootstrapStages.length);
    expect(probe.stageCount).toBeLessThanOrEqual(21);
    expect(probe.transitionCount).toBeLessThanOrEqual(22);
    expect(probe.surfaceCount).toBeLessThanOrEqual(4);
    expect(probe.packCount).toBeLessThanOrEqual(4);
  });

  test('tenant isolation — probe tenant matches login tenant', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const probe = await waitForJourneyRuntimeProbe(page);
    expect(probe.tenantId).toBe(DEMO_TENANT_ID);
    expect(probe.userId).toBeTruthy();
  });

  test('restricted loading never exposes journey center before registry ready', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.evaluate(() => sessionStorage.clear());
    const pre = await readJourneyRuntimeProbe(page);
    expect(pre?.canViewJourney ?? false).toBe(false);

    await loginAndShell(page, DEMO_OWNER);
    const post = await waitForJourneyRuntimeProbe(page);
    expect(post.canViewJourney).toBe(true);
  });

  test('browser storage never caches patient journey records / PHI', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await waitForJourneyRuntimeProbe(page, { requireRegistry: true });
    const { session, local } = await page.evaluate(() => ({
      session: sessionStorage.getItem('booking.moduleRegistry.bootstrap'),
      local: localStorage.getItem('booking.moduleRegistry.bootstrap'),
    }));
    assertNoJourneyRecordsInBrowserStorage(session, local);
  });
});

test.describe('Dynamic journey — cache & refresh', () => {
  test('journey refresh does not spam registry bootstrap', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const before = await waitForJourneyRuntimeProbe(page);
    const count = await countRegistryBootstrapRequests(page, async () => {
      await invokeJourneyRefresh(page);
      await page.waitForTimeout(800);
    });
    expect(count).toBeLessThanOrEqual(2);
    const after = await waitForJourneyRuntimeProbe(page);
    expect(after.tenantId).toBe(before.tenantId);
  });

  test('soft navigation reuses registry cache and keeps journey probe', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const rawBefore = await readRegistryCacheRaw(page);
    expect(rawBefore).toBeTruthy();
    const versionBefore = (await waitForJourneyRuntimeProbe(page)).journeySnapshotVersion;
    await gotoDashboardForJourney(page);
    await gotoBrandingSettings(page);
    await gotoReportingHome(page);
    await gotoPatientsList(page);
    const rawAfter = await readRegistryCacheRaw(page);
    expect(rawAfter).toBeTruthy();
    const versionAfter = (await waitForJourneyRuntimeProbe(page)).journeySnapshotVersion;
    expect(versionAfter).toBeTruthy();
    expect(versionBefore).toBeTruthy();
  });

  test('logout clears session; re-login publishes new journey probe', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await waitForJourneyRuntimeProbe(page);
    await logout(page);
    await page.evaluate(() => sessionStorage.clear());
    await loginAndShell(page, DEMO_GENERAL_MANAGER);
    const probe = await waitForJourneyRuntimeProbe(page);
    expect(probe.journeySnapshotVersion).toBeTruthy();
    expect(probe.tenantId).toBe(DEMO_TENANT_ID);
  });

  test('tenant switch invalidates prior journey identity', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const ownerProbe = await waitForJourneyRuntimeProbe(page);
    expect(ownerProbe.tenantId).toBe(DEMO_TENANT_ID);

    await logout(page);
    await page.evaluate(() => sessionStorage.clear());
    const licensed = LICENSING_E2E_TENANTS.licensed;
    await loginAndShell(page, {
      email: licensed.email,
      password: licensed.password,
      tenantId: licensed.tenantId,
    });
    const licensedProbe = await waitForJourneyRuntimeProbe(page, { tenantId: licensed.tenantId });
    expect(licensedProbe.tenantId).toBe(licensed.tenantId);
    expect(licensedProbe.tenantId).not.toBe(DEMO_TENANT_ID);
  });

  test('branch refresh keeps journey consumer synchronized', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await invokeBranchRefresh(page);
    await page.waitForTimeout(500);
    const branch = await waitForBranchRuntimeProbe(page);
    const journey = await waitForJourneyRuntimeProbe(page);
    expect(
      journey.branchSnapshotVersion === null ||
        journey.branchSnapshotVersion === branch.branchSnapshotVersion,
    ).toBe(true);
  });
});

test.describe('Dynamic journey — existing runtime continuity', () => {
  test('patient detail exposes journey strip configuration attrs', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await gotoPatientDetail(page, DEMO_SARAH_PATIENT_ID);
    await expect(page.locator('#patients-detail-region')).toBeVisible({ timeout: 30_000 });
    const strip = await page.locator('#patients-detail-region').getAttribute('data-journey-strip');
    expect(strip === 'ready' || strip === 'hidden').toBe(true);
    const probe = await waitForJourneyRuntimeProbe(page);
    expect(probe.canViewPatientTimeline).toBe(true);
    if (probe.canViewPatientTimeline) {
      expect(strip).toBe('ready');
    }
  });

  test('Patients → Appointments → Queue keeps journey probe tenant continuity', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const start = await waitForJourneyRuntimeProbe(page);
    await gotoPatientsList(page);
    await gotoAppointmentsForJourney(page);
    await gotoQueueForJourney(page);
    const end = await waitForJourneyRuntimeProbe(page);
    expect(end.tenantId).toBe(start.tenantId);
    expect(end.providerKey).toBe('journey.builtin');
  });

  test('Dashboard → Reports → Analytics keeps journey probe', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const start = await waitForJourneyRuntimeProbe(page);
    await gotoDashboardHome(page);
    await gotoReportingHome(page);
    await gotoAnalyticsHome(page);
    const end = await waitForJourneyRuntimeProbe(page);
    expect(end.tenantId).toBe(start.tenantId);
    expect(end.providerKey).toBe('journey.builtin');
    await expect(mainContent(page)).toBeVisible();
  });

  test('browser refresh preserves registry journey mode', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const before = await waitForJourneyRuntimeProbe(page, { requireRegistry: true });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForRegistryBootstrap(page);
    await assertShellVisible(page);
    const after = await waitForJourneyRuntimeProbe(page, {
      tenantId: DEMO_TENANT_ID,
      requireRegistry: true,
    });
    expect(after.isRegistrySource).toBe(true);
    expect(after.tenantId).toBe(before.tenantId);
  });
});

test.describe('Dynamic journey — performance', () => {
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

  test('journey probe does not rebuild storm on idle', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    const v1 = (await waitForJourneyRuntimeProbe(page)).journeySnapshotVersion;
    await page.waitForTimeout(1_000);
    const v2 = (await waitForJourneyRuntimeProbe(page)).journeySnapshotVersion;
    expect(v2).toBe(v1);
  });
});

test.describe('Dynamic journey — rollback mode (5182)', () => {
  test('journey rollback server is reachable', async () => {
    const up = await isJourneyRollbackServerUp();
    expect(up, `Journey rollback dashboard must run at ${JOURNEY_ROLLBACK_BASE}`).toBe(true);
  });

  test('static journey rollback preserves shell login', async ({ page }) => {
    const up = await isJourneyRollbackServerUp();
    expect(up).toBe(true);

    await page.context().clearCookies();
    await loginOnJourneyRollbackBase(page, JOURNEY_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await expect(page.locator('header button[class*="userBtn"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('rollback mode publishes static-only journey probe', async ({ page }) => {
    const up = await isJourneyRollbackServerUp();
    expect(up).toBe(true);

    await page.context().clearCookies();
    await loginOnJourneyRollbackBase(page, JOURNEY_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await page.goto(`${JOURNEY_ROLLBACK_BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });

    const probe = await waitForJourneyRuntimeProbe(page, { tenantId: DEMO_TENANT_ID });
    expect(probe.isRegistrySource).toBe(false);
    expect(probe.source).toBe('static-only');
    expect(probe.canViewJourney).toBe(true);
    expect(probe.providerKey).toBe('journey.builtin');
    expect(probe.stageCount).toBeGreaterThan(0);
  });

  test('registry (5173) and rollback (5182) both expose journey for owner', async ({ page }) => {
    const up = await isJourneyRollbackServerUp();
    expect(up).toBe(true);

    await loginAndShell(page, DEMO_OWNER);
    const registryProbe = await waitForJourneyRuntimeProbe(page, { requireRegistry: true });
    expect(registryProbe.isRegistrySource).toBe(true);

    await page.context().clearCookies();
    await loginOnJourneyRollbackBase(page, JOURNEY_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await page.goto(`${JOURNEY_ROLLBACK_BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
    const rollbackProbe = await waitForJourneyRuntimeProbe(page, { tenantId: DEMO_TENANT_ID });
    expect(rollbackProbe.isRegistrySource).toBe(false);
    expect(rollbackProbe.source).toBe('static-only');
    expect(rollbackProbe.canViewJourney).toBe(true);
  });

  test('rollback fail-closed — no capability widen beyond static snapshot', async ({ page }) => {
    const up = await isJourneyRollbackServerUp();
    expect(up).toBe(true);

    await page.context().clearCookies();
    await loginOnJourneyRollbackBase(page, JOURNEY_ROLLBACK_BASE, {
      ...DEMO_OWNER,
      tenantId: DEMO_TENANT_ID,
    });
    await page.goto(`${JOURNEY_ROLLBACK_BASE}/`, { waitUntil: 'domcontentloaded' });
    const probe = await waitForJourneyRuntimeProbe(page);
    expect(probe.source).toBe('static-only');
    expect(probe.stageCount).toBeLessThanOrEqual(21);
    expect(probe.transitionCount).toBeLessThanOrEqual(22);
    expect(probe.surfaceCount).toBeLessThanOrEqual(4);
    expect(probe.packCount).toBeLessThanOrEqual(4);
  });
});
