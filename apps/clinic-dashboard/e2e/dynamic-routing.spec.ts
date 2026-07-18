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
  assertRouteHeading,
  assertRouteNotRendered,
  assertShellVisible,
  captureRegistryBootstrap,
  countRedirects,
  gotoShellRoute,
  mainContent,
  readRegistryCacheRaw,
  readRegistryCacheTenant,
  routingPathsFromBootstrap,
  waitForRegistryBootstrap,
} from './helpers/dynamic-routing';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3000';
const ROLLBACK_BASE = process.env.PLAYWRIGHT_ROLLBACK_URL ?? 'http://127.0.0.1:5174';

test.describe.configure({ mode: 'serial', timeout: 90_000 });

test.beforeEach(({ }, testInfo) => {
  if (!isE2eApiReady()) {
    testInfo.skip(true, E2E_SKIP_REASON);
  }
});

async function loginAndBootstrap(page: Page, credentials: LoginCredentials) {
  const bootstrap = captureRegistryBootstrap(page);
  await login(page, credentials);
  const response = await bootstrap;
  expect(response?.ok(), 'registry bootstrap should succeed').toBeTruthy();
  await waitForRegistryBootstrap(page);
}

test.describe('Dynamic routing — role routes (registry mode)', () => {
  test('owner: core shell routes render via registry', async ({ page }) => {
    await loginAndBootstrap(page, DEMO_OWNER);
    await gotoShellRoute(page, '/patients');
    await assertShellVisible(page);
    await assertRouteHeading(page, /Patients/i);

    await gotoShellRoute(page, '/analytics');
    await assertRouteHeading(page, /Analytics/i);

    await gotoShellRoute(page, '/settings/subscription');
    await assertShellVisible(page);
  });

  test('receptionist: operational routes without analytics', async ({ page }) => {
    await loginAndBootstrap(page, DEMO_RECEPTIONIST);
    await gotoShellRoute(page, '/queue');
    await assertShellVisible(page);

    await gotoShellRoute(page, '/analytics');
    await assertRouteNotRendered(page, /Analytics/i);
  });

  test('doctor: clinical routes without subscription settings', async ({ page }) => {
    await loginAndBootstrap(page, DEMO_DOCTOR);
    await gotoShellRoute(page, '/encounters');
    await assertShellVisible(page);

    await gotoShellRoute(page, '/settings/subscription');
    await assertRouteNotRendered(page, /Subscription|Plans/i);
  });

  test('dentist: dental module route renders', async ({ page }) => {
    await loginAndBootstrap(page, DEMO_DENTIST);
    await gotoShellRoute(page, '/dental');
    await assertShellVisible(page);
    await expect(mainContent(page)).not.toBeEmpty();
  });

  test('beauty specialist: beauty module route renders', async ({ page }) => {
    await loginAndBootstrap(page, DEMO_SPECIALIST);
    await gotoShellRoute(page, '/beauty');
    await assertShellVisible(page);
    await assertRouteHeading(page, /Beauty.*Aesthetics/i);
  });

  test('inventory manager: inventory route renders', async ({ page }) => {
    await loginAndBootstrap(page, DEMO_INVENTORY_MANAGER);
    await gotoShellRoute(page, '/inventory');
    await assertShellVisible(page);
    await expect(mainContent(page)).not.toBeEmpty();
  });

  test('accountant: billing and subscription routes render', async ({ page }) => {
    await loginAndBootstrap(page, DEMO_ACCOUNTANT);
    await gotoShellRoute(page, '/billing');
    await assertShellVisible(page);

    await gotoShellRoute(page, '/settings/subscription');
    await assertShellVisible(page);
  });

  test('patient: my-appointments portal route renders', async ({ page }) => {
    await loginAndBootstrap(page, DEMO_PATIENT_USER);
    await gotoShellRoute(page, '/my-appointments');
    await assertShellVisible(page);
    await assertRouteHeading(page, /My appointments/i);
    await gotoShellRoute(page, '/patients');
    await assertRouteNotRendered(page, /Patients/i);
  });

  test('owner (super-admin parity): bootstrap exposes full routing surface', async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      headers: { 'x-tenant-id': DEMO_TENANT_ID },
      data: {
        email: DEMO_OWNER.email,
        password: DEMO_OWNER.password,
        tenantId: DEMO_TENANT_ID,
        deviceName: 'playwright-routing-owner-bootstrap',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = (await loginRes.json()) as { accessToken: string };

    const bootstrapRes = await request.get(`${API_BASE}/tenant/modules/registry/bootstrap`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant-id': DEMO_TENANT_ID },
    });
    expect(bootstrapRes.ok()).toBeTruthy();
    const body = await bootstrapRes.json();
    const paths = routingPathsFromBootstrap(body);
    expect(paths.length).toBeGreaterThan(15);
    expect(paths.some((p) => p.includes('/patients'))).toBe(true);
    expect(paths.some((p) => p.includes('/analytics'))).toBe(true);
  });
});

