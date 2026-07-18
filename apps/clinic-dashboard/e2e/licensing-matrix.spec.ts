import { test, expect, type APIRequestContext } from '@playwright/test';
import { execSync } from 'node:child_process';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { login } from './helpers/auth';
import {
  LICENSING_E2E_TENANTS,
  LIFECYCLE_SCENARIO_KEYS,
  PLAN_SCENARIO_KEYS,
  type LicensingE2eTenant,
} from './helpers/licensing-tenants';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3000';

test.beforeAll(() => {
  if (!isE2eApiReady()) return;
  try {
    execSync('docker exec booking-system-redis-test redis-cli FLUSHDB', { stdio: 'ignore' });
  } catch {
    // Redis flush is best-effort for local E2E rate-limit reset.
  }
});

interface EntitlementsBody {
  canWrite: boolean;
  canMutate: boolean;
  license: {
    status: string;
    uiPlan: string;
    readOnly: boolean;
    features: Record<string, string>;
  };
}

interface ModuleProbe {
  label: string;
  path: string;
  uiPath: string;
}

const MODULE_PROBES: ModuleProbe[] = [
  { label: 'Dashboard', path: '/dashboard/overview', uiPath: '/dashboard' },
  { label: 'Patients', path: '/patients?limit=1', uiPath: '/patients' },
  { label: 'Scheduling', path: '/scheduling/appointments?limit=1', uiPath: '/scheduling' },
  { label: 'Billing', path: '/billing/invoices?limit=1', uiPath: '/billing' },
  { label: 'Reports', path: '/reporting/reports', uiPath: '/reports' },
  { label: 'Workflow', path: '/workflows/overview', uiPath: '/workflow' },
  { label: 'AI', path: '/ai/models', uiPath: '/ai' },
  { label: 'Analytics', path: '/analytics/overview', uiPath: '/analytics' },
  { label: 'Settings', path: '/settings/overview', uiPath: '/settings' },
  { label: 'Identity', path: '/identity/roles/custom', uiPath: '/settings/users' },
  { label: 'Developer API', path: '/settings/developer/api-keys', uiPath: '/settings/developer' },
];

async function loginToken(
  request: APIRequestContext,
  tenant: LicensingE2eTenant,
): Promise<string> {
  const loginRes = await request.post(`${API_BASE}/auth/login`, {
    headers: { 'x-tenant-id': tenant.tenantId },
    data: {
      email: tenant.email,
      password: tenant.password,
      tenantId: tenant.tenantId,
      deviceName: `playwright-lic-${tenant.key}`,
    },
  });
  expect(loginRes.ok(), `${tenant.key} login: ${await loginRes.text()}`).toBeTruthy();
  const body = (await loginRes.json()) as { accessToken: string };
  return body.accessToken;
}

function authHeaders(tenant: LicensingE2eTenant, token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'x-tenant-id': tenant.tenantId,
  };
}

test.describe('Enterprise licensing matrix — lifecycle tenants', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  for (const key of LIFECYCLE_SCENARIO_KEYS) {
    const tenant = LICENSING_E2E_TENANTS[key];

    test(`${key}: entitlements reflect durable license status`, async ({ request }) => {
      const token = await loginToken(request, tenant);
      const res = await request.get(`${API_BASE}/tenant/subscription/entitlements`, {
        headers: authHeaders(tenant, token),
      });
      expect(res.ok(), await res.text()).toBeTruthy();
      const body = (await res.json()) as EntitlementsBody;

      expect(body.license.status).toBe(tenant.expectedStatus);
      expect(body.license.uiPlan).toBe(tenant.expectedUiPlan);
      expect(body.license.readOnly).toBe(tenant.readOnly);
      expect(body.canWrite).toBe(tenant.canWrite);
      expect(body.canMutate).toBe(tenant.canMutate);
    });

    test(`${key}: licensed module API ${tenant.moduleAccess}`, async ({ request }) => {
      const token = await loginToken(request, tenant);
      const res = await request.get(`${API_BASE}/dashboard/overview`, {
        headers: authHeaders(tenant, token),
      });

      if (tenant.moduleAccess === 'allowed') {
        expect(res.ok(), await res.text()).toBeTruthy();
      } else {
        expect(res.status()).toBe(403);
      }
    });

    test(`${key}: mutation blocked when license inactive or read-only`, async ({ request }) => {
      const token = await loginToken(request, tenant);
      const res = await request.patch(`${API_BASE}/settings/tenant`, {
        headers: authHeaders(tenant, token),
        data: { timezone: 'Asia/Damascus' },
      });

      if (tenant.canWrite) {
        expect(res.ok(), await res.text()).toBeTruthy();
      } else {
        expect(res.status()).toBe(403);
      }
    });
  }
});

