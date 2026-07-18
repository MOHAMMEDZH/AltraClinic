import { expect, type Page } from '@playwright/test';
import type { LoginCredentials } from './auth';

export const NOTIFICATION_ROLLBACK_BASE =
  process.env.PLAYWRIGHT_NOTIFICATION_ROLLBACK_URL ?? 'http://127.0.0.1:5183';

export const EXPECTED_NOTIFICATION_CONTRIBUTION_COUNT = 92;

export type NotificationRuntimeProbe = {
  source: string;
  isRegistrySource: boolean;
  notificationSnapshotVersion: string;
  providerKey: string;
  tenantId: string;
  userId: string;
  branchId: string | null;
  branchSnapshotVersion: string | null;
  whiteLabelSnapshotVersion: string | null;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  registryStatus: string;
  channelCount: number;
  typeCount: number;
  surfaceCount: number;
  packCount: number;
  canViewNotificationCenter: boolean;
  canViewCommunicationHistory: boolean;
  canConfigureChannels: boolean;
  canConfigureTemplates: boolean;
};

export async function readNotificationRuntimeProbe(
  page: Page,
): Promise<NotificationRuntimeProbe | null> {
  return page.evaluate(() => {
    const probe = (
      window as Window & { __BOOKING_NOTIFICATION_RUNTIME__?: NotificationRuntimeProbe }
    ).__BOOKING_NOTIFICATION_RUNTIME__;
    return probe ?? null;
  });
}

export async function waitForNotificationRuntimeProbe(
  page: Page,
  options: { timeout?: number; tenantId?: string; requireRegistry?: boolean } = {},
): Promise<NotificationRuntimeProbe> {
  const timeout = options.timeout ?? 30_000;
  await page.waitForFunction(
    ({ expectedTenantId, requireRegistry }) => {
      const probe = (
        window as Window & { __BOOKING_NOTIFICATION_RUNTIME__?: NotificationRuntimeProbe }
      ).__BOOKING_NOTIFICATION_RUNTIME__;
      if (!probe?.notificationSnapshotVersion) return false;
      if (expectedTenantId && probe.tenantId !== expectedTenantId) return false;
      if (requireRegistry && !probe.isRegistrySource) return false;
      return true;
    },
    {
      expectedTenantId: options.tenantId ?? null,
      requireRegistry: options.requireRegistry ?? false,
    },
    { timeout },
  );
  const probe = await readNotificationRuntimeProbe(page);
  expect(probe, 'notification runtime probe should be published').toBeTruthy();
  return probe!;
}

export async function invokeNotificationRefresh(
  page: Page,
): Promise<{ ok: boolean; error?: string }> {
  return page.evaluate(async () => {
    const api = (
      window as Window & {
        __BOOKING_NOTIFICATION_ACTIONS__?: { refresh: () => Promise<void> };
      }
    ).__BOOKING_NOTIFICATION_ACTIONS__;
    if (!api?.refresh) {
      return { ok: false, error: 'NOTIFICATION_ACTIONS_MISSING' };
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

export function countNotificationExtensionsFromBootstrap(body: {
  modules: Array<{ extensions: Array<{ kind: string }> }>;
}): number {
  return body.modules.flatMap((mod) => mod.extensions.filter((ext) => ext.kind === 'notification'))
    .length;
}

export function accessibleNotificationTypeIdsFromBootstrap(body: {
  modules: Array<{
    userAccessible: boolean;
    userVisible: boolean;
    extensions: Array<{
      kind: string;
      userVisible?: boolean;
      userAccessible?: boolean;
      payload?: {
        notificationKind?: string;
        typeId?: string;
        notificationTypeId?: string;
        userAccessible?: boolean;
      };
    }>;
  }>;
}): string[] {
  const ids = new Set<string>();
  for (const mod of body.modules) {
    if (!mod.userVisible) continue;
    for (const ext of mod.extensions) {
      if (ext.kind !== 'notification') continue;
      if (ext.payload?.notificationKind !== 'type') continue;
      const typeId = ext.payload.typeId ?? ext.payload.notificationTypeId;
      if (!typeId) continue;
      if (!isExtensionAccessible(mod, ext)) continue;
      ids.add(typeId);
    }
  }
  return [...ids].sort();
}

export function accessibleNotificationChannelIdsFromBootstrap(body: {
  modules: Array<{
    userAccessible: boolean;
    userVisible: boolean;
    extensions: Array<{
      kind: string;
      userVisible?: boolean;
      userAccessible?: boolean;
      payload?: {
        notificationKind?: string;
        channelId?: string;
        userAccessible?: boolean;
      };
    }>;
  }>;
}): string[] {
  const ids = new Set<string>();
  for (const mod of body.modules) {
    if (!mod.userVisible) continue;
    for (const ext of mod.extensions) {
      if (ext.kind !== 'notification') continue;
      if (ext.payload?.notificationKind !== 'channel') continue;
      const channelId = ext.payload.channelId;
      if (!channelId) continue;
      if (!isExtensionAccessible(mod, ext)) continue;
      ids.add(channelId);
    }
  }
  return [...ids].sort();
}

export function accessibleNotificationSurfaceIdsFromBootstrap(body: {
  modules: Array<{
    userAccessible: boolean;
    userVisible: boolean;
    extensions: Array<{
      kind: string;
      userVisible?: boolean;
      userAccessible?: boolean;
      payload?: {
        notificationKind?: string;
        surfaceId?: string;
        userAccessible?: boolean;
      };
    }>;
  }>;
}): string[] {
  const ids = new Set<string>();
  for (const mod of body.modules) {
    if (!mod.userVisible) continue;
    for (const ext of mod.extensions) {
      if (ext.kind !== 'notification') continue;
      if (ext.payload?.notificationKind !== 'surface') continue;
      const surfaceId = ext.payload.surfaceId;
      if (!surfaceId) continue;
      if (!isExtensionAccessible(mod, ext)) continue;
      ids.add(surfaceId);
    }
  }
  return [...ids].sort();
}

export async function gotoNotificationCenter(page: Page) {
  await page.goto('/settings/notifications', { waitUntil: 'domcontentloaded' });
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });
}

export async function gotoNotificationChannels(page: Page) {
  await page.goto('/settings/notifications/channels', { waitUntil: 'domcontentloaded' });
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });
}

export async function gotoNotificationInbox(page: Page) {
  await page.goto('/settings/notifications/inbox', { waitUntil: 'domcontentloaded' });
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });
}

export async function loginOnNotificationRollbackBase(
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

export async function isNotificationRollbackServerUp(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(NOTIFICATION_ROLLBACK_BASE, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

/** Configuration cache must never hold delivery records / message bodies / PHI. */
export function assertNoNotificationDeliveryInBrowserStorage(
  rawSession: string | null,
  rawLocal: string | null,
) {
  const combined = `${rawSession ?? ''}\n${rawLocal ?? ''}`;
  expect(combined.includes('notificationInstanceId')).toBe(false);
  expect(combined.includes('deliveryPayload')).toBe(false);
  expect(combined.includes('"messageBody"')).toBe(false);
  expect(combined.includes('providerCredential')).toBe(false);
  expect(combined.includes('accessToken')).toBe(false);
}