test.describe('Dynamic routing — licensing lifecycle', () => {
  test('expired tenant: license experience blocks dashboard shell route', async ({ page }) => {
    const tenant = LICENSING_E2E_TENANTS.expired;
    await login(
      page,
      { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId },
      { requireAppShell: false },
    );
    await page.goto('/');
    await expect(page.getByTestId('enterprise-license-experience')).toBeVisible({ timeout: 45_000 });
  });

  test('suspended tenant: license experience blocks deep-linked module route', async ({ page }) => {
    const tenant = LICENSING_E2E_TENANTS.suspended;
    await login(
      page,
      { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId },
      { requireAppShell: false },
    );
    await page.goto('/patients');
    await expect(page.getByTestId('enterprise-license-experience')).toBeVisible({ timeout: 45_000 });
  });

  test('read-only grace tenant: license experience blocks operational settings', async ({ page }) => {
    const tenant = LICENSING_E2E_TENANTS.grace;
    await login(
      page,
      { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId },
      { requireAppShell: false },
    );
    await page.goto('/settings');
    await expect(page.getByTestId('enterprise-license-experience')).toBeVisible({ timeout: 45_000 });
  });

  test('starter tenant: analytics module blocked by plan licensing', async ({ page, request }) => {
    const tenant = LICENSING_E2E_TENANTS.starter;
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      headers: { 'x-tenant-id': tenant.tenantId },
      data: {
        email: tenant.email,
        password: tenant.password,
        tenantId: tenant.tenantId,
        deviceName: 'playwright-routing-starter',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = (await loginRes.json()) as { accessToken: string };

    const entRes = await request.get(`${API_BASE}/tenant/subscription/entitlements`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant-id': tenant.tenantId },
    });
    const entitlements = (await entRes.json()) as {
      license: { features: Record<string, string> };
    };
    expect(entitlements.license.features.analytics).toBe('disabled');

    const bootstrapRes = await request.get(`${API_BASE}/tenant/modules/registry/bootstrap`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant-id': tenant.tenantId },
    });
    const body = await bootstrapRes.json();
    const analyticsModule = body.modules.find((m: { moduleId: string }) => m.moduleId === 'analytics');
    expect(analyticsModule?.userAccessible).toBe(false);
    expect(analyticsModule?.lockReason).toBe('plan');

    await login(page, {
      email: tenant.email,
      password: tenant.password,
      tenantId: tenant.tenantId,
    });
    await gotoShellRoute(page, '/analytics');
    await assertRouteNotRendered(page, /Analytics hub/i);
  });
});

test.describe('Dynamic routing — cache isolation', () => {
  test('tenant switch clears registry cache and serves new tenant routes', async ({ page }) => {
    await loginAndBootstrap(page, DEMO_OWNER);
    const ownerCache = await readRegistryCacheRaw(page);
    expect(ownerCache).toBeTruthy();
    expect(ownerCache).toContain(DEMO_TENANT_ID);

    await logout(page);

    const bootstrap = captureRegistryBootstrap(page);
    const licensed = LICENSING_E2E_TENANTS.licensed;
    await login(page, {
      email: licensed.email,
      password: licensed.password,
      tenantId: licensed.tenantId,
    });
    await bootstrap;

    const licensedCache = await readRegistryCacheRaw(page);
    expect(licensedCache).toBeTruthy();
    expect(licensedCache).toContain(licensed.tenantId);
    expect(licensedCache).not.toContain(DEMO_TENANT_ID);
  });

  test('logout and login refetches bootstrap for role change', async ({ page }) => {
    await loginAndBootstrap(page, DEMO_OWNER);
    await gotoShellRoute(page, '/analytics');
    await assertRouteHeading(page, /Analytics/i);

    await logout(page);
    const bootstrap = captureRegistryBootstrap(page);
    await login(page, DEMO_RECEPTIONIST);
    await bootstrap;

    await gotoShellRoute(page, '/analytics');
    await assertRouteNotRendered(page, /Analytics/i);
    await gotoShellRoute(page, '/queue');
    await assertShellVisible(page);
  });
});

