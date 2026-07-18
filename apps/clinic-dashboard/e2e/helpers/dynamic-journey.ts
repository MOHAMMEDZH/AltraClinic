import { expect, type Page } from '@playwright/test';
import type { LoginCredentials } from './auth';

export const JOURNEY_ROLLBACK_BASE =
  process.env.PLAYWRIGHT_JOURNEY_ROLLBACK_URL ?? 'http://127.0.0.1:5182';

export const EXPECTED_JOURNEY_CONTRIBUTION_COUNT = 65;

export type JourneyRuntimeProbe = {
  source: string;
  isRegistrySource: boolean;
  journeySnapshotVersion: string;
  providerKey: string;
  tenantId: string;
  userId: string;
  branchId: string | null;
  branchSnapshotVersion: string | null;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  registryStatus: string;
  stageCount: number;
  transitionCount: number;
  surfaceCount: number;
  packCount: number;
  canViewJourney: boolean;
  canViewPatientTimeline: boolean;
  canConfigureJourney: boolean;
  canUseJourneyPacks: boolean;
};

export async function readJourneyRuntimeProbe(page: Page): Promise<JourneyRuntimeProbe | null> {
  return page.evaluate(() => {
    const probe = (
      window as Window & { __BOOKING_JOURNEY_RUNTIME__?: JourneyRuntimeProbe }
    ).__BOOKING_JOURNEY_RUNTIME__;
    return probe ?? null;
  });
}

export async function waitForJourneyRuntimeProbe(
  page: Page,
  options: { timeout?: number; tenantId?: string; requireRegistry?: boolean } = {},
): Promise<JourneyRuntimeProbe> {
  const timeout = options.timeout ?? 30_000;
  await page.waitForFunction(
    ({ expectedTenantId, requireRegistry }) => {
      const probe = (window as Window & { __BOOKING_JOURNEY_RUNTIME__?: JourneyRuntimeProbe })
        .__BOOKING_JOURNEY_RUNTIME__;
      if (!probe?.journeySnapshotVersion) return false;
      if (expectedTenantId && probe.tenantId !== expectedTenantId) return false;
      if (requireRegistry && !probe.isRegistrySource) return false;
      return true;
    },
    { expectedTenantId: options.tenantId ?? null, requireRegistry: options.requireRegistry ?? false },
    { timeout },
  );
  const probe = await readJourneyRuntimeProbe(page);
  expect(probe, 'journey runtime probe should be published').toBeTruthy();
  return probe!;
}

export async function invokeJourneyRefresh(page: Page): Promise<{ ok: boolean; error?: string }> {
  return page.evaluate(async () => {
    const api = (
      window as Window & {
        __BOOKING_JOURNEY_ACTIONS__?: { refresh: () => Promise<void> };
      }
    ).__BOOKING_JOURNEY_ACTIONS__;
    if (!api?.refresh) {
      return { ok: false, error: 'JOURNEY_ACTIONS_MISSING' };
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

export function countJourneyExtensionsFromBootstrap(body: {
  modules: Array<{ extensions: Array<{ kind: string }> }>;
}): number {
  return body.modules.flatMap((mod) => mod.extensions.filter((ext) => ext.kind === 'journey')).length;
}

export function accessibleJourneyStageIdsFromBootstrap(body: {
  modules: Array<{
    userAccessible: boolean;
    userVisible: boolean;
    extensions: Array<{
      kind: string;
      userVisible?: boolean;
      userAccessible?: boolean;
      payload?: {
        journeyKind?: string;
        stageId?: string;
        userAccessible?: boolean;
      };
    }>;
  }>;
}): string[] {
  const ids = new Set<string>();
  for (const mod of body.modules) {
    if (!mod.userVisible) continue;
    for (const ext of mod.extensions) {
      if (ext.kind !== 'journey') continue;
      if (ext.payload?.journeyKind !== 'stage') continue;
      const stageId = ext.payload.stageId;
      if (!stageId) continue;
      if (!isExtensionAccessible(mod, ext)) continue;
      ids.add(stageId);
    }
  }
  return [...ids].sort();
}

export function accessibleJourneySurfaceIdsFromBootstrap(body: {
  modules: Array<{
    userAccessible: boolean;
    userVisible: boolean;
    extensions: Array<{
      kind: string;
      userVisible?: boolean;
      userAccessible?: boolean;
      payload?: {
        journeyKind?: string;
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
      if (ext.kind !== 'journey') continue;
      if (ext.payload?.journeyKind !== 'surface') continue;
      const surfaceId = ext.payload.surfaceId;
      if (!surfaceId) continue;
      if (!isExtensionAccessible(mod, ext)) continue;
      ids.add(surfaceId);
    }
  }
  return [...ids].sort();
}

export function accessibleJourneyPackIdsFromBootstrap(body: {
  modules: Array<{
    userAccessible: boolean;
    userVisible: boolean;
    extensions: Array<{
      kind: string;
      userVisible?: boolean;
      userAccessible?: boolean;
      payload?: {
        journeyKind?: string;
        packId?: string;
        userAccessible?: boolean;
      };
    }>;
  }>;
}): string[] {
  const ids = new Set<string>();
  for (const mod of body.modules) {
    if (!mod.userVisible) continue;
    for (const ext of mod.extensions) {
      if (ext.kind !== 'journey') continue;
      if (ext.payload?.journeyKind !== 'pack') continue;
      const packId = ext.payload.packId;
      if (!packId) continue;
      if (!isExtensionAccessible(mod, ext)) continue;
      ids.add(packId);
    }
  }
  return [...ids].sort();
}

export async function gotoDashboardForJourney(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });
}

export async function gotoPatientsList(page: Page) {
  await page.goto('/patients', { waitUntil: 'domcontentloaded' });
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });
}

export async function gotoAppointmentsForJourney(page: Page) {
  await page.goto('/appointments', { waitUntil: 'domcontentloaded' });
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });
}

export async function gotoQueueForJourney(page: Page) {
  await page.goto('/queue', { waitUntil: 'domcontentloaded' });
  await page.getByText(/Loading/i).waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 30_000 });
}

export async function loginOnJourneyRollbackBase(
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

export async function isJourneyRollbackServerUp(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(JOURNEY_ROLLBACK_BASE, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

/** Journey configuration cache must never hold patient journey records / PHI. */
export function assertNoJourneyRecordsInBrowserStorage(rawSession: string | null, rawLocal: string | null) {
  const combined = `${rawSession ?? ''}\n${rawLocal ?? ''}`;
  expect(combined.includes('journeyInstanceId')).toBe(false);
  expect(combined.includes('"patientId"')).toBe(false);
  expect(combined.includes('journey_instances')).toBe(false);
  expect(combined.includes('transitionHistory')).toBe(false);
}
