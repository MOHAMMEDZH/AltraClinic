import { expect, type Page } from '@playwright/test';
import type { LoginCredentials } from './auth';

export const ACTIVITY_ROLLBACK_BASE =
  process.env.PLAYWRIGHT_ACTIVITY_ROLLBACK_URL ?? 'http://127.0.0.1:5180';

export type ActivityRuntimeProbe = {
  source: string;
  isRegistrySource: boolean;
  activitySnapshotVersion: string;
  providerKey: string;
  tenantId: string;
  userId: string;
  branchId: string | null;
  branchSnapshotVersion: string | null;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  registryStatus: string;
  feedCount: number;
  typeCount: number;
  hubCount: number;
  canViewActivity: boolean;
  canViewClinicalFeed: boolean;
  canViewFinancialFeed: boolean;
  canViewInventoryFeed: boolean;
  canViewSecurityFeed: boolean;
  canViewBranchFeed: boolean;
  canViewMyFeed: boolean;
  feedIds: string[];
};

export async function readActivityRuntimeProbe(page: Page): Promise<ActivityRuntimeProbe | null> {
  return page.evaluate(() => {
    const probe = (
      window as Window & { __BOOKING_ACTIVITY_RUNTIME__?: ActivityRuntimeProbe }
    ).__BOOKING_ACTIVITY_RUNTIME__;
    return probe ?? null;
  });
}

export async function waitForActivityRuntimeProbe(
  page: Page,
  options: { timeout?: number; tenantId?: string; requireRegistry?: boolean } = {},
): Promise<ActivityRuntimeProbe> {
  const timeout = options.timeout ?? 30_000;
  await page.waitForFunction(
    ({ expectedTenantId, requireRegistry }) => {
      const probe = (window as Window & { __BOOKING_ACTIVITY_RUNTIME__?: ActivityRuntimeProbe })
        .__BOOKING_ACTIVITY_RUNTIME__;
      if (!probe?.activitySnapshotVersion) return false;
      if (expectedTenantId && probe.tenantId !== expectedTenantId) return false;
      if (requireRegistry && !probe.isRegistrySource) return false;
      return true;
    },
    { expectedTenantId: options.tenantId ?? null, requireRegistry: options.requireRegistry ?? false },
    { timeout },
  );
  const probe = await readActivityRuntimeProbe(page);
  expect(probe, 'activity runtime probe should be published').toBeTruthy();
  return probe!;
}

export async function invokeActivityRefresh(page: Page): Promise<{ ok: boolean; error?: string }> {
  return page.evaluate(async () => {
    const api = (
      window as Window & {
        __BOOKING_ACTIVITY_ACTIONS__?: { refresh: () => Promise<void> };
      }
    ).__BOOKING_ACTIVITY_ACTIONS__;
    if (!api?.refresh) {
      return { ok: false, error: 'ACTIVITY_ACTIONS_MISSING' };
    }
    try {
      await api.refresh();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

function isExtensionAccessible(
  mod: { userAccessible: boolean; userVisible: boolean },
  ext: { userVisible?: boolean; userAccessible?: boolean; payload?: { userAccessible?: boolean } },
): boolean {
  if (ext.userVisible === false) return false;
  if (typeof ext.userAccessible === 'boolean') return ext.userAccessible;
  if (typeof ext.payload?.userAccessible === 'boolean') return ext.payload.userAccessible;
  return mod.userAccessible && mod.userVisible;
}

export function countActivityExtensionsFromBootstrap(body: {
  modules: Array<{ extensions: Array<{ kind: string }> }>;
}): number {
  return body.modules.flatMap((mod) => mod.extensions.filter((ext) => ext.kind === 'activity')).length;
}

export function accessibleActivityFeedIdsFromBootstrap(body: {
  modules: Array<{
    userAccessible: boolean;
    userVisible: boolean;
    extensions: Array<{
      kind: string;
      userVisible?: boolean;
      userAccessible?: boolean;
      payload?: {
        activityKind?: string;
        feedId?: string;
        userAccessible?: boolean;
      };
    }>;
  }>;
}): string[] {
  const ids = new Set<string>();
  for (const mod of body.modules) {
    if (!mod.userVisible) continue;
    for (const ext of mod.extensions) {
      if (ext.kind !== 'activity') continue;
      if (ext.payload?.activityKind !== 'feed') continue;
      const feedId = ext.payload.feedId;
      if (!feedId) continue;
      if (!isExtensionAccessible(mod, ext)) continue;
      ids.add(feedId);
    }
  }
  return [...ids].sort();
}

export function accessibleActivityTypeIdsFromBootstrap(body: {
  modules: Array<{
    userAccessible: boolean;
    userVisible: boolean;
    extensions: Array<{
      kind: string;
      userVisible?: boolean;
      userAccessible?: boolean;
      payload?: {
        activityKind?: string;
        activityTypeId?: string;
        userAccessible?: boolean;
      };
    }>;
  }>;
}): string[] {
  const ids = new Set<string>();
  for (const mod of body.modules) {
    if (!mod.userVisible) continue;
    for (const ext of mod.extensions) {
      if (ext.kind !== 'activity') continue;
      if (ext.payload?.activityKind !== 'type') continue;
      const typeId = ext.payload.activityTypeId;
      if (!typeId) continue;
      if (!isExtensionAccessible(mod, ext)) continue;
      ids.add(typeId);
    }
  }
  return [...ids].sort();
}

export async function gotoDashboardForActivity(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });
}

export async function loginOnActivityRollbackBase(
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

export async function isActivityRollbackServerUp(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(ACTIVITY_ROLLBACK_BASE, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}
