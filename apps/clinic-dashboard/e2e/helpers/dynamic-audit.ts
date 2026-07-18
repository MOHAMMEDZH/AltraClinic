import { expect, type Page } from '@playwright/test';
import type { LoginCredentials } from './auth';

export const AUDIT_ROLLBACK_BASE =
  process.env.PLAYWRIGHT_AUDIT_ROLLBACK_URL ?? 'http://127.0.0.1:5181';

export type AuditRuntimeProbe = {
  source: string;
  isRegistrySource: boolean;
  auditSnapshotVersion: string;
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
  surfaceCount: number;
  policyCount: number;
  canViewAuditCenter: boolean;
  canViewSecurityAudit: boolean;
  canViewClinicalAudit: boolean;
  canViewFinancialAudit: boolean;
  canViewCrossBranchAudit: boolean;
  canSearchAudit: boolean;
  canExportAudit: boolean;
  canVerifyAuditIntegrity: boolean;
  canManageRetentionPolicies: boolean;
  canPlaceLegalHold: boolean;
  canViewSensitiveAuditDetails: boolean;
  feedIds: string[];
};

export async function readAuditRuntimeProbe(page: Page): Promise<AuditRuntimeProbe | null> {
  return page.evaluate(() => {
    const probe = (
      window as Window & { __BOOKING_AUDIT_RUNTIME__?: AuditRuntimeProbe }
    ).__BOOKING_AUDIT_RUNTIME__;
    return probe ?? null;
  });
}

export async function waitForAuditRuntimeProbe(
  page: Page,
  options: { timeout?: number; tenantId?: string; requireRegistry?: boolean } = {},
): Promise<AuditRuntimeProbe> {
  const timeout = options.timeout ?? 30_000;
  await page.waitForFunction(
    ({ expectedTenantId, requireRegistry }) => {
      const probe = (window as Window & { __BOOKING_AUDIT_RUNTIME__?: AuditRuntimeProbe })
        .__BOOKING_AUDIT_RUNTIME__;
      if (!probe?.auditSnapshotVersion) return false;
      if (expectedTenantId && probe.tenantId !== expectedTenantId) return false;
      if (requireRegistry && !probe.isRegistrySource) return false;
      return true;
    },
    { expectedTenantId: options.tenantId ?? null, requireRegistry: options.requireRegistry ?? false },
    { timeout },
  );
  const probe = await readAuditRuntimeProbe(page);
  expect(probe, 'audit runtime probe should be published').toBeTruthy();
  return probe!;
}

export async function invokeAuditRefresh(page: Page): Promise<{ ok: boolean; error?: string }> {
  return page.evaluate(async () => {
    const api = (
      window as Window & {
        __BOOKING_AUDIT_ACTIONS__?: { refresh: () => Promise<void> };
      }
    ).__BOOKING_AUDIT_ACTIONS__;
    if (!api?.refresh) {
      return { ok: false, error: 'AUDIT_ACTIONS_MISSING' };
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

export function countAuditExtensionsFromBootstrap(body: {
  modules: Array<{ extensions: Array<{ kind: string }> }>;
}): number {
  return body.modules.flatMap((mod) => mod.extensions.filter((ext) => ext.kind === 'audit')).length;
}

export function accessibleAuditFeedIdsFromBootstrap(body: {
  modules: Array<{
    userAccessible: boolean;
    userVisible: boolean;
    extensions: Array<{
      kind: string;
      userVisible?: boolean;
      userAccessible?: boolean;
      payload?: {
        auditKind?: string;
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
      if (ext.kind !== 'audit') continue;
      if (ext.payload?.auditKind !== 'feed') continue;
      const feedId = ext.payload.feedId;
      if (!feedId) continue;
      if (!isExtensionAccessible(mod, ext)) continue;
      ids.add(feedId);
    }
  }
  return [...ids].sort();
}

export function accessibleAuditTypeIdsFromBootstrap(body: {
  modules: Array<{
    userAccessible: boolean;
    userVisible: boolean;
    extensions: Array<{
      kind: string;
      userVisible?: boolean;
      userAccessible?: boolean;
      payload?: {
        auditKind?: string;
        auditEventTypeId?: string;
        userAccessible?: boolean;
      };
    }>;
  }>;
}): string[] {
  const ids = new Set<string>();
  for (const mod of body.modules) {
    if (!mod.userVisible) continue;
    for (const ext of mod.extensions) {
      if (ext.kind !== 'audit') continue;
      if (ext.payload?.auditKind !== 'type') continue;
      const typeId = ext.payload.auditEventTypeId;
      if (!typeId) continue;
      if (!isExtensionAccessible(mod, ext)) continue;
      ids.add(typeId);
    }
  }
  return [...ids].sort();
}

export async function gotoDashboardForAudit(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });
}

export async function gotoAuditSettings(page: Page) {
  await page.goto('/settings/audit', { waitUntil: 'domcontentloaded' });
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });
}

export async function loginOnAuditRollbackBase(
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

export async function isAuditRollbackServerUp(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(AUDIT_ROLLBACK_BASE, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

export function assertNoAuditRecordsInBrowserStorage(rawSession: string | null, rawLocal: string | null) {
  const combined = `${rawSession ?? ''}\n${rawLocal ?? ''}`;
  expect(combined.includes('integrityHash')).toBe(false);
  expect(combined.includes('"actorId"')).toBe(false);
  expect(combined.includes('audit_entries')).toBe(false);
}
