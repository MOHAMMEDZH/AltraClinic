import { test, expect } from '@playwright/test';
import { E2E_SKIP_REASON, isE2eApiReady } from './helpers/api-ready';
import { DEMO_OWNER, DEMO_TENANT_ID } from './helpers/demo-credentials';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3000';

test.describe('Phase 28 licensing E2E baseline', () => {
  test('unauthenticated users cannot reach subscription center', async ({ page }) => {
    await page.goto('/settings/subscription');
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('unauthenticated users cannot reach settings branding', async ({ page }) => {
    await page.goto('/settings/branding');
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('unauthenticated users cannot reach identity custom roles API surface', async ({ page }) => {
    await page.goto('/settings/users');
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('unauthenticated users cannot reach developer API settings', async ({ page }) => {
    await page.goto('/settings/developer');
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('unauthenticated users cannot reach audit logs', async ({ page }) => {
    await page.goto('/settings/audit');
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('unauthenticated users cannot reach AI assistant', async ({ page }) => {
    await page.goto('/ai');
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('login page loads for licensed tenant flow entry', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page).toHaveURL(/auth\/login/);
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Licensing fail-closed UI (offline entitlements)', () => {
  test('subscription route requires auth before entitlements check', async ({ page }) => {
    await page.route('**/tenant/subscription/entitlements', (route) =>
      route.fulfill({ status: 503, body: JSON.stringify({ message: 'unavailable' }) }),
    );
    await page.goto('/settings/subscription');
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('dashboard route requires auth when entitlements unavailable', async ({ page }) => {
    await page.route('**/tenant/subscription/entitlements', (route) =>
      route.fulfill({ status: 503, body: JSON.stringify({ message: 'unavailable' }) }),
    );
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('scheduling route requires auth before module access', async ({ page }) => {
    await page.goto('/scheduling');
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('billing route requires auth before module access', async ({ page }) => {
    await page.goto('/billing');
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('analytics route requires auth before module access', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page).toHaveURL(/auth\/login/);
  });

  test('workflow route requires auth before module access', async ({ page }) => {
    await page.goto('/workflow');
    await expect(page).toHaveURL(/auth\/login/);
  });
});

test.describe('Licensing route protection (unauthenticated = denied)', () => {
  const protectedRoutes = [
    { path: '/settings/subscription', label: 'subscription center' },
    { path: '/settings/branding', label: 'custom branding' },
    { path: '/settings/developer', label: 'developer API' },
    { path: '/settings/audit', label: 'audit logs' },
    { path: '/settings/users', label: 'custom roles' },
    { path: '/ai', label: 'AI assistant' },
    { path: '/reports', label: 'reports' },
  ];

  for (const route of protectedRoutes) {
    test(`${route.label} (${route.path}) redirects unauthenticated users`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page).toHaveURL(/auth\/login/);
    });
  }
});

test.describe('Licensed tenant API enforcement', () => {
  test.beforeEach(({ }, testInfo) => {
    if (!isE2eApiReady()) {
      testInfo.skip(true, E2E_SKIP_REASON);
    }
  });

  async function ownerToken(request: import('@playwright/test').APIRequestContext) {
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      headers: { 'x-tenant-id': DEMO_TENANT_ID },
      data: {
        email: DEMO_OWNER.email,
        password: DEMO_OWNER.password,
        tenantId: DEMO_TENANT_ID,
        deviceName: 'playwright-licensing',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    return (await loginRes.json()) as { accessToken: string };
  }

  test('licensed tenant can load entitlements', async ({ request }) => {
    const { accessToken } = await ownerToken(request);
    const res = await request.get(`${API_BASE}/tenant/subscription/entitlements`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': DEMO_TENANT_ID,
      },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const body = (await res.json()) as { canWrite: boolean; license: { uiPlan: string } };
    expect(body.license.uiPlan).toBeTruthy();
    expect(typeof body.canWrite).toBe('boolean');
  });

  test('white label custom domain denied on professional plan', async ({ request }) => {
    const { accessToken } = await ownerToken(request);
    const res = await request.patch(`${API_BASE}/settings`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': DEMO_TENANT_ID,
      },
      data: { customDomain: 'clinic.example.com' },
    });
    expect(res.status()).toBe(403);
  });

  test('dashboard API requires valid license module', async ({ request }) => {
    const { accessToken } = await ownerToken(request);
    const res = await request.get(`${API_BASE}/dashboard/overview`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-tenant-id': DEMO_TENANT_ID,
      },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
  });
});