test.describe('Dynamic routing — navigation behavior', () => {
  test('browser refresh preserves deep-linked nested route', async ({ page }) => {
    await loginAndBootstrap(page, DEMO_OWNER);
    await gotoShellRoute(page, '/workflows/instances');
    await assertShellVisible(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/workflows\/instances/);
    await assertShellVisible(page);
  });

  test('deep-link entry renders without prior in-app navigation', async ({ page }) => {
    await loginAndBootstrap(page, DEMO_OWNER);
    await page.goto('/settings/subscription', { waitUntil: 'domcontentloaded' });
    await assertShellVisible(page);
    await expect(page).toHaveURL(/\/settings\/subscription/);
  });

  test('history navigation back preserves prior route', async ({ page }) => {
    await loginAndBootstrap(page, DEMO_OWNER);
    await gotoShellRoute(page, '/patients');
    await expect(page).toHaveURL(/\/patients/);
    await gotoShellRoute(page, '/appointments');
    await expect(page).toHaveURL(/\/appointments/, { timeout: 15_000 });
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/patients/, { timeout: 15_000 });
  });

  test('lazy module chunk loads on first navigation', async ({ page }) => {
    await loginAndBootstrap(page, DEMO_OWNER);
    const chunkRequest = page
      .waitForResponse(
        (resp) => resp.url().includes('/assets/') && resp.url().includes('.js') && resp.ok(),
        { timeout: 30_000 },
      )
      .catch(() => null);
    await gotoShellRoute(page, '/inventory');
    await chunkRequest;
    await assertShellVisible(page);
  });

  test('no infinite redirect loop on dashboard entry', async ({ page }) => {
    await loginAndBootstrap(page, DEMO_OWNER);
    const redirects = await countRedirects(page, async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
    });
    expect(redirects).toBeLessThan(5);
    await assertShellVisible(page);
  });
});

test.describe('Dynamic routing — security and resilience', () => {
  test('hidden route direct URL does not render protected module UI', async ({ page }) => {
    await loginAndBootstrap(page, DEMO_RECEPTIONIST);
    await gotoShellRoute(page, '/analytics');
    await assertRouteNotRendered(page, /Analytics/i);
    await assertShellVisible(page);
  });

  test('registry unavailable falls back to static routing catalog', async ({ page }) => {
    await page.route('**/tenant/modules/registry/bootstrap', (route) => route.abort('failed'));
    await login(page, DEMO_OWNER);
    await gotoShellRoute(page, '/patients');
    await assertShellVisible(page);
    await assertRouteHeading(page, /Patients/i);
  });

  test('unknown unauthenticated path redirects to login', async ({ page }) => {
    await page.goto('/totally-unknown-guest-route');
    await expect(page).toHaveURL(/\/login/);
  });

  test('authenticated unknown shell path keeps shell without crash', async ({ page }) => {
    await loginAndBootstrap(page, DEMO_OWNER);
    await page.goto('/unknown-shell-route-xyz', { waitUntil: 'domcontentloaded' });
    await assertShellVisible(page);
  });
});

test.describe('Dynamic routing — rollback mode', () => {
  test('static rollback build serves owner routes on rollback port', async ({ page }) => {
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

    await page.goto(`${ROLLBACK_BASE}/patients`, { waitUntil: 'domcontentloaded' });
    await assertShellVisible(page);
    await assertRouteHeading(page, /Patients/i);
  });
});

test.describe('Dynamic routing — bootstrap API parity', () => {
  test('receptionist bootstrap routing paths exclude analytics', async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      headers: { 'x-tenant-id': DEMO_TENANT_ID },
      data: {
        email: DEMO_RECEPTIONIST.email,
        password: DEMO_RECEPTIONIST.password,
        tenantId: DEMO_TENANT_ID,
        deviceName: 'playwright-routing-receptionist',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = (await loginRes.json()) as { accessToken: string };
    const bootstrapRes = await request.get(`${API_BASE}/tenant/modules/registry/bootstrap`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant-id': DEMO_TENANT_ID },
    });
    const body = await bootstrapRes.json();
    const paths = routingPathsFromBootstrap(body);
    expect(paths.some((p) => p.includes('/queue'))).toBe(true);
    expect(paths.some((p) => p === '/analytics' || p.startsWith('/analytics/'))).toBe(false);
  });
});
