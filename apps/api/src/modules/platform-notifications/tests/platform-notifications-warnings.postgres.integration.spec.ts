/**
 * Flexible Step 27 — expiry-warning scheduler matrix TW01–TW16.
 * `PlatformNotificationWarningScheduler.runDueScan` scans add-on assignments (via their owning
 * commercial config's `commercialEnd`) and APPROVED overrides (via `expiresAt`), classifying each
 * into d7/d1/expired windows. Dispatch itself is decoupled — tests drive the matching adapter
 * from the scan's eligibility rows to prove an end-to-end warning email.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createPlatformNotificationsStack, type PlatformNotificationsStack } from './platform-notifications-stack';
import { PlatformNotificationWarningScheduler } from '../application/schedulers/platform-notification-warning.scheduler';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupPlatformNotificationsTables,
  clearPlatformNotificationFailureInjection,
  createAddOnAssignmentFixture,
  createAddOnVersionFixture,
  createClinicTenantFixture,
  createCommercialConfigFixture,
  createOverrideFixture,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  ensureSentinel,
  platformDbSecurityEnabled,
  setPlatformNotificationFailureInjection,
} from './platform-notifications-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;
const DAY_MS = 24 * 60 * 60 * 1000;

describeDb('Step 27 warning scheduler matrix TW01-TW16 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let stack: PlatformNotificationsStack;
  let platformUserId: string;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    await ensureSentinel(prisma);
  });

  afterAll(async () => {
    await cleanupPlatformNotificationsTables(prisma);
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    clearPlatformNotificationFailureInjection();
    process.env.NODE_ENV = 'test';
    await cleanupPlatformNotificationsTables(prisma);
    stack = createPlatformNotificationsStack(prisma);
    const user = await createPlatformUserFixture(prisma, { email: `tw-${randomUUID()}@test.local` });
    platformUserId = user.id;
  });

  async function addOnAt(commercialEnd: Date | null, opts: { lifecycle?: 'DRAFT' | 'ACTIVE_COMMERCIAL' | 'CANCELLED' } = {}) {
    const { platformTenant } = await createClinicTenantFixture(prisma);
    const config = await createCommercialConfigFixture(prisma, {
      platformTenantId: platformTenant.id,
      createdByPlatformUserId: platformUserId,
      commercialEnd,
      lifecycle: opts.lifecycle,
    });
    const version = await createAddOnVersionFixture(prisma);
    return createAddOnAssignmentFixture(prisma, { configId: config.id, addOnVersionId: version.id });
  }

  it('TW01: no fixtures — scan reports zero scanned and zero eligible', async () => {
    const result = await stack.scheduler.runDueScan(new Date());
    expect(result.scanned).toBe(0);
    expect(result.eligible).toHaveLength(0);
    expect(result.dispatched).toBe(0);
  });

  it('TW02: add-on 6 days from expiry classified d7', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await addOnAt(new Date(now.getTime() + 6 * DAY_MS));
    const result = await stack.scheduler.runDueScan(now);
    expect(result.eligible).toHaveLength(1);
    expect(result.eligible[0]).toMatchObject({ kind: 'addon', windowKey: 'd7' });
  });

  it('TW03: add-on 12 hours from expiry classified d1', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await addOnAt(new Date(now.getTime() + 12 * 60 * 60 * 1000));
    const result = await stack.scheduler.runDueScan(now);
    expect(result.eligible[0]).toMatchObject({ kind: 'addon', windowKey: 'd1' });
  });

  it('TW04: add-on already past expiry classified expired', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await addOnAt(new Date(now.getTime() - DAY_MS));
    const result = await stack.scheduler.runDueScan(now);
    expect(result.eligible[0]).toMatchObject({ kind: 'addon', windowKey: 'expired' });
  });

  it('TW05: add-on 10 days from expiry is out of window (not eligible)', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await addOnAt(new Date(now.getTime() + 10 * DAY_MS));
    const result = await stack.scheduler.runDueScan(now);
    expect(result.scanned).toBe(1);
    expect(result.eligible).toHaveLength(0);
  });

  it('TW06: add-on with no commercialEnd is excluded from scan entirely', async () => {
    await addOnAt(null);
    const result = await stack.scheduler.runDueScan(new Date());
    expect(result.scanned).toBe(0);
    expect(result.eligible).toHaveLength(0);
  });

  async function overrideAt(expiresAt: Date | null, opts: { lifecycle?: 'DRAFT' | 'APPROVED' } = {}) {
    return createOverrideFixture(prisma, {
      createdByPlatformUserId: platformUserId,
      expiresAt,
      lifecycle: opts.lifecycle,
    });
  }

  it('TW07: override 6 days from expiry classified d7', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await overrideAt(new Date(now.getTime() + 6 * DAY_MS));
    const result = await stack.scheduler.runDueScan(now);
    expect(result.eligible[0]).toMatchObject({ kind: 'override', windowKey: 'd7' });
  });

  it('TW08: override 1 hour from expiry classified d1', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await overrideAt(new Date(now.getTime() + 60 * 60 * 1000));
    const result = await stack.scheduler.runDueScan(now);
    expect(result.eligible[0]).toMatchObject({ kind: 'override', windowKey: 'd1' });
  });

  it('TW09: override already expired classified expired', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await overrideAt(new Date(now.getTime() - DAY_MS));
    const result = await stack.scheduler.runDueScan(now);
    expect(result.eligible[0]).toMatchObject({ kind: 'override', windowKey: 'expired' });
  });

  it('TW10: DRAFT (non-APPROVED) override is excluded from scan', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await overrideAt(new Date(now.getTime() + 6 * DAY_MS), { lifecycle: 'DRAFT' });
    const result = await stack.scheduler.runDueScan(now);
    expect(result.scanned).toBe(0);
    expect(result.eligible).toHaveLength(0);
  });

  it('TW11: addon_expiry_source failure injection aborts the scan', async () => {
    setPlatformNotificationFailureInjection('addon_expiry_source');
    await expect(stack.scheduler.runDueScan(new Date())).rejects.toThrow(/add-on expiry/i);
  });

  it('TW12: override_expiry_source failure injection aborts the scan', async () => {
    setPlatformNotificationFailureInjection('override_expiry_source');
    await expect(stack.scheduler.runDueScan(new Date())).rejects.toThrow(/override expiry/i);
  });

  it('TW13: warning_scheduler failure injection aborts before any query', async () => {
    setPlatformNotificationFailureInjection('warning_scheduler');
    await expect(stack.scheduler.runDueScan(new Date())).rejects.toThrow(/warning scheduler/i);
  });

  it('TW14: retry_scheduler failure injection aborts before any query', async () => {
    setPlatformNotificationFailureInjection('retry_scheduler');
    await expect(stack.scheduler.runDueScan(new Date())).rejects.toThrow(/retry scheduler/i);
  });

  it('TW15: classifyWindow boundaries match runDueScan classification exactly', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    expect(PlatformNotificationWarningScheduler.classifyWindow(new Date(now.getTime() - 1), now)).toBe('expired');
    expect(PlatformNotificationWarningScheduler.classifyWindow(new Date(now.getTime() + DAY_MS), now)).toBe('d1');
    expect(PlatformNotificationWarningScheduler.classifyWindow(new Date(now.getTime() + 7 * DAY_MS), now)).toBe('d7');
    expect(PlatformNotificationWarningScheduler.classifyWindow(new Date(now.getTime() + 8 * DAY_MS), now)).toBeNull();
  });

  it('TW16: eligible add-on scan result drives a real end-to-end warning email (dispatch proof)', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await addOnAt(new Date(now.getTime() + 6 * DAY_MS));
    const scan = await stack.scheduler.runDueScan(now);
    expect(scan.eligible).toHaveLength(1);
    const row = scan.eligible[0];
    const email = `tw16-${randomUUID()}@test.local`;
    const result = await stack.adapters.addOnExpiry({
      approaching: true,
      assignmentId: row.id,
      organizationName: row.organizationName ?? 'Acme Clinic',
      addOnLabel: row.label,
      addOnVersionId: randomUUID(),
      expiryDate: row.endsAt,
      windowKey: row.windowKey,
      recipientPlatformUserId: platformUserId,
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(stack.emailService.sent.some((m) => m.to === email)).toBe(true);
  });
});
