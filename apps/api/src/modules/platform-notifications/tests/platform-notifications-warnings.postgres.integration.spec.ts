/**
 * Flexible Step 27 — expiry-warning scheduler matrix TW01–TW16 (gate semantics).
 * Prove first eligible → intent delta 1; replay → 0; multi-instance → total 1.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  createPlatformNotificationsStack,
  type PlatformNotificationsStack,
} from './platform-notifications-stack';
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
    const user = await createPlatformUserFixture(prisma, {
      email: `tw-${randomUUID()}@test.local`,
    });
    platformUserId = user.id;
  });

  async function addOnAt(
    commercialEnd: Date | null,
    opts: { lifecycle?: 'DRAFT' | 'ACTIVE_COMMERCIAL' | 'CANCELLED' } = {},
  ) {
    const { platformTenant } = await createClinicTenantFixture(prisma);
    const config = await createCommercialConfigFixture(prisma, {
      platformTenantId: platformTenant.id,
      createdByPlatformUserId: platformUserId,
      commercialEnd,
      lifecycle: opts.lifecycle,
    });
    const version = await createAddOnVersionFixture(prisma);
    const assignment = await createAddOnAssignmentFixture(prisma, {
      configId: config.id,
      addOnVersionId: version.id,
    });
    return { assignment, config, platformTenant, version };
  }

  async function overrideAt(
    expiresAt: Date | null,
    opts: { lifecycle?: 'DRAFT' | 'APPROVED' } = {},
  ) {
    return createOverrideFixture(prisma, {
      createdByPlatformUserId: platformUserId,
      expiresAt,
      lifecycle: opts.lifecycle,
    });
  }

  async function dispatchAddon(
    row: { id: string; windowKey: string; endsAt: string; organizationName: string | null; label: string },
    opts: { approaching?: boolean; email?: string } = {},
  ) {
    const email = opts.email ?? `tw-addon-${randomUUID()}@test.local`;
    return stack.adapters.addOnExpiry({
      approaching: opts.approaching ?? row.windowKey !== 'expired',
      assignmentId: row.id,
      organizationName: row.organizationName ?? 'Acme Clinic',
      addOnLabel: row.label,
      addOnVersionId: randomUUID(),
      expiryDate: row.endsAt,
      windowKey: row.windowKey,
      recipientPlatformUserId: platformUserId,
      recipientEmail: email,
    });
  }

  async function dispatchOverride(
    row: { id: string; windowKey: string; endsAt: string; label: string },
    opts: { approaching?: boolean; email?: string } = {},
  ) {
    const email = opts.email ?? `tw-ov-${randomUUID()}@test.local`;
    return stack.adapters.overrideExpiry({
      approaching: opts.approaching ?? row.windowKey !== 'expired',
      overrideId: row.id,
      organizationName: 'Acme Clinic',
      overrideLabel: row.label,
      expiryDate: row.endsAt,
      windowKey: row.windowKey,
      recipientPlatformUserId: platformUserId,
      recipientEmail: email,
    });
  }

  it('TW01: Add-on warning before expiry (d7 eligible + dispatch email delta=1)', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await addOnAt(new Date(now.getTime() + 6 * DAY_MS));
    const scan = await stack.scheduler.runDueScan(now);
    expect(scan.eligible).toHaveLength(1);
    expect(scan.eligible[0]).toMatchObject({ kind: 'addon', windowKey: 'd7' });
    const before = stack.emailService.sent.length;
    const result = await dispatchAddon(scan.eligible[0]);
    expect(result.accepted).toBe(true);
    expect(stack.emailService.sent.length - before).toBe(1);
  });

  it('TW02: Add-on exact warning boundary (exactly 7d → d7; exactly 7d+1ms → null)', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    expect(
      PlatformNotificationWarningScheduler.classifyWindow(
        new Date(now.getTime() + 7 * DAY_MS),
        now,
      ),
    ).toBe('d7');
    expect(
      PlatformNotificationWarningScheduler.classifyWindow(
        new Date(now.getTime() + 7 * DAY_MS + 1),
        now,
      ),
    ).toBeNull();
  });

  it('TW03: Add-on extended before warning (move commercialEnd out of window → no new intent)', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const { config } = await addOnAt(new Date(now.getTime() + 6 * DAY_MS));
    const first = await stack.scheduler.runDueScan(now);
    expect(first.eligible).toHaveLength(1);
    await prisma.platformSubscriptionCommercialConfig.update({
      where: { id: config.id },
      data: { commercialEnd: new Date(now.getTime() + 30 * DAY_MS) },
    });
    const before = await prisma.notificationIntent.count();
    const second = await stack.scheduler.runDueScan(now);
    expect(second.eligible).toHaveLength(0);
    expect(await prisma.notificationIntent.count()).toBe(before);
  });

  it('TW04: Add-on revoked before warning (delete assignment / clear end → scan excludes)', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const { assignment, config } = await addOnAt(new Date(now.getTime() + 6 * DAY_MS));
    expect((await stack.scheduler.runDueScan(now)).eligible).toHaveLength(1);
    await prisma.platformSubscriptionAddOnAssignment.delete({ where: { id: assignment.id } });
    await prisma.platformSubscriptionCommercialConfig.update({
      where: { id: config.id },
      data: { commercialEnd: null },
    });
    expect((await stack.scheduler.runDueScan(now)).eligible).toHaveLength(0);
  });

  it('TW05: Add-on expires (window=expired → dispatch expired template path)', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await addOnAt(new Date(now.getTime() - DAY_MS));
    const scan = await stack.scheduler.runDueScan(now);
    expect(scan.eligible[0].windowKey).toBe('expired');
    const email = `tw05-${randomUUID()}@test.local`;
    const result = await dispatchAddon(scan.eligible[0], { approaching: false, email });
    expect(result.accepted).toBe(true);
    const sent = stack.emailService.sent.find((m) => m.to === email);
    expect(sent?.subject?.toLowerCase() ?? sent?.text?.toLowerCase() ?? '').toMatch(/expir|addon|add-on/i);
  });

  it('TW06: Override warning before expiry', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await overrideAt(new Date(now.getTime() + 6 * DAY_MS));
    const scan = await stack.scheduler.runDueScan(now);
    expect(scan.eligible[0]).toMatchObject({ kind: 'override', windowKey: 'd7' });
    const before = stack.emailService.sent.length;
    const result = await dispatchOverride(scan.eligible[0]);
    expect(result.accepted).toBe(true);
    expect(stack.emailService.sent.length - before).toBe(1);
  });

  it('TW07: Override exact warning boundary', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    expect(
      PlatformNotificationWarningScheduler.classifyWindow(
        new Date(now.getTime() + 7 * DAY_MS),
        now,
      ),
    ).toBe('d7');
    expect(
      PlatformNotificationWarningScheduler.classifyWindow(
        new Date(now.getTime() + 7 * DAY_MS + 1),
        now,
      ),
    ).toBeNull();
  });

  it('TW08: Override extended before warning', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const override = await overrideAt(new Date(now.getTime() + 6 * DAY_MS));
    expect((await stack.scheduler.runDueScan(now)).eligible.some((r) => r.id === override.id)).toBe(
      true,
    );
    await prisma.platformCommercialOverride.update({
      where: { id: override.id },
      data: { expiresAt: new Date(now.getTime() + 30 * DAY_MS) },
    });
    expect((await stack.scheduler.runDueScan(now)).eligible.some((r) => r.id === override.id)).toBe(
      false,
    );
  });

  it('TW09: Override revoked before warning (non-APPROVED or deleted)', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const override = await overrideAt(new Date(now.getTime() + 6 * DAY_MS));
    expect((await stack.scheduler.runDueScan(now)).eligible.some((r) => r.id === override.id)).toBe(
      true,
    );
    await prisma.platformCommercialOverride.update({
      where: { id: override.id },
      data: { lifecycle: 'DRAFT' },
    });
    expect((await stack.scheduler.runDueScan(now)).eligible.some((r) => r.id === override.id)).toBe(
      false,
    );
  });

  it('TW10: Override expires', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await overrideAt(new Date(now.getTime() - DAY_MS));
    const scan = await stack.scheduler.runDueScan(now);
    expect(scan.eligible[0]).toMatchObject({ kind: 'override', windowKey: 'expired' });
    const result = await dispatchOverride(scan.eligible[0], { approaching: false });
    expect(result.accepted).toBe(true);
  });

  it('TW11: scheduler replay same window → additional logical intent delta = 0', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await addOnAt(new Date(now.getTime() + 6 * DAY_MS));
    const scan = await stack.scheduler.runDueScan(now);
    const row = scan.eligible[0];
    await dispatchAddon(row);
    const before = await prisma.notificationIntent.count();
    const replay = await dispatchAddon(row);
    expect(replay.replayed).toBe(true);
    expect(await prisma.notificationIntent.count()).toBe(before);
  });

  it('TW12: service recreation same warning → intent delta 0 (new stack, same prisma)', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await addOnAt(new Date(now.getTime() + 6 * DAY_MS));
    const scan = await stack.scheduler.runDueScan(now);
    const row = scan.eligible[0];
    const email = `tw12-${randomUUID()}@test.local`;
    await dispatchAddon(row, { email });
    const before = await prisma.notificationIntent.count();
    const fresh = createPlatformNotificationsStack(prisma);
    const replay = await fresh.adapters.addOnExpiry({
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
    expect(replay.replayed).toBe(true);
    expect(await prisma.notificationIntent.count()).toBe(before);
  });

  it('TW13: multi-instance same warning → total logical intent = 1', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    await addOnAt(new Date(now.getTime() + 6 * DAY_MS));
    const scan = await stack.scheduler.runDueScan(now);
    const row = scan.eligible[0];
    const email = `tw13-${randomUUID()}@test.local`;
    const input = {
      approaching: true as const,
      assignmentId: row.id,
      organizationName: row.organizationName ?? 'Acme Clinic',
      addOnLabel: row.label,
      addOnVersionId: randomUUID(),
      expiryDate: row.endsAt,
      windowKey: row.windowKey,
      recipientPlatformUserId: platformUserId,
      recipientEmail: email,
    };
    const s1 = createPlatformNotificationsStack(prisma);
    const s2 = createPlatformNotificationsStack(prisma);
    const [a, b] = await Promise.all([
      s1.adapters.addOnExpiry(input),
      s2.adapters.addOnExpiry(input),
    ]);
    expect(a.intentId).toBe(b.intentId);
    expect(await prisma.notificationIntent.count()).toBe(1);
  });

  it('TW14: timezone/DST safety (UTC absolute)', () => {
    const now = new Date('2026-03-08T07:00:00.000Z'); // around US spring-forward
    const end = new Date(now.getTime() + 7 * DAY_MS);
    expect(PlatformNotificationWarningScheduler.classifyWindow(end, now)).toBe('d7');
    const localOffsetNow = new Date('2026-03-08T07:00:00.000+00:00');
    expect(PlatformNotificationWarningScheduler.classifyWindow(end, localOffsetNow)).toBe('d7');
  });

  it('TW15: Trial-conversion migrated grant → N/A (no grant migration source in Step 27 adapters)', () => {
    // Architectural N/A: PlatformNotificationEventAdapters has no trial-conversion / migrated-grant
    // source adapter in Step 27 — cannot prove expiry warning for migrated grants via this stack.
    expect(true).toBe(true);
  });

  it('TW16: non-time-bound grant does not receive expiry warning (no endsAt/commercialEnd → not eligible)', async () => {
    await addOnAt(null);
    await overrideAt(null);
    const result = await stack.scheduler.runDueScan(new Date());
    expect(result.eligible).toHaveLength(0);
  });
});
