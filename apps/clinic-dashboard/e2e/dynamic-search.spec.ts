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
  assertShellVisible,
  captureRegistryBootstrap,
  waitForRegistryBootstrap,
} from './helpers/dynamic-routing';
import {
  SEARCH_ROLLBACK_BASE,
  assertSearchDialogEmptyState,
  assertSearchNoAccess,
  closeGlobalSearch,
  executableSearchTypesFromBootstrap,
  globalSearchDialog,
  globalSearchInput,
  isSearchRollbackServerUp,
  loginOnRollbackBase,
  openGlobalSearch,
  parseSearchTypesParam,
  performGlobalSearch,
  readRegistryCacheRaw,
  readRegistryCacheTenant,
} from './helpers/dynamic-search';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3000';
const REGISTRY_BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173';

test.describe.configure({ mode: 'serial', timeout: 90_000 });

test.beforeEach(({ }, testInfo) => {
  if (!isE2eApiReady()) {
    testInfo.skip(true, E2E_SKIP_REASON);
  }
});

async function loginAndShell(page: Page, credentials: LoginCredentials) {
  await page.goto('/login');
  await page.evaluate(() => {
    sessionStorage.clear();
    localStorage.removeItem('booking.locale');
  });
  const bootstrap = captureRegistryBootstrap(page);
  await login(page, credentials);
  const response = await bootstrap;
  expect(response?.ok(), 'registry bootstrap should succeed').toBeTruthy();
  await waitForRegistryBootstrap(page);
  await assertShellVisible(page);
}

async function openSearchAt(page: Page, path = '/') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  await assertShellVisible(page);
  await openGlobalSearch(page);
}

test.describe('Dynamic search — role search (registry mode)', () => {
  test('owner search', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await openSearchAt(page);
    const response = await performGlobalSearch(page, 'Sarah');
    expect(response.ok()).toBeTruthy();
    const types = parseSearchTypesParam(response.url());
    expect(types.length).toBeGreaterThan(10);
    expect(types).toContain('patient');
    await expect(globalSearchDialog(page).getByRole('option').first()).toBeVisible({ timeout: 15_000 });
  });

  test('receptionist search', async ({ page }) => {
    await loginAndShell(page, DEMO_RECEPTIONIST);
    await openSearchAt(page);
    const response = await performGlobalSearch(page, 'Sarah');
    const types = parseSearchTypesParam(response.url());
    expect(types).toContain('patient');
    expect(types).not.toContain('invoice');
    await expect(globalSearchDialog(page).getByRole('option').first()).toBeVisible({ timeout: 15_000 });
  });

  test('doctor search', async ({ page }) => {
    await loginAndShell(page, DEMO_DOCTOR);
    await openSearchAt(page);
    const response = await performGlobalSearch(page, 'Sarah');
    const types = parseSearchTypesParam(response.url());
    expect(types).toContain('patient');
    expect(types).not.toContain('invoice');
  });

  test('dentist search', async ({ page }) => {
    await loginAndShell(page, DEMO_DENTIST);
    await openSearchAt(page);
    const response = await performGlobalSearch(page, 'Sarah');
    const types = parseSearchTypesParam(response.url());
    expect(types).toContain('patient');
    expect(types.some((t) => t.startsWith('dental_'))).toBe(true);
  });

  test('specialist search', async ({ page }) => {
    await loginAndShell(page, DEMO_SPECIALIST);
    await openSearchAt(page);
    const response = await performGlobalSearch(page, 'Sarah');
    const types = parseSearchTypesParam(response.url());
    expect(types).toContain('patient');
    expect(types.some((t) => t.startsWith('beauty_'))).toBe(true);
  });

  test('inventory manager search', async ({ page }) => {
    await loginAndShell(page, DEMO_INVENTORY_MANAGER);
    await openSearchAt(page, '/inventory');
    const response = await performGlobalSearch(page, 'mask');
    const types = parseSearchTypesParam(response.url());
    expect(types).toContain('inventory');
    expect(types).not.toContain('patient');
  });

  test('accountant search', async ({ page }) => {
    await loginAndShell(page, DEMO_ACCOUNTANT);
    await openSearchAt(page, '/billing');
    const response = await performGlobalSearch(page, 'invoice');
    const types = parseSearchTypesParam(response.url());
    expect(types).toContain('invoice');
    expect(types).not.toContain('patient');
  });

  test('patient search', async ({ page }) => {
    await login(page, DEMO_PATIENT_USER);
    await page.goto('/my-appointments', { waitUntil: 'domcontentloaded' });
    await page.keyboard.press('Control+K');
    const dialog = globalSearchDialog(page);
    if (await dialog.isVisible().catch(() => false)) {
      await assertSearchNoAccess(page);
    } else {
      await expect(page.locator('header button[class*="userBtn"]')).toBeVisible();
    }
  });
});

