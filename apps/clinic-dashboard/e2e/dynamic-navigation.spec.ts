import { test, expect, type Page } from '@playwright/test';
import { login, logout } from './helpers/auth';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import {
  DEMO_ACCOUNTANT,
  DEMO_BRANCH_MANAGER,
  DEMO_DOCTOR,
  DEMO_OWNER,
  DEMO_RECEPTIONIST,
  DEMO_TENANT_ID,
} from './helpers/demo-credentials';
import { LICENSING_E2E_TENANTS } from './helpers/licensing-tenants';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3000';

function sidebar(page: Page) {
  return page.locator('aside[aria-label]').first();
}

function sidebarHrefs(page: Page) {
  return sidebar(page).locator('a[href]').evaluateAll((links) =>
    links.map((link) => link.getAttribute('href')).filter(Boolean),
  );
}

function captureRegistryBootstrap(page: Page) {
  return page
    .waitForResponse(
      (resp) =>
        resp.url().includes('/tenant/modules/registry/bootstrap') && resp.request().method() === 'GET',
      { timeout: 30_000 },
    )
    .catch(() => null);
}

async function waitForRegistryBootstrap(page: Page) {
  const hasCache = await page
    .evaluate(() => Boolean(sessionStorage.getItem('booking.moduleRegistry.bootstrap')))
    .catch(() => false);
  if (hasCache) return null;

  return captureRegistryBootstrap(page);
}

test.describe('Dynamic navigation — registry sidebar', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('owner receives registry-driven sidebar links', async ({ page }) => {
    const bootstrap = captureRegistryBootstrap(page);
    await login(page, DEMO_OWNER);
    const response = await bootstrap;
    expect(response?.ok(), 'registry bootstrap should succeed for owner').toBeTruthy();

    const hrefs = await sidebarHrefs(page);
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/patients');
    expect(hrefs).toContain('/appointments');
  });

  test('accountant sidebar includes subscription nav parity path', async ({ page }) => {
    await login(page, DEMO_ACCOUNTANT);
    await waitForRegistryBootstrap(page);
    const hrefs = await sidebarHrefs(page);
    expect(hrefs).toContain('/settings/subscription');
    expect(hrefs).toContain('/billing');
    expect(hrefs).not.toContain('/settings');
  });

  test('branch manager sidebar includes subscription nav parity path', async ({ page }) => {
    await login(page, DEMO_BRANCH_MANAGER);
    await waitForRegistryBootstrap(page);
    const hrefs = await sidebarHrefs(page);
    expect(hrefs).toContain('/settings/subscription');
    expect(hrefs).toContain('/queue');
  });

  test('receptionist sidebar is reduced and registry bootstrap succeeds', async ({ page }) => {
    const bootstrap = captureRegistryBootstrap(page);
    await login(page, DEMO_RECEPTIONIST);
    const response = await bootstrap;
    expect(response?.ok(), 'registry bootstrap should succeed for receptionist').toBeTruthy();

    const hrefs = await sidebarHrefs(page);
    expect(hrefs).toContain('/queue');
    expect(hrefs).toContain('/patients');
    expect(hrefs).not.toContain('/analytics');
    expect(hrefs).not.toContain('/my-appointments');
  });

  test('doctor sidebar uses registry bootstrap', async ({ page }) => {
    const bootstrap = captureRegistryBootstrap(page);
    await login(page, DEMO_DOCTOR);
    const response = await bootstrap;
    expect(response?.ok(), 'registry bootstrap should succeed for doctor').toBeTruthy();
    const hrefs = await sidebarHrefs(page);
    expect(hrefs).toContain('/encounters');
    expect(hrefs).not.toContain('/settings/subscription');
  });

  test('patient portal path is role-gated in sidebar', async ({ page }) => {
    await login(page, DEMO_RECEPTIONIST);
    await waitForRegistryBootstrap(page);
    const hrefs = await sidebarHrefs(page);
    expect(hrefs).not.toContain('/my-appointments');
  });

  test('logout and login as another tenant refetches registry bootstrap', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await waitForRegistryBootstrap(page);

    await logout(page);

    const bootstrap = captureRegistryBootstrap(page);
    await login(page, {
      email: LICENSING_E2E_TENANTS.licensed.email,
      password: LICENSING_E2E_TENANTS.licensed.password,
      tenantId: LICENSING_E2E_TENANTS.licensed.tenantId,
    });
    const response = await bootstrap;
    expect(response?.ok()).toBeTruthy();

    const cacheRaw = await page.evaluate(() => sessionStorage.getItem('booking.moduleRegistry.bootstrap'));
    expect(cacheRaw).toBeTruthy();
    expect(cacheRaw).toContain(LICENSING_E2E_TENANTS.licensed.tenantId);
    expect(cacheRaw).not.toContain(DEMO_TENANT_ID);
  });

  test('role change via re-login refetches bootstrap for new role', async ({ page }) => {
    await login(page, DEMO_OWNER);
    await waitForRegistryBootstrap(page);
    let hrefs = await sidebarHrefs(page);
    expect(hrefs).toContain('/analytics');

    await logout(page);

    const bootstrap = captureRegistryBootstrap(page);
    await login(page, DEMO_RECEPTIONIST);
    await bootstrap;
    hrefs = await sidebarHrefs(page);
    expect(hrefs).not.toContain('/analytics');
    expect(hrefs).toContain('/queue');
  });

  test('registry unavailable falls back to static sidebar', async ({ page }) => {
    await page.route('**/tenant/modules/registry/bootstrap', (route) => route.abort('failed'));
    await login(page, DEMO_OWNER);

    const hrefs = await sidebarHrefs(page);
    expect(hrefs.length).toBeGreaterThan(3);
    expect(hrefs).toContain('/');
    expect(hrefs).toContain('/patients');
  });

  test('Arabic RTL preserves sidebar navigation', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('booking.locale', 'ar-SY');
    });
    await login(page, DEMO_OWNER);
    await waitForRegistryBootstrap(page);

    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('rtl');
    await expect(sidebar(page)).toBeVisible();
    const hrefs = await sidebarHrefs(page);
    expect(hrefs).toContain('/');
  });
});

test.describe('Dynamic navigation — bootstrap API', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('bootstrap returns entitlementVersion and role-filtered modules', async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      headers: { 'x-tenant-id': DEMO_TENANT_ID },
      data: {
        email: DEMO_RECEPTIONIST.email,
        password: DEMO_RECEPTIONIST.password,
        tenantId: DEMO_TENANT_ID,
        deviceName: 'playwright-nav-bootstrap',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = (await loginRes.json()) as { accessToken: string };

    const bootstrapRes = await request.get(`${API_BASE}/tenant/modules/registry/bootstrap`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': DEMO_TENANT_ID,
      },
    });
    expect(bootstrapRes.ok()).toBeTruthy();
    const body = (await bootstrapRes.json()) as {
      snapshot: { entitlementVersion: string; catalogGeneration: number };
      modules: Array<{ moduleId: string; extensions: Array<{ kind: string; payload: { path?: string } }> }>;
    };
    expect(body.snapshot.entitlementVersion).toBeTruthy();
    expect(body.snapshot.catalogGeneration).toBeGreaterThan(0);

    const sidebarPaths = body.modules.flatMap((mod) =>
      mod.extensions
        .filter((ext) => ext.kind === 'navigation' && ext.payload.path && ext.userVisible)
        .map((ext) => ext.payload.path as string),
    );
    expect(sidebarPaths).not.toContain('/analytics');
    expect(sidebarPaths).not.toContain('/settings');
  });
});