test.describe('Enterprise licensing matrix — plan tiers', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  for (const key of PLAN_SCENARIO_KEYS) {
    const tenant = LICENSING_E2E_TENANTS[key];

    test(`${key}: plan tier entitlements`, async ({ request }) => {
      const token = await loginToken(request, tenant);
      const res = await request.get(`${API_BASE}/tenant/subscription/entitlements`, {
        headers: authHeaders(tenant, token),
      });
      expect(res.ok(), await res.text()).toBeTruthy();
      const body = (await res.json()) as EntitlementsBody;
      expect(body.license.uiPlan).toBe(tenant.expectedUiPlan);
      expect(body.license.status).toBe('active');
    });
  }

  test('starter: white label custom domain denied', async ({ request }) => {
    const tenant = LICENSING_E2E_TENANTS.starter;
    const token = await loginToken(request, tenant);
    const res = await request.patch(`${API_BASE}/settings/tenant`, {
      headers: authHeaders(tenant, token),
      data: { customDomain: 'starter.example.com' },
    });
    expect(res.status()).toBe(403);
  });

  test('professional: white label custom domain denied', async ({ request }) => {
    const tenant = LICENSING_E2E_TENANTS.professional;
    const token = await loginToken(request, tenant);
    const res = await request.patch(`${API_BASE}/settings/tenant`, {
      headers: authHeaders(tenant, token),
      data: { customDomain: 'pro.example.com' },
    });
    expect(res.status()).toBe(403);
  });

  test('enterprise: white label custom domain allowed', async ({ request }) => {
    const tenant = LICENSING_E2E_TENANTS.enterprise;
    const token = await loginToken(request, tenant);
    const res = await request.patch(`${API_BASE}/settings/tenant`, {
      headers: authHeaders(tenant, token),
      data: { customDomain: 'enterprise.example.com' },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
  });

  test('enterprise: organization knowledge feature enabled', async ({ request }) => {
    const tenant = LICENSING_E2E_TENANTS.enterprise;
    const token = await loginToken(request, tenant);
    const res = await request.get(`${API_BASE}/tenant/subscription/entitlements`, {
      headers: authHeaders(tenant, token),
    });
    const body = (await res.json()) as EntitlementsBody;
    expect(body.license.features.organizationKnowledge).toBe('enabled');
  });

  test('starter: organization knowledge feature disabled', async ({ request }) => {
    const tenant = LICENSING_E2E_TENANTS.starter;
    const token = await loginToken(request, tenant);
    const res = await request.get(`${API_BASE}/tenant/subscription/entitlements`, {
      headers: authHeaders(tenant, token),
    });
    const body = (await res.json()) as EntitlementsBody;
    expect(body.license.features.organizationKnowledge).toBe('disabled');
  });
});

test.describe('Enterprise licensing matrix — module surface', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test('enterprise tenant: all core module APIs reachable', async ({ request }) => {
    const tenant = LICENSING_E2E_TENANTS.enterprise;
    const token = await loginToken(request, tenant);

    for (const probe of MODULE_PROBES) {
      const res = await request.get(`${API_BASE}${probe.path}`, {
        headers: authHeaders(tenant, token),
      });
      expect(res.ok(), `${probe.label} ${probe.path}: ${await res.text()}`).toBeTruthy();
    }
  });

  test('expired tenant: all core module APIs rejected', async ({ request }) => {
    const tenant = LICENSING_E2E_TENANTS.expired;
    const token = await loginToken(request, tenant);

    for (const probe of MODULE_PROBES) {
      const res = await request.get(`${API_BASE}${probe.path}`, {
        headers: authHeaders(tenant, token),
      });
      expect(res.status(), `${probe.label} should be denied`).toBe(403);
    }
  });

  test('licensed tenant: subscription center always reachable', async ({ request }) => {
    const tenant = LICENSING_E2E_TENANTS.licensed;
    const token = await loginToken(request, tenant);
    const res = await request.get(`${API_BASE}/tenant/subscription/license`, {
      headers: authHeaders(tenant, token),
    });
    expect(res.ok(), await res.text()).toBeTruthy();
  });
});