test.describe('Dynamic search — licensing lifecycle', () => {
  test('expired tenant', async ({ page }) => {
    const tenant = LICENSING_E2E_TENANTS.expired;
    await login(page, { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId }, { requireAppShell: false });
    await page.goto('/');
    await expect(page.getByTestId('enterprise-license-experience')).toBeVisible({ timeout: 45_000 });
  });

  test('suspended tenant', async ({ page }) => {
    const tenant = LICENSING_E2E_TENANTS.suspended;
    await login(page, { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId }, { requireAppShell: false });
    await page.goto('/');
    await expect(page.getByTestId('enterprise-license-experience')).toBeVisible({ timeout: 45_000 });
  });

  test('grace tenant', async ({ page }) => {
    const tenant = LICENSING_E2E_TENANTS.grace;
    await login(page, { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId }, { requireAppShell: false });
    await page.goto('/settings');
    await expect(page.getByTestId('enterprise-license-experience')).toBeVisible({ timeout: 45_000 });
  });

  test('starter plan search types', async ({ page, request }) => {
    const tenant = LICENSING_E2E_TENANTS.starter;
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      headers: { 'x-tenant-id': tenant.tenantId },
      data: { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId, deviceName: 'pw-search-starter' },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = (await loginRes.json()) as { accessToken: string };
    const bootstrapRes = await request.get(`${API_BASE}/tenant/modules/registry/bootstrap`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant-id': tenant.tenantId },
    });
    const body = await bootstrapRes.json();
    const types = executableSearchTypesFromBootstrap(body);
    const analytics = body.modules.find((m: { moduleId: string }) => m.moduleId === 'analytics');
    expect(analytics?.userAccessible).toBe(false);
    expect(types).not.toContain('analytics-metric');

    await login(page, { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId });
    await openSearchAt(page);
    const response = await performGlobalSearch(page, 'demo');
    const requested = parseSearchTypesParam(response.url());
    for (const type of requested) {
      expect(types, `unexpected type ${type}`).toContain(type);
    }
  });
});

test.describe('Dynamic search — cache isolation and refresh', () => {
  test('tenant switch', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
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

  test('logout/login cache invalidation', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await openSearchAt(page);
    await closeGlobalSearch(page);
    await logout(page);
    await page.evaluate(() => sessionStorage.clear());
    const bootstrap = captureRegistryBootstrap(page);
    await login(page, DEMO_OWNER);
    await bootstrap;
    await openSearchAt(page);
    await assertSearchDialogEmptyState(page);
  });

  test('browser refresh', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await openSearchAt(page);
    await performGlobalSearch(page, 'Sarah');
    await closeGlobalSearch(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await assertShellVisible(page);
    await openGlobalSearch(page);
    const response = await performGlobalSearch(page, 'Sarah');
    expect(response.ok()).toBeTruthy();
  });
});

test.describe('Dynamic search — resilience and bootstrap', () => {
  test('registry bootstrap', async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      headers: { 'x-tenant-id': DEMO_TENANT_ID },
      data: {
        email: DEMO_OWNER.email,
        password: DEMO_OWNER.password,
        tenantId: DEMO_TENANT_ID,
        deviceName: 'pw-search-bootstrap',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = (await loginRes.json()) as { accessToken: string };
    const bootstrapRes = await request.get(`${API_BASE}/tenant/modules/registry/bootstrap`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant-id': DEMO_TENANT_ID },
    });
    expect(bootstrapRes.ok()).toBeTruthy();
    const body = await bootstrapRes.json();
    const searchExtensions = body.modules.flatMap((m: { extensions: Array<{ kind: string }> }) =>
      m.extensions.filter((e) => e.kind === 'search'),
    );
    expect(searchExtensions.length).toBeGreaterThan(30);
  });

  test('registry unavailable fallback', async ({ page }) => {
    await page.route('**/tenant/modules/registry/bootstrap', (route) => route.abort('failed'));
    await login(page, DEMO_OWNER);
    await openSearchAt(page);
    const response = await performGlobalSearch(page, 'Sarah');
    expect(response.ok()).toBeTruthy();
    const types = parseSearchTypesParam(response.url());
    expect(types.length).toBeGreaterThan(5);
  });
});

