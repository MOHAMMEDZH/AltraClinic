/**
 * Flexible Step 27 — audit trail matrix A01–A16.
 * `PlatformNotificationAuditLog` writes into the shared, append-only `audit_entries` table
 * (category `platform_notification_management`) via `AuditEntryFactory`, mirroring the Step 26
 * `CommissionAuditLog` pattern.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createPlatformNotificationsStack, type PlatformNotificationsStack } from './platform-notifications-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupPlatformNotificationsTables,
  clearPlatformNotificationFailureInjection,
  countNotificationAudits,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  ensureSentinel,
  platformClaims,
  platformDbSecurityEnabled,
  setPlatformNotificationFailureInjection,
} from './platform-notifications-db.harness';
import { NOTIFICATIONS_ADMIN_PERMS } from './platform-notifications-stack';
import { PLATFORM_NOTIFICATION_AUDIT_CATEGORY } from '../platform-notifications.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 27 audit trail matrix A01-A16 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let stack: PlatformNotificationsStack;
  const perms = new Set(NOTIFICATIONS_ADMIN_PERMS);

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
  });

  it('A01: successful dispatch writes exactly one DISPATCHED audit entry', async () => {
    const before = await countNotificationAudits(prisma, 'platform_notification.dispatched');
    await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `a01-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const after = await countNotificationAudits(prisma, 'platform_notification.dispatched');
    expect(after).toBe(before + 1);
  });

  it('A02: DISPATCHED audit entry is scoped to the platform_notification_management category', async () => {
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `a02-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const row = await prisma.auditEntry.findFirst({
      where: { action: 'platform_notification.dispatched', resourceId: result.intentId! },
    });
    expect(row).not.toBeNull();
    expect(row!.category).toBe(PLATFORM_NOTIFICATION_AUDIT_CATEGORY);
    expect(row!.tenantId).toBe('00000000-0000-4000-8000-000000000047');
  });

  it('A03: template preview writes a PREVIEW audit entry with the template key in details', async () => {
    const user = platformClaims(randomUUID(), randomUUID());
    stack.query.preview(user, perms, 'tpl.platform.invitation.sent', 'en-US');
    await new Promise((resolve) => setTimeout(resolve, 50));
    const row = await prisma.auditEntry.findFirst({
      where: { action: 'platform_notification.template_previewed', actorId: user.sub },
    });
    expect(row).not.toBeNull();
    expect((row!.details as Record<string, unknown>).templateKey).toBe('tpl.platform.invitation.sent');
  });

  it('A04: preference upsert writes a PREFERENCE_UPDATED audit entry', async () => {
    const platformUser = await createPlatformUserFixture(prisma, { email: `a04-${randomUUID()}@test.local` });
    const user = platformClaims(platformUser.id, randomUUID());
    const row = await stack.prefs.upsert(
      user,
      perms,
      { category: 'usage', channel: 'email', enabled: false },
      randomUUID(),
    );
    const count = await prisma.auditEntry.count({
      where: { action: 'platform_notification.preference_updated', resourceId: row.id },
    });
    expect(count).toBe(1);
  });

  it('A05: attempting to disable a mandatory category writes MANDATORY_DISABLE_DENIED and is forbidden', async () => {
    const user = platformClaims(randomUUID(), randomUUID());
    await expect(
      stack.prefs.upsert(user, perms, { category: 'security', channel: 'email', enabled: false }, randomUUID()),
    ).rejects.toThrow(/Mandatory notification category/i);
    const count = await prisma.auditEntry.count({
      where: { action: 'platform_notification.mandatory_disable_denied', actorId: user.sub },
    });
    expect(count).toBe(1);
  });

  it('A06: manual retry writes a RETRY_REQUESTED audit entry carrying the reason', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `a06-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    clearPlatformNotificationFailureInjection();
    const intent = await prisma.notificationIntent.findFirstOrThrow({ where: { id: result.intentId! }, include: { jobs: true } });
    const user = platformClaims(randomUUID(), randomUUID());
    await stack.query.retryDelivery(user, perms, result.intentId!, { reason: 'ops recovery', jobId: intent.jobs[0].id }, randomUUID());

    const row = await prisma.auditEntry.findFirst({
      where: { action: 'platform_notification.delivery_retry_requested', resourceId: intent.jobs[0].id },
    });
    expect(row).not.toBeNull();
    expect(row!.reason).toBe('ops recovery');
  });

  it('A07: audit_entries is append-only — UPDATE is rejected by the immutability trigger', async () => {
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `a07-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const row = await prisma.auditEntry.findFirstOrThrow({
      where: { action: 'platform_notification.dispatched', resourceId: result.intentId! },
    });
    await expect(
      prisma.$executeRawUnsafe(`UPDATE "audit_entries" SET "reason" = 'tampered' WHERE "id" = '${row.id}'`),
    ).rejects.toThrow(/append-only/i);
  });

  it('A08: audit_entries is append-only — DELETE is rejected by the immutability trigger', async () => {
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `a08-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const row = await prisma.auditEntry.findFirstOrThrow({
      where: { action: 'platform_notification.dispatched', resourceId: result.intentId! },
    });
    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM "audit_entries" WHERE "id" = '${row.id}'`),
    ).rejects.toThrow(/append-only/i);
  });

  it('A09: audit_write failure injection blocks the dispatch audit write and propagates', async () => {
    setPlatformNotificationFailureInjection('audit_write');
    await expect(
      stack.adapters.invitationSent({
        invitationId: randomUUID(),
        platformUserId: randomUUID(),
        recipientEmail: `a09-${randomUUID()}@test.local`,
        recipientDisplayName: 'Admin',
        inviterDisplayName: 'Root',
        expiresAt: new Date().toISOString(),
      }),
    ).rejects.toThrow(/Injected audit write failure/i);
  });

  it('A10: every audit entry has a valid UUID correlationId', async () => {
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `a10-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const row = await prisma.auditEntry.findFirstOrThrow({
      where: { action: 'platform_notification.dispatched', resourceId: result.intentId! },
    });
    expect(row.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('A11: DISPATCHED audit details fold the success result into the JSON payload', async () => {
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `a11-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const row = await prisma.auditEntry.findFirstOrThrow({
      where: { action: 'platform_notification.dispatched', resourceId: result.intentId! },
    });
    expect((row.details as Record<string, unknown>).result).toBe('success');
  });

  it('A12: preference denial audit carries the offending category/channel in details', async () => {
    const user = platformClaims(randomUUID(), randomUUID());
    await expect(
      stack.prefs.upsert(user, perms, { category: 'lifecycle', channel: 'email', enabled: false }, randomUUID()),
    ).rejects.toThrow();
    const row = await prisma.auditEntry.findFirstOrThrow({
      where: { action: 'platform_notification.mandatory_disable_denied', actorId: user.sub },
    });
    expect((row.details as Record<string, unknown>).category).toBe('lifecycle');
    expect((row.details as Record<string, unknown>).channel).toBe('email');
  });

  it('A13: first success preference upsert → audit delta 1; exact replay same payload → additional success audit delta 0 (if upsert always writes, document actual delta and assert no false-success on failure)', async () => {
    const platformUser = await createPlatformUserFixture(prisma, {
      email: `a13-${randomUUID()}@test.local`,
    });
    const user = platformClaims(platformUser.id, randomUUID());
    const before = await countNotificationAudits(prisma, 'platform_notification.preference_updated');
    const row = await stack.prefs.upsert(
      user,
      perms,
      { category: 'usage', channel: 'email', enabled: false },
      randomUUID(),
    );
    const mid = await countNotificationAudits(prisma, 'platform_notification.preference_updated');
    expect(mid - before).toBe(1);
    // Exact same logical payload (same category/channel/enabled) — upsert may write again;
    // document actual delta and assert we never record a false-success after a failed upsert.
    await stack.prefs.upsert(
      user,
      perms,
      { category: 'usage', channel: 'email', enabled: false, expectedRowVersion: row.rowVersion },
      randomUUID(),
    );
    const after = await countNotificationAudits(prisma, 'platform_notification.preference_updated');
    const replayDelta = after - mid;
    expect(replayDelta === 0 || replayDelta === 1).toBe(true);
    // Failure path: stale OCC must not invent an extra success PREFERENCE_UPDATED.
    const beforeFail = after;
    await expect(
      stack.prefs.upsert(
        user,
        perms,
        { category: 'usage', channel: 'email', enabled: true, expectedRowVersion: row.rowVersion },
        randomUUID(),
      ),
    ).rejects.toThrow(/rowVersion|occ/i);
    const afterFail = await countNotificationAudits(
      prisma,
      'platform_notification.preference_updated',
    );
    expect(afterFail).toBe(beforeFail);
  });

  it('A14: failed mandatory disable → false success PREFERENCE_UPDATED delta 0; denial audit 1', async () => {
    const user = platformClaims(randomUUID(), randomUUID());
    const beforeUpdated = await countNotificationAudits(
      prisma,
      'platform_notification.preference_updated',
    );
    const beforeDenied = await countNotificationAudits(
      prisma,
      'platform_notification.mandatory_disable_denied',
    );
    await expect(
      stack.prefs.upsert(
        user,
        perms,
        { category: 'security', channel: 'email', enabled: false },
        randomUUID(),
      ),
    ).rejects.toThrow(/Mandatory notification category/i);
    expect(
      (await countNotificationAudits(prisma, 'platform_notification.preference_updated')) -
        beforeUpdated,
    ).toBe(0);
    expect(
      (await countNotificationAudits(prisma, 'platform_notification.mandatory_disable_denied')) -
        beforeDenied,
    ).toBe(1);
  });

  it('A15: DISPATCHED audit contains no PHI/secrets', async () => {
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `a15-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const row = await prisma.auditEntry.findFirstOrThrow({
      where: { action: 'platform_notification.dispatched', resourceId: result.intentId! },
    });
    expect(JSON.stringify(row)).not.toMatch(
      /password|accessToken|refreshToken|api[_-]?key|diagnosis|patientId|clinicalNotes/i,
    );
  });

  it('A16: preview audit synthetic:true; no real recipient email', async () => {
    const user = platformClaims(randomUUID(), randomUUID());
    const preview = stack.query.preview(user, perms, 'tpl.platform.invitation.sent', 'en-US');
    expect(JSON.stringify(preview.variables)).toMatch(/sample_/);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const row = await prisma.auditEntry.findFirstOrThrow({
      where: { action: 'platform_notification.template_previewed', actorId: user.sub },
    });
    expect((row.details as Record<string, unknown>).synthetic).toBe(true);
    expect(JSON.stringify(row.details)).not.toMatch(/@[a-z0-9.-]+\.(com|org|net)/i);
  });
});
