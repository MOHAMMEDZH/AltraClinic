/**
 * Flexible Step 27 — idempotency matrix I01–I16 (gate semantics).
 *
 * Logical-event identity is `(eventKey, sourceType, sourceId, windowKey, recipientId, channel)`,
 * persisted as the Phase 41d `NotificationIntent` unique (tenantId, idempotencyKey). Every ID
 * below proves the *durable* dedupe property (survives lost client results, service recreation,
 * in-process cache loss and multi-instance races) rather than an in-memory guard.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createPlatformNotificationsStack, type PlatformNotificationsStack } from './platform-notifications-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupPlatformNotificationsTables,
  clearPlatformNotificationFailureInjection,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  ensureSentinel,
  platformDbSecurityEnabled,
  setPlatformNotificationFailureInjection,
} from './platform-notifications-db.harness';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { listPlatformTemplates } from '../application/templates/platform-template.catalog';
import { PLATFORM_NOTIFICATION_AUDIT_CATEGORY, PLATFORM_NOTIFICATION_AUDIT_ACTIONS } from '../platform-notifications.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 27 idempotency matrix I01-I16 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let stack: PlatformNotificationsStack;

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

  function invitation(overrides: Partial<Parameters<PlatformNotificationsStack['adapters']['invitationSent']>[0]> = {}) {
    return {
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `i-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
      ...overrides,
    };
  }

  function sentTo(email: string, ...stacks: PlatformNotificationsStack[]): number {
    const pool = stacks.length ? stacks : [stack];
    return pool.reduce((n, s) => n + s.emailService.sent.filter((m) => m.to === email).length, 0);
  }

  it('I01: same logical event exact replay (identical adapter payload) → same intentId, zero additional delivery', async () => {
    const input = invitation();
    const first = await stack.adapters.invitationSent(input);
    const intentsAfterFirst = await prisma.notificationIntent.count();
    const second = await stack.adapters.invitationSent(input);

    expect(first.replayed).toBeFalsy();
    expect(second.accepted).toBe(true);
    expect(second.replayed).toBe(true);
    expect(second.intentId).toBe(first.intentId);
    expect(second.jobIds).toBeUndefined();
    expect(await prisma.notificationIntent.count()).toBe(intentsAfterFirst);
    expect(sentTo(input.recipientEmail)).toBe(1);
  });

  it('I02: same event after client response loss (durable write committed, caller never saw the result) → same intentId, +0 delivery', async () => {
    const input = invitation();
    // First call commits the intent + delivery durably; simulate the caller losing the HTTP/RPC
    // response by discarding it entirely and re-issuing the identical event.
    const durable = await stack.adapters.invitationSent(input);
    const intentsBefore = await prisma.notificationIntent.count();
    const jobsBefore = await prisma.deliveryJob.count();

    const retried = await stack.adapters.invitationSent(input);

    expect(retried.accepted).toBe(true);
    expect(retried.replayed).toBe(true);
    expect(retried.intentId).toBe(durable.intentId);
    expect(await prisma.notificationIntent.count()).toBe(intentsBefore);
    expect(await prisma.deliveryJob.count()).toBe(jobsBefore);
    expect(sentTo(input.recipientEmail)).toBe(1);
  });

  it('I03: service recreation (createPlatformNotificationsStack again after the first durable write) → replay dedupes on the persisted key', async () => {
    const input = invitation();
    const first = await stack.adapters.invitationSent(input);
    const intentsBefore = await prisma.notificationIntent.count();

    const recreatedA = createPlatformNotificationsStack(prisma);
    const recreatedB = createPlatformNotificationsStack(prisma);
    const viaA = await recreatedA.adapters.invitationSent(input);
    const viaB = await recreatedB.adapters.invitationSent(input);

    expect(viaA.replayed).toBe(true);
    expect(viaB.replayed).toBe(true);
    expect(viaA.intentId).toBe(first.intentId);
    expect(viaB.intentId).toBe(first.intentId);
    expect(viaA.dedupeKey).toBe(first.dedupeKey);
    expect(await prisma.notificationIntent.count()).toBe(intentsBefore);
    expect(sentTo(input.recipientEmail, stack, recreatedA, recreatedB)).toBe(1);
  });

  it('I04: process cache loss (in-memory sent log cleared + fresh stack, database untouched) → durable key still dedupes', async () => {
    const input = invitation();
    const first = await stack.adapters.invitationSent(input);
    expect(sentTo(input.recipientEmail)).toBe(1);

    // Wipe every in-process trace of the first delivery: the recording sink's array and the
    // service instances themselves. Only the durable rows survive.
    stack.emailService.reset();
    const rebooted = createPlatformNotificationsStack(prisma);
    expect(rebooted.emailService.sent).toHaveLength(0);
    const intentsBefore = await prisma.notificationIntent.count();

    const replay = await rebooted.adapters.invitationSent(input);

    expect(replay.replayed).toBe(true);
    expect(replay.intentId).toBe(first.intentId);
    expect(await prisma.notificationIntent.count()).toBe(intentsBefore);
    expect(sentTo(input.recipientEmail, rebooted)).toBe(0);
  });

  it('I05: multi-instance race (two stacks dispatching the same event under Promise.all) → exactly one intent', async () => {
    const input = invitation();
    const s1 = createPlatformNotificationsStack(prisma);
    const s2 = createPlatformNotificationsStack(prisma);

    const [a, b] = await Promise.all([
      s1.adapters.invitationSent(input),
      s2.adapters.invitationSent(input),
    ]);

    expect(a.intentId).toBe(b.intentId);
    expect([a.replayed, b.replayed].filter(Boolean)).toHaveLength(1);
    expect(await prisma.notificationIntent.count()).toBe(1);
    expect(await prisma.deliveryJob.count()).toBe(1);
    expect(sentTo(input.recipientEmail, s1, s2)).toBe(1);
  });

  it('I06: same event, different recipient (two recipientIds for one invitation source) → two distinct intents', async () => {
    const invitationId = randomUUID();
    const emailA = `i06a-${randomUUID()}@test.local`;
    const emailB = `i06b-${randomUUID()}@test.local`;
    const a = await stack.adapters.invitationSent(
      invitation({ invitationId, platformUserId: randomUUID(), recipientEmail: emailA }),
    );
    const b = await stack.adapters.invitationSent(
      invitation({ invitationId, platformUserId: randomUUID(), recipientEmail: emailB }),
    );

    expect(a.intentId).not.toBe(b.intentId);
    expect(a.dedupeKey).not.toBe(b.dedupeKey);
    expect(await prisma.notificationIntent.count()).toBe(2);
    expect(sentTo(emailA)).toBe(1);
    expect(sentTo(emailB)).toBe(1);
  });

  it('I07: N/A — Step 27 platform_user path is email-only (template.channels email; in-app skipped)', async () => {
    // There is no second channel for the same logical event to dedupe against: every catalog
    // template declares `channels: ['email']`, and PlatformNotificationDispatchService pins
    // platform_user recipients to email regardless, so no in-app twin DeliveryJob is produced.
    // (Phase 41d may still write a legacy Notification bookkeeping row for the email intent —
    // that is EMAIL-channel, not an in-app inbox twin, and is out of scope for this N/A.)
    expect(listPlatformTemplates().every((t) => t.channels.length === 1 && t.channels[0] === 'email')).toBe(true);

    const input = invitation();
    const result = await stack.adapters.invitationSent(input);
    const jobs = await prisma.deliveryJob.findMany({ where: { intentId: result.intentId! } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].channel).toBe('email');
    expect(result.jobIds).toHaveLength(1);
    expect(jobs.some((j) => /in.?app|sms|whatsapp|push/i.test(j.channel))).toBe(false);

    const legacy = await prisma.notification.findMany({
      where: {
        tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
        metadata: { path: ['intentId'], equals: result.intentId! },
      },
    });
    expect(legacy.every((n) => n.channel === 'EMAIL')).toBe(true);
    expect(legacy.some((n) => n.channel === 'IN_APP')).toBe(false);
  });

  it('I08: changed source revision (same trial source, new windowKey revision) → new intent, prior intent untouched', async () => {
    const trialId = randomUUID();
    const recipientPlatformUserId = randomUUID();
    const email = `i08-${randomUUID()}@test.local`;
    const base = {
      approaching: true as const,
      trialId,
      organizationName: 'Acme',
      expiryDate: new Date().toISOString(),
      planVersionId: randomUUID(),
      recipientPlatformUserId,
      recipientEmail: email,
    };
    const d7 = await stack.adapters.trialExpiry({ ...base, windowKey: 'd7' });
    const d1 = await stack.adapters.trialExpiry({ ...base, windowKey: 'd1' });

    expect(d7.replayed).toBeFalsy();
    expect(d1.replayed).toBeFalsy();
    expect(d7.dedupeKey).not.toBe(d1.dedupeKey);
    expect(d7.intentId).not.toBe(d1.intentId);
    expect(sentTo(email)).toBe(2);

    // A different sourceId (a fresh invitation revision) is likewise a distinct logical event.
    const revA = await stack.adapters.invitationSent(invitation({ recipientEmail: email }));
    const revB = await stack.adapters.invitationSent(invitation({ recipientEmail: email }));
    expect(revA.intentId).not.toBe(revB.intentId);
  });

  it('I09: Add-on expiry warning replay (same assignment + same window) → +0 intents, +0 delivery', async () => {
    const email = `i09-${randomUUID()}@test.local`;
    const input = {
      approaching: true as const,
      assignmentId: randomUUID(),
      organizationName: 'Acme',
      addOnLabel: 'addon.notif.telehealth',
      addOnVersionId: randomUUID(),
      expiryDate: new Date().toISOString(),
      windowKey: 'd7',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    };
    const first = await stack.adapters.addOnExpiry(input);
    const intentsBefore = await prisma.notificationIntent.count();
    const second = await stack.adapters.addOnExpiry(input);

    expect(second.replayed).toBe(true);
    expect(second.intentId).toBe(first.intentId);
    expect(await prisma.notificationIntent.count()).toBe(intentsBefore);
    expect(sentTo(email)).toBe(1);
  });

  it('I10: Override expiry warning replay (same override + same window) → +0 intents, +0 delivery', async () => {
    const email = `i10-${randomUUID()}@test.local`;
    const input = {
      approaching: true as const,
      overrideId: randomUUID(),
      organizationName: 'Acme',
      overrideLabel: 'SALES_CONCESSION',
      expiryDate: new Date().toISOString(),
      windowKey: 'd1',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    };
    const first = await stack.adapters.overrideExpiry(input);
    const intentsBefore = await prisma.notificationIntent.count();
    const second = await stack.adapters.overrideExpiry(input);

    expect(second.replayed).toBe(true);
    expect(second.intentId).toBe(first.intentId);
    expect(await prisma.notificationIntent.count()).toBe(intentsBefore);
    expect(sentTo(email)).toBe(1);
  });

  it('I11: limit threshold duplicate usage event (same evidence + level + window) → replay, +0 delivery', async () => {
    const email = `i11-${randomUUID()}@test.local`;
    const input = {
      level: 'warning' as const,
      evidenceId: randomUUID(),
      organizationName: 'Acme',
      limitKey: 'sms_monthly',
      effectiveLimit: '1000',
      currentUsage: '820',
      thresholdPercent: '82',
      limitProvenance: 'PLAN',
      windowKey: 'default',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    };
    const first = await stack.adapters.limitAlert(input);
    const second = await stack.adapters.limitAlert(input);

    expect(second.replayed).toBe(true);
    expect(second.intentId).toBe(first.intentId);
    expect(sentTo(email)).toBe(1);
  });

  it('I12: provisioning failure replay (same operation) → replay, +0 delivery', async () => {
    const email = `i12-${randomUUID()}@test.local`;
    const input = {
      recovered: false,
      operationId: randomUUID(),
      organizationName: 'Acme',
      operationReference: 'prov-op-1',
      failureClass: 'timeout',
      at: new Date().toISOString(),
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    };
    const first = await stack.adapters.provisioning(input);
    const second = await stack.adapters.provisioning(input);

    expect(second.replayed).toBe(true);
    expect(second.intentId).toBe(first.intentId);
    expect(sentTo(email)).toBe(1);
  });

  it('I13: Trial-expiry warning replay (same trial + same window) → replay, +0 delivery', async () => {
    const email = `i13-${randomUUID()}@test.local`;
    const input = {
      approaching: true,
      trialId: randomUUID(),
      organizationName: 'Acme',
      expiryDate: new Date().toISOString(),
      planVersionId: randomUUID(),
      windowKey: 'd7',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    };
    const first = await stack.adapters.trialExpiry(input);
    const second = await stack.adapters.trialExpiry(input);

    expect(second.replayed).toBe(true);
    expect(second.intentId).toBe(first.intentId);
    expect(sentTo(email)).toBe(1);
  });

  it('I14: lead next-action reminder replay (same lead + same window) → replay, +0 delivery', async () => {
    const email = `i14-${randomUUID()}@test.local`;
    const input = {
      leadId: randomUUID(),
      leadReference: 'LEAD-14',
      organizationName: 'Acme',
      nextActionDate: new Date().toISOString(),
      nextActionType: 'call',
      windowKey: 'd1',
      ownerPlatformUserId: randomUUID(),
      recipientEmail: email,
    };
    const first = await stack.adapters.leadNextActionReminder(input);
    const second = await stack.adapters.leadNextActionReminder(input);

    expect(second.replayed).toBe(true);
    expect(second.intentId).toBe(first.intentId);
    expect(sentTo(email)).toBe(1);
  });

  it('I15: manager alert replay (same alert + same manager recipient) → replay, +0 delivery', async () => {
    const email = `i15-${randomUUID()}@test.local`;
    const input = {
      ops: false,
      alertId: randomUUID(),
      managerPlatformUserId: randomUUID(),
      recipientEmail: email,
      managerDisplayName: 'Mgr',
      staleCount: 3,
      periodLabel: '7d',
    };
    const first = await stack.adapters.managerAlert(input);
    const second = await stack.adapters.managerAlert(input);

    expect(second.replayed).toBe(true);
    expect(second.intentId).toBe(first.intentId);
    expect(sentTo(email)).toBe(1);
  });

  it('I16: ambiguous provider response then retry (provider_ambiguous → cleared → reprocess) → exactly one user-visible email', async () => {
    setPlatformNotificationFailureInjection('provider_ambiguous');
    const email = `i16-${randomUUID()}@test.local`;
    const result = await stack.adapters.invitationSent(invitation({ recipientEmail: email }));
    const jobs = await prisma.deliveryJob.findMany({ where: { intentId: result.intentId! } });
    expect(jobs).toHaveLength(1);
    expect(sentTo(email)).toBe(0);

    clearPlatformNotificationFailureInjection();
    await stack.worker.processDeliveryJob(jobs[0].id);
    // Single successful retry path — one user-visible email, never a duplicate fan-out.
    expect(sentTo(email)).toBe(1);
    expect(await prisma.deliveryJob.count({ where: { intentId: result.intentId! } })).toBe(1);
  });

  it('Idempotency audit: a replayed logical event writes no second DISPATCHED audit entry', async () => {
    const input = invitation();
    await stack.adapters.invitationSent(input);
    const where = {
      category: PLATFORM_NOTIFICATION_AUDIT_CATEGORY,
      action: PLATFORM_NOTIFICATION_AUDIT_ACTIONS.DISPATCHED,
    };
    const before = await prisma.auditEntry.count({ where });
    await stack.adapters.invitationSent(input);
    expect(await prisma.auditEntry.count({ where })).toBe(before);
  });

  it('Idempotency scope: distinct event families sharing a recipient stay independent', async () => {
    const email = `i-cross-${randomUUID()}@test.local`;
    const platformUserId = randomUUID();
    const mfa = await stack.adapters.mfaSecurityAlert({
      alertId: randomUUID(),
      platformUserId,
      recipientEmail: email,
      recipientDisplayName: 'Admin',
      alertSummary: 'login',
      occurredAt: new Date().toISOString(),
    });
    const inv = await stack.adapters.invitationSent(invitation({ platformUserId, recipientEmail: email }));

    expect(mfa.intentId).not.toBe(inv.intentId);
    expect(sentTo(email)).toBe(2);
  });
});