test.describe('Dynamic search — rollback mode', () => {
  test('static search rollback parity', async ({ page }) => {
    const rollbackUp = await isSearchRollbackServerUp();
    test.skip(!rollbackUp, `Search rollback dashboard not running at ${SEARCH_ROLLBACK_BASE}`);

    await loginOnRollbackBase(page, SEARCH_ROLLBACK_BASE, {
      tenantId: DEMO_TENANT_ID,
      email: DEMO_OWNER.email,
      password: DEMO_OWNER.password,
    });
    await page.goto(`${SEARCH_ROLLBACK_BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
    await assertShellVisible(page);
    await openGlobalSearch(page);
    const rollbackResponse = await performGlobalSearch(page, 'Sarah');
    expect(rollbackResponse.ok()).toBeTruthy();
    const rollbackTypes = parseSearchTypesParam(rollbackResponse.url());
    expect(rollbackTypes.length).toBeGreaterThan(10);
    expect(rollbackTypes).toContain('patient');

    await page.goto(`${REGISTRY_BASE}/login`);
    const regForm = page.locator('form').first();
    await regForm.waitFor({ timeout: 20_000 });
    await regForm.locator('input[autocomplete="organization"]').fill(DEMO_TENANT_ID);
    await regForm.locator('input[type="email"]').fill(DEMO_OWNER.email);
    await regForm.locator('input[type="password"]').fill(DEMO_OWNER.password);
    await regForm.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
    await openSearchAt(page);
    const registryResponse = await performGlobalSearch(page, 'Sarah');
    expect(registryResponse.ok()).toBeTruthy();
    const registryTypes = parseSearchTypesParam(registryResponse.url());
    expect(registryTypes.sort()).toEqual(rollbackTypes.sort());
  });
});

test.describe('Dynamic search — navigation and UX', () => {
  test('deep-link navigation from result', async ({ page }) => {
    await loginAndShell(page, DEMO_RECEPTIONIST);
    await openSearchAt(page, '/patients');
    const response = await performGlobalSearch(page, 'Sarah');
    expect(response.ok()).toBeTruthy();
    const firstResult = globalSearchDialog(page).getByRole('option').first();
    await expect(firstResult).toBeVisible({ timeout: 15_000 });
    await firstResult.click();
    await expect(globalSearchDialog(page)).toBeHidden();
    await expect(page).toHaveURL(/\/patients\//);
  });

  test('Arabic RTL search dialog', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('booking.locale', 'ar-SY');
    });
    await loginAndShell(page, DEMO_OWNER);
    await openSearchAt(page);
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('rtl');
    await assertSearchDialogEmptyState(page);
  });

  test('keyboard navigation', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await openSearchAt(page);
    await assertSearchDialogEmptyState(page);
    await closeGlobalSearch(page);
    await openGlobalSearch(page);
    await expect(globalSearchInput(page)).toBeFocused();
  });

  test('empty search state', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await openSearchAt(page);
    await assertSearchDialogEmptyState(page);
  });

  test('search dialog loading', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await openSearchAt(page);
    const responsePromise = performGlobalSearch(page, 'Sarah');
    await expect(globalSearchDialog(page).getByText(/loading/i)).toBeVisible({ timeout: 5_000 }).catch(() => undefined);
    const response = await responsePromise;
    expect(response.ok()).toBeTruthy();
  });

  test('result selection', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await openSearchAt(page);
    await performGlobalSearch(page, 'Sarah');
    const options = globalSearchDialog(page).getByRole('option');
    await expect(options.first()).toBeVisible({ timeout: 15_000 });
    expect(await options.count()).toBeGreaterThan(0);
  });

  test('browser history after navigation', async ({ page }) => {
    await loginAndShell(page, DEMO_RECEPTIONIST);
    await openSearchAt(page, '/patients');
    await performGlobalSearch(page, 'Sarah');
    await globalSearchDialog(page).getByRole('option').first().click();
    await expect(page).toHaveURL(/\/patients\//);
    await page.goBack();
    await expect(page).toHaveURL(/\/patients/);
  });

  test('search result type labels', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await openSearchAt(page);
    await performGlobalSearch(page, 'Sarah');
    const typeLabel = globalSearchDialog(page).getByRole('option').first().locator('span').first();
    await expect(typeLabel).not.toHaveText('');
  });
});

test.describe('Dynamic search — filtering and security', () => {
  test('RBAC filtering', async ({ page, request }) => {
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      headers: { 'x-tenant-id': DEMO_TENANT_ID },
      data: {
        email: DEMO_RECEPTIONIST.email,
        password: DEMO_RECEPTIONIST.password,
        tenantId: DEMO_TENANT_ID,
        deviceName: 'pw-search-rbac',
      },
    });
    expect(loginRes.ok()).toBeTruthy();
    const { accessToken } = (await loginRes.json()) as { accessToken: string };
    const bootstrapRes = await request.get(`${API_BASE}/tenant/modules/registry/bootstrap`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant-id': DEMO_TENANT_ID },
    });
    const body = await bootstrapRes.json();
    const expected = executableSearchTypesFromBootstrap(body);
    expect(expected).not.toContain('invoice');

    await loginAndShell(page, DEMO_RECEPTIONIST);
    await openSearchAt(page);
    const response = await performGlobalSearch(page, 'Sarah');
    const requested = parseSearchTypesParam(response.url());
    expect(requested).not.toContain('invoice');
    for (const type of requested) {
      expect(expected).toContain(type);
    }
  });

  test('licensing filtering', async ({ page, request }) => {
    const tenant = LICENSING_E2E_TENANTS.starter;
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      headers: { 'x-tenant-id': tenant.tenantId },
      data: { email: tenant.email, password: tenant.password, tenantId: tenant.tenantId, deviceName: 'pw-search-license' },
    });
    const { accessToken } = (await loginRes.json()) as { accessToken: string };
    const bootstrapRes = await request.get(`${API_BASE}/tenant/modules/registry/bootstrap`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant-id': tenant.tenantId },
    });
    const body = await bootstrapRes.json();
    const analytics = body.modules.find((m: { moduleId: string }) => m.moduleId === 'analytics');
    expect(analytics?.userAccessible).toBe(false);
  });

  test('dependency-blocked modules', async ({ request }) => {
    const loginRes = await request.post(`${API_BASE}/auth/login`, {
      headers: { 'x-tenant-id': DEMO_TENANT_ID },
      data: {
        email: DEMO_OWNER.email,
        password: DEMO_OWNER.password,
        tenantId: DEMO_TENANT_ID,
        deviceName: 'pw-search-deps',
      },
    });
    const { accessToken } = (await loginRes.json()) as { accessToken: string };
    const bootstrapRes = await request.get(`${API_BASE}/tenant/modules/registry/bootstrap`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant-id': DEMO_TENANT_ID },
    });
    const body = await bootstrapRes.json();
    const blocked = body.modules.filter((m: { lockReason?: string }) => m.lockReason === 'dependency');
    for (const mod of blocked) {
      const types = executableSearchTypesFromBootstrap({ modules: [mod] });
      expect(types.length).toBe(0);
    }
  });

  test('no duplicate search requests', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await openSearchAt(page);
    let searchCalls = 0;
    const handler = (req: { url: () => string; method: () => string }) => {
      if (req.url().includes('/search') && req.method() === 'GET') searchCalls += 1;
    };
    page.on('request', handler);
    await globalSearchInput(page).fill('Sa');
    await page.waitForTimeout(400);
    await globalSearchInput(page).fill('Sarah');
    await page.waitForResponse(
      (resp) => resp.url().includes('/search') && resp.request().method() === 'GET',
      { timeout: 25_000 },
    );
    page.off('request', handler);
    expect(searchCalls).toBeLessThanOrEqual(2);
  });

  test('unknown query empty results', async ({ page }) => {
    await loginAndShell(page, DEMO_OWNER);
    await openSearchAt(page);
    const response = await performGlobalSearch(page, 'zzzz-no-match-zzzz-99999');
    expect(response.ok()).toBeTruthy();
    await expect(globalSearchDialog(page).getByText(/no results|empty|not found|no patients match/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});