test.describe('Enterprise licensing matrix — authenticated UI', () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  test.beforeEach(async ({ page, baseURL }) => {
    await page.context().clearCookies();
    await page.goto(baseURL ?? '/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/login');
    await page.getByRole('heading', { name: /Sign in/i }).waitFor({ timeout: 20_000 });
  });

  test('licensed tenant: dashboard loads after login', async ({ page }) => {
    const tenant = LICENSING_E2E_TENANTS.licensed;
    await login(page, {
      email: tenant.email,
      password: tenant.password,
      tenantId: tenant.tenantId,
    });
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/auth\/login/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('expired tenant: unified license experience instead of dashboard shell', async ({ page }) => {
    const tenant = LICENSING_E2E_TENANTS.expired;
    await login(
      page,
      {
        email: tenant.email,
        password: tenant.password,
        tenantId: tenant.tenantId,
      },
      { requireAppShell: false },
    );
    await page.goto('/');
    await expect(page.getByTestId('enterprise-license-experience')).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('[data-testid="enterprise-license-experience"] h1')).toContainText(
      /subscription access required|مطلوب الوصول/i,
    );
  });

  test('expired tenant: subscription center reachable via maintenance layout', async ({ page }) => {
    const tenant = LICENSING_E2E_TENANTS.expired;
    await login(
      page,
      {
        email: tenant.email,
        password: tenant.password,
        tenantId: tenant.tenantId,
      },
      { requireAppShell: false },
    );
    await page.goto('/settings/subscription/plans');
    await expect(page.getByTestId('license-maintenance-layout')).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('#subscription-region')).toBeVisible();
  });

  test('suspended tenant: unified license experience on dashboard', async ({ page }) => {
    const tenant = LICENSING_E2E_TENANTS.suspended;
    await login(
      page,
      {
        email: tenant.email,
        password: tenant.password,
        tenantId: tenant.tenantId,
      },
      { requireAppShell: false },
    );
    await page.goto('/patients');
    await expect(page.getByTestId('enterprise-license-experience')).toBeVisible({ timeout: 45_000 });
  });

  test('grace tenant: unified license experience blocks operational settings', async ({ page, request }) => {
    const tenant = LICENSING_E2E_TENANTS.grace;
    const token = await loginToken(request, tenant);
    const res = await request.patch(`${API_BASE}/settings/tenant`, {
      headers: authHeaders(tenant, token),
      data: { locale: 'en-US' },
    });
    expect(res.status()).toBe(403);

    await login(
      page,
      {
        email: tenant.email,
        password: tenant.password,
        tenantId: tenant.tenantId,
      },
      { requireAppShell: false },
    );
    await page.goto('/settings');
    await expect(page.getByTestId('enterprise-license-experience')).toBeVisible({ timeout: 45_000 });
  });

  test('enterprise tenant: developer API settings reachable', async ({ page }) => {
    const tenant = LICENSING_E2E_TENANTS.enterprise;
    await login(page, {
      email: tenant.email,
      password: tenant.password,
      tenantId: tenant.tenantId,
    });
    await page.goto('/settings/developer');
    await expect(page).not.toHaveURL(/auth\/login/);
  });

  test('starter tenant: custom branding route loads with plan restrictions', async ({ page, request }) => {
    const tenant = LICENSING_E2E_TENANTS.starter;
    const token = await loginToken(request, tenant);
    const entRes = await request.get(`${API_BASE}/tenant/subscription/entitlements`, {
      headers: authHeaders(tenant, token),
    });
    const body = (await entRes.json()) as EntitlementsBody;
    expect(body.license.features.customBranding).toBe('disabled');

    await login(page, {
      email: tenant.email,
      password: tenant.password,
      tenantId: tenant.tenantId,
    });
    await page.goto('/settings/branding');
    await expect(page).not.toHaveURL(/auth\/login/);
  });
});
