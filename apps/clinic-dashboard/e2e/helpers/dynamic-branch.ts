import { expect, type Page } from '@playwright/test';
import type { LoginCredentials } from './auth';

export const BRANCH_ROLLBACK_BASE =
  process.env.PLAYWRIGHT_BRANCH_ROLLBACK_URL ?? 'http://127.0.0.1:5179';

export const ACTIVE_BRANCH_SESSION_KEY = 'booking.branch.activeBranchId';

export type BranchRuntimeProbe = {
  activeBranchId: string | null;
  branchSnapshotVersion: string | null;
  tenantId: string | null;
  accessibleBranchIds: string[];
  event: string | null;
  publicationGeneration: number;
  consumerVersions: Partial<
    Record<
      | 'whiteLabel'
      | 'navigation'
      | 'routing'
      | 'dashboard'
      | 'search'
      | 'reporting'
      | 'analytics'
      | 'activity'
      | 'audit'
      | 'journey'
      | 'notification',
      string | null
    >
  >;
};

export async function readBranchRuntimeProbe(page: Page): Promise<BranchRuntimeProbe | null> {
  return page.evaluate(() => {
    const probe = (
      window as Window & { __BOOKING_BRANCH_RUNTIME__?: BranchRuntimeProbe }
    ).__BOOKING_BRANCH_RUNTIME__;
    return probe ?? null;
  });
}

export async function waitForBranchRuntimeProbe(
  page: Page,
  options: { timeout?: number; tenantId?: string } = {},
): Promise<BranchRuntimeProbe> {
  const timeout = options.timeout ?? 30_000;
  await page.waitForFunction(
    (expectedTenantId) => {
      const probe = (window as Window & { __BOOKING_BRANCH_RUNTIME__?: BranchRuntimeProbe })
        .__BOOKING_BRANCH_RUNTIME__;
      if (!probe?.branchSnapshotVersion) return false;
      if (expectedTenantId && probe.tenantId !== expectedTenantId) return false;
      return true;
    },
    options.tenantId ?? null,
    { timeout },
  );
  const probe = await readBranchRuntimeProbe(page);
  expect(probe, 'branch runtime probe should be published').toBeTruthy();
  return probe!;
}

export async function readActiveBranchSession(page: Page): Promise<string | null> {
  return page.evaluate((key) => sessionStorage.getItem(key), ACTIVE_BRANCH_SESSION_KEY);
}

export async function writeActiveBranchSession(page: Page, branchId: string | null): Promise<void> {
  await page.evaluate(
    ({ key, branchId: id }) => {
      if (id == null || id === '') sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, id);
    },
    { key: ACTIVE_BRANCH_SESSION_KEY, branchId },
  );
}

export function dashboardBranchSelect(page: Page) {
  return page.locator('select').filter({ has: page.locator('option[value="all"]') }).first();
}

export async function gotoDashboardHome(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });
}

export async function selectDashboardBranch(page: Page, branchId: string | 'all') {
  const select = dashboardBranchSelect(page);
  await expect(select).toBeVisible({ timeout: 20_000 });
  await select.selectOption(branchId === 'all' ? 'all' : branchId);
  await page.waitForTimeout(300);
}

export function countBranchExtensionsFromBootstrap(body: {
  modules: Array<{ extensions: Array<{ kind: string }> }>;
}): number {
  let count = 0;
  for (const mod of body.modules) {
    for (const ext of mod.extensions) {
      if (ext.kind === 'branch') count += 1;
    }
  }
  return count;
}

export function accessibleBranchSurfaceIdsFromBootstrap(body: {
  modules: Array<{
    userAccessible: boolean;
    userVisible: boolean;
    extensions: Array<{
      kind: string;
      userVisible?: boolean;
      userAccessible?: boolean;
      payload?: { surfaceId?: string; userAccessible?: boolean };
    }>;
  }>;
}): string[] {
  const ids = new Set<string>();
  for (const mod of body.modules) {
    for (const ext of mod.extensions) {
      if (ext.kind !== 'branch') continue;
      if (ext.userVisible === false) continue;
      const accessible =
        typeof ext.userAccessible === 'boolean'
          ? ext.userAccessible
          : typeof ext.payload?.userAccessible === 'boolean'
            ? ext.payload.userAccessible
            : mod.userAccessible && mod.userVisible;
      if (!accessible) continue;
      if (ext.payload?.surfaceId) ids.add(ext.payload.surfaceId);
    }
  }
  return [...ids].sort();
}

export async function assertConsumerVersionsMatchPublished(page: Page) {
  const probe = await waitForBranchRuntimeProbe(page);
  expect(probe.branchSnapshotVersion).toBeTruthy();
  // Allow a short settle for route-mounted consumers to register and observe publish.
  await page.waitForFunction(
    () => {
      const p = (window as Window & { __BOOKING_BRANCH_RUNTIME__?: BranchRuntimeProbe })
        .__BOOKING_BRANCH_RUNTIME__;
      if (!p?.branchSnapshotVersion) return false;
      const mounted = Object.values(p.consumerVersions ?? {}).filter((v) => v != null);
      return mounted.length > 0;
    },
    undefined,
    { timeout: 15_000 },
  );
  const settled = await readBranchRuntimeProbe(page);
  expect(settled?.branchSnapshotVersion).toBeTruthy();
  const mounted = Object.entries(settled!.consumerVersions).filter(([, v]) => v != null);
  expect(mounted.length).toBeGreaterThan(0);
  for (const [, version] of mounted) {
    expect(version).toBe(settled!.branchSnapshotVersion);
  }
  return settled!;
}

export async function loginOnBranchRollbackBase(
  page: Page,
  baseUrl: string,
  credentials: LoginCredentials & { tenantId: string },
) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  const form = page.locator('form').first();
  await form.waitFor({ timeout: 20_000 });
  await form.locator('input[autocomplete="organization"]').fill(credentials.tenantId);
  await form.locator('input[type="email"]').fill(credentials.email);
  await form.locator('input[type="password"]').fill(credentials.password);
  await form.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
}

export async function isBranchRollbackServerUp(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(BRANCH_ROLLBACK_BASE, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

export async function invokeBranchSetActive(
  page: Page,
  branchId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  return page.evaluate(async (id) => {
    const api = (
      window as Window & {
        __BOOKING_BRANCH_ACTIONS__?: {
          setActiveBranchId: (branchId: string | null) => Promise<void>;
        };
      }
    ).__BOOKING_BRANCH_ACTIONS__;
    if (!api?.setActiveBranchId) {
      return { ok: false, error: 'BRANCH_ACTIONS_MISSING' };
    }
    try {
      await api.setActiveBranchId(id);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }, branchId);
}

export async function invokeBranchRefresh(page: Page): Promise<{ ok: boolean; error?: string }> {
  return page.evaluate(async () => {
    const api = (
      window as Window & {
        __BOOKING_BRANCH_ACTIONS__?: {
          refresh: () => Promise<void>;
        };
      }
    ).__BOOKING_BRANCH_ACTIONS__;
    if (!api?.refresh) {
      return { ok: false, error: 'BRANCH_ACTIONS_MISSING' };
    }
    try {
      await api.refresh();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
