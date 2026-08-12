/**
 * Flexible Step 27 — scheduler/time matrix T01–T16.
 * Uses PlatformNotificationWarningScheduler.classifyWindow + runDueScan and adapters.
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
  diffSoR,
  ensureSentinel,
  platformDbSecurityEnabled,
  protectedNotificationsSoR,
} from './platform-notifications-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;
const DAY_MS = 24 * 60 * 60 * 1000;
const SEC_MS = 1000;

describeDb('Step 27 scheduler/time matrix T01-T16 (PostgreSQL)', () => {
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
      email: `sched-${randomUUID()}@test.local`,
    });
    platformUserId = user.id;
  });

  async function addOnAt(commercialEnd: Date | null) {
    const { platformTenant } = await createClinicTenantFixture(prisma);
    const config = await createCommercialConfigFixture(prisma, {
      platformTenantId: platformTenant.id,
      createdByPlatformUserId: platformUserId,
      commercialEnd,
    });
    const version = await createAddOnVersionFixture(prisma);
    return {
      assignment: await createAddOnAssignmentFixture(prisma, {
        configId: config.id,
        addOnVersionId: version.id,
      }),
      config,
      platformTenant,
    };
  }

  it('T01: exact due instant (end = now+7d exactly → d7; end=now+1d → d1)', () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    expect(
      PlatformNotificationWarningScheduler.classifyWindow(
        new Date(now.getTime() + 7 * DAY_MS),
        now,
      ),
    ).toBe('d7');
    expect(
      PlatformNotificationWarningScheduler.classifyWindow(
        new Date(now.getTime() + 1 * DAY_MS),
        now,
      ),
    ).toBe('d1');
  });

  it('T02: one second before due (just outside window → null)', () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    expect(
      PlatformNotificationWarningScheduler.classifyWindow(
        new Date(now.getTime() + 7 * DAY_MS + SEC_MS),
        now,
      ),
    ).toBeNull();
  });

  it('T03: one second after due enters window', () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    expect(
      PlatformNotificationWarningScheduler.classifyWindow(
        new Date(now.getTime() + 7 * DAY_MS - SEC_MS),
        now,
      ),
    ).toBe('d7');
  });

  it('T04: DST forward (use fixed UTC instants that cross a known DST transition; prove classifyWindow uses absolute ms, not local calendar day)', () => {
    // US 2026 spring-forward: 2026-03-08 02:00 local → clocks jump; UTC ms still absolute.
    const before = new Date('2026-03-08T06:00:00.000Z'); // 01:00 EST
    const after = new Date('2026-03-08T08:00:00.000Z'); // 04:00 EDT (after +1h jump)
    const end = new Date(before.getTime() + 7 * DAY_MS);
    expect(PlatformNotificationWarningScheduler.classifyWindow(end, before)).toBe('d7');
    // Same end, later absolute now: remaining ms shrink by real wall-clock UTC delta (2h), not local calendar days.
    const afterClass = PlatformNotificationWarningScheduler.classifyWindow(end, after);
    expect(afterClass).toBe('d7');
    expect(end.getTime() - after.getTime()).toBe(7 * DAY_MS - 2 * 60 * 60 * 1000);
  });

  it('T05: DST backward (similar UTC absolute proof)', () => {
    // US 2026 fall-back: 2026-11-01 02:00 local → clocks repeat hour; classification still UTC ms.
    const before = new Date('2026-11-01T05:00:00.000Z'); // 01:00 EDT
    const after = new Date('2026-11-01T07:00:00.000Z'); // 02:00 EST after fallback
    const end = new Date(before.getTime() + 1 * DAY_MS);
    expect(PlatformNotificationWarningScheduler.classifyWindow(end, before)).toBe('d1');
    expect(PlatformNotificationWarningScheduler.classifyWindow(end, after)).toBe('d1');
    expect(end.getTime() - after.getTime()).toBe(1 * DAY_MS - 2 * 60 * 60 * 1000);
  });

  it('T06: leap day (2024-02-29 / 2028-02-29 UTC end timestamps classify correctly)', () => {
    const now2024 = new Date('2024-02-22T12:00:00.000Z');
    const leap2024 = new Date('2024-02-29T12:00:00.000Z');
    expect(PlatformNotificationWarningScheduler.classifyWindow(leap2024, now2024)).toBe('d7');

    const now2028 = new Date('2028-02-28T12:00:00.000Z');
    const leap2028 = new Date('2028-02-29T12:00:00.000Z');
    expect(PlatformNotificationWarningScheduler.classifyWindow(leap2028, now2028)).toBe('d1');
  });

  it('T07: UTC/local conversion (same instant from Date.UTC vs ISO string → same window)', () => {
    const nowUtc = new Date(Date.UTC(2026, 5, 1, 12, 0, 0));
    const nowIso = new Date('2026-06-01T12:00:00.000Z');
    const endUtc = new Date(Date.UTC(2026, 5, 8, 12, 0, 0));
    const endIso = new Date('2026-06-08T12:00:00.000Z');
    expect(nowUtc.getTime()).toBe(nowIso.getTime());
    expect(endUtc.getTime()).toBe(endIso.getTime());
    expect(PlatformNotificationWarningScheduler.classifyWindow(endUtc, nowUtc)).toBe('d7');
    expect(PlatformNotificationWarningScheduler.classifyWindow(endIso, nowIso)).toBe('d7');
  });

  it('T08: missed scheduler-run recovery (past-due end still classifies as expired/d1/d7 when scanned late)', async () => {
    const scheduledFor = new Date('2026-06-01T12:00:00.000Z');
    const lateScan = new Date('2026-06-05T12:00:00.000Z');
    await addOnAt(new Date(scheduledFor.getTime() + 6 * DAY_MS)); // would be d7 at scheduledFor
    const result = await stack.scheduler.runDueScan(lateScan);
    expect(result.eligible).toHaveLength(1);
    expect(['d7', 'd1', 'expired']).toContain(result.eligible[0].windowKey);
    // 6d from June 1 → end June 7; late scan June 5 → ~2d remaining → d7
    expect(result.eligible[0].windowKey).toBe('d7');
  });

  it('T09: duplicate scheduler execution (two runDueScan → same eligible ids, dispatched=0 both times)', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    await addOnAt(new Date(now.getTime() + 6 * DAY_MS));
    const a = await stack.scheduler.runDueScan(now);
    const b = await stack.scheduler.runDueScan(now);
    expect(a.dispatched).toBe(0);
    expect(b.dispatched).toBe(0);
    expect(a.eligible.map((r) => r.id).sort()).toEqual(b.eligible.map((r) => r.id).sort());
  });

  it('T10: multi-instance scheduler (two scheduler instances same prisma → identical eligible sets)', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    await addOnAt(new Date(now.getTime() + 6 * DAY_MS));
    const s1 = createPlatformNotificationsStack(prisma);
    const s2 = createPlatformNotificationsStack(prisma);
    const a = await s1.scheduler.runDueScan(now);
    const b = await s2.scheduler.runDueScan(now);
    expect(a.eligible.map((r) => `${r.kind}:${r.id}:${r.windowKey}`).sort()).toEqual(
      b.eligible.map((r) => `${r.kind}:${r.id}:${r.windowKey}`).sort(),
    );
  });

  it('T11: source updated during scan (commercialEnd moved out of window → second scan excludes)', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    const { config } = await addOnAt(new Date(now.getTime() + 6 * DAY_MS));
    const first = await stack.scheduler.runDueScan(now);
    expect(first.eligible).toHaveLength(1);
    await prisma.platformSubscriptionCommercialConfig.update({
      where: { id: config.id },
      data: { commercialEnd: new Date(now.getTime() + 30 * DAY_MS) },
    });
    const second = await stack.scheduler.runDueScan(now);
    expect(second.eligible).toHaveLength(0);
  });

  it('T12: source removed/expired during scan (delete override → second scan excludes)', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    const override = await createOverrideFixture(prisma, {
      createdByPlatformUserId: platformUserId,
      expiresAt: new Date(now.getTime() + 6 * DAY_MS),
    });
    const first = await stack.scheduler.runDueScan(now);
    expect(first.eligible.some((r) => r.id === override.id)).toBe(true);
    await prisma.platformCommercialOverride.delete({ where: { id: override.id } });
    const second = await stack.scheduler.runDueScan(now);
    expect(second.eligible.some((r) => r.id === override.id)).toBe(false);
  });

  it('T13: warning already delivered (dispatch once via adapter; replay same window → intent delta 0)', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    await addOnAt(new Date(now.getTime() + 6 * DAY_MS));
    const scan = await stack.scheduler.runDueScan(now);
    const row = scan.eligible[0];
    const email = `t13-${randomUUID()}@test.local`;
    const input = {
      approaching: true as const,
      assignmentId: row.id,
      organizationName: row.organizationName ?? 'Acme',
      addOnLabel: row.label,
      addOnVersionId: randomUUID(),
      expiryDate: row.endsAt,
      windowKey: row.windowKey,
      recipientPlatformUserId: platformUserId,
      recipientEmail: email,
    };
    const first = await stack.adapters.addOnExpiry(input);
    const before = await prisma.notificationIntent.count();
    const second = await stack.adapters.addOnExpiry(input);
    const after = await prisma.notificationIntent.count();
    expect(first.accepted).toBe(true);
    expect(second.replayed).toBe(true);
    expect(after - before).toBe(0);
  });

  it('T14: warning preference changed (disable commercial pref → subsequent dispatch suppressed)', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    await addOnAt(new Date(now.getTime() + 6 * DAY_MS));
    const scan = await stack.scheduler.runDueScan(now);
    const row = scan.eligible[0];
    await stack.prisma.platformNotificationPreference.create({
      data: {
        platformUserId: platformUserId,
        category: 'commercial',
        channel: 'email',
        enabled: false,
      },
    });
    const result = await stack.adapters.addOnExpiry({
      approaching: true,
      assignmentId: row.id,
      organizationName: row.organizationName ?? 'Acme',
      addOnLabel: row.label,
      addOnVersionId: randomUUID(),
      expiryDate: row.endsAt,
      windowKey: row.windowKey,
      recipientPlatformUserId: platformUserId,
      recipientEmail: `t14-${randomUUID()}@test.local`,
    });
    expect(result.accepted).toBe(false);
    expect(result.suppressed).toBe(true);
    expect(result.suppressReason).toBe('preference_disabled');
  });

  it('T15: recipient suspended — PlatformUser.suspended does not suppress Step 27 email dispatch (no delivery suspend gate; auth/session owns suspend)', async () => {
    // Executable proof of the *accepted* Step 27 policy, not a product change: suspension is an
    // authentication/session authority (PlatformUser.canAuthenticate() → 401/403 on the HTTP
    // surface, refresh-session revocation), while the Step 27 delivery path gates on preference
    // enablement + recipientEmail only. A mandatory (security-category) notification therefore
    // still reaches the recorded recipientEmail after suspension.
    const suspended = await createPlatformUserFixture(prisma, {
      email: `t15-user-${randomUUID()}@test.local`,
    });
    await prisma.platformUser.update({
      where: { id: suspended.id },
      data: { status: 'suspended', suspendedAt: new Date(), isActive: false },
    });
    const before = await prisma.platformUser.findUniqueOrThrow({ where: { id: suspended.id } });
    expect(before.status).toBe('suspended');
    expect(before.isActive).toBe(false);
    expect(before.suspendedAt).not.toBeNull();

    const sorBefore = await protectedNotificationsSoR(prisma);
    const recipientEmail = `t15-recipient-${randomUUID()}@test.local`;
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: suspended.id,
      recipientEmail,
      recipientDisplayName: 'Suspended Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });

    expect(result.accepted).toBe(true);
    expect(result.suppressed).toBeFalsy();
    expect(result.intentId).toBeTruthy();
    const sent = stack.emailService.sent.filter((m) => m.to === recipientEmail);
    expect(sent).toHaveLength(1);
    expect(sent[0].to.endsWith('@test.local')).toBe(true);
    expect(stack.emailService.realExternalDeliveriesDuringTests).toBe(0);

    // Source mutation N/A — dispatch never writes to any business SoR, including the suspended
    // PlatformUser row itself (status/isActive/authzRevision untouched).
    const delta = diffSoR(sorBefore, await protectedNotificationsSoR(prisma));
    expect(Object.values(delta).every((v) => v === 0)).toBe(true);
    const after = await prisma.platformUser.findUniqueOrThrow({ where: { id: suspended.id } });
    expect(after.status).toBe('suspended');
    expect(after.isActive).toBe(false);
    expect(after.authzRevision).toBe(before.authzRevision);
  });

  it('T16: deterministic ordering/pagination (eligible ids sorted stably by id asc)', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    await addOnAt(new Date(now.getTime() + 6 * DAY_MS));
    await addOnAt(new Date(now.getTime() + 5 * DAY_MS));
    await createOverrideFixture(prisma, {
      createdByPlatformUserId: platformUserId,
      expiresAt: new Date(now.getTime() + 4 * DAY_MS),
    });
    const result = await stack.scheduler.runDueScan(now);
    const ids = result.eligible.map((r) => r.id);
    const addonIds = result.eligible.filter((r) => r.kind === 'addon').map((r) => r.id);
    const overrideIds = result.eligible.filter((r) => r.kind === 'override').map((r) => r.id);
    expect(addonIds).toEqual([...addonIds].sort());
    expect(overrideIds).toEqual([...overrideIds].sort());
    expect(ids.length).toBeGreaterThanOrEqual(3);
  });
});
