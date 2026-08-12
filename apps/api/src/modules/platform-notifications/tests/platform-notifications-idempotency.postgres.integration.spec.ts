/**
 * Flexible Step 27 — idempotency matrix I01–I16.
 * Dedupe is keyed by (eventKey, sourceType, sourceId, windowKey, recipientId, channel) via the
 * Phase 41d `NotificationIntent` unique (tenantId, idempotencyKey) constraint.
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

  it('I01: exact replay (same sourceId) returns same intentId and does not resend', async () => {
    const input = invitation();
    const first = await stack.adapters.invitationSent(input);
    const second = await stack.adapters.invitationSent(input);
    expect(first.replayed).toBeFalsy();
    expect(second.replayed).toBe(true);
    expect(second.intentId).toBe(first.intentId);
    expect(stack.emailService.sent.filter((m) => m.to === input.recipientEmail)).toHaveLength(1);
  });

  it('I02: replay is accepted=true even though no new work was performed', async () => {
    const input = invitation();
    await stack.adapters.invitationSent(input);
    const second = await stack.adapters.invitationSent(input);
    expect(second.accepted).toBe(true);
  });

  it('I03: different sourceId (new invitation) is NOT deduped', async () => {
    const email = `i03-${randomUUID()}@test.local`;
    await stack.adapters.invitationSent(invitation({ recipientEmail: email }));
    const second = await stack.adapters.invitationSent(invitation({ recipientEmail: email }));
    expect(second.replayed).toBeFalsy();
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(2);
  });

  it('I04: different windowKey is a distinct dedupe key (trial d7 vs d1 both delivered)', async () => {
    const trialId = randomUUID();
    const email = `i04-${randomUUID()}@test.local`;
    const d7 = await stack.adapters.trialExpiry({
      approaching: true,
      trialId,
      organizationName: 'Acme',
      expiryDate: new Date().toISOString(),
      planVersionId: randomUUID(),
      windowKey: 'd7',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    const d1 = await stack.adapters.trialExpiry({
      approaching: true,
      trialId,
      organizationName: 'Acme',
      expiryDate: new Date().toISOString(),
      planVersionId: randomUUID(),
      windowKey: 'd1',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(d7.replayed).toBeFalsy();
    expect(d1.replayed).toBeFalsy();
    expect(d7.dedupeKey).not.toBe(d1.dedupeKey);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(2);
  });

  it('I05: different recipientId for the same source is a distinct dedupe key', async () => {
    const invitationId = randomUUID();
    const a = await stack.adapters.invitationSent(invitation({ invitationId, platformUserId: randomUUID() }));
    const b = await stack.adapters.invitationSent(invitation({ invitationId, platformUserId: randomUUID() }));
    expect(a.intentId).not.toBe(b.intentId);
  });

  it('I06: replay does not write a second dispatch audit entry', async () => {
    const input = invitation();
    await stack.adapters.invitationSent(input);
    const before = await prisma.auditEntry.count({ where: { category: 'platform_notification_management', action: 'platform_notification.dispatched' } });
    await stack.adapters.invitationSent(input);
    const after = await prisma.auditEntry.count({ where: { category: 'platform_notification_management', action: 'platform_notification.dispatched' } });
    expect(after).toBe(before);
  });

  it('I07: dedupeKey is deterministic (same inputs always compute the same key)', async () => {
    const input = invitation();
    const first = await stack.adapters.invitationSent(input);
    await cleanupPlatformNotificationsTables(prisma);
    stack = createPlatformNotificationsStack(prisma);
    const second = await stack.adapters.invitationSent(input);
    expect(second.dedupeKey).toBe(first.dedupeKey);
  });

  it('I08: concurrent identical dispatches converge to a single delivered email', async () => {
    const input = invitation();
    const [a, b] = await Promise.all([
      stack.adapters.invitationSent(input),
      stack.adapters.invitationSent(input),
    ]);
    expect([a.replayed, b.replayed].filter(Boolean)).toHaveLength(1);
    expect(stack.emailService.sent.filter((m) => m.to === input.recipientEmail)).toHaveLength(1);
  });

  it('I09: replayed result carries no jobIds (no new delivery jobs enqueued)', async () => {
    const input = invitation();
    await stack.adapters.invitationSent(input);
    const second = await stack.adapters.invitationSent(input);
    expect(second.jobIds).toBeUndefined();
  });

  it('I10: idempotency spans across different event adapters that share no source fields', async () => {
    const email = `i10-${randomUUID()}@test.local`;
    const a = await stack.adapters.mfaSecurityAlert({
      alertId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: email,
      recipientDisplayName: 'Admin',
      alertSummary: 'login',
      occurredAt: new Date().toISOString(),
    });
    const b = await stack.adapters.invitationSent(invitation({ recipientEmail: email }));
    expect(a.intentId).not.toBe(b.intentId);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(2);
  });

  it('I11: limit threshold duplicate usage event', async () => {
    const evidenceId = randomUUID();
    const email = `i11-${randomUUID()}@test.local`;
    const input = {
      level: 'warning' as const,
      evidenceId,
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
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(1);
  });

  it('I12: provisioning failure replay', async () => {
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
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(1);
  });

  it('I13: Trial expiry scheduler replay (adapter trialExpiry same window)', async () => {
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
  });

  it('I14: lead reminder scheduler replay', async () => {
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
  });

  it('I15: manager alert replay', async () => {
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
  });

  it('I16: provider retry after ambiguous response (injection provider_ambiguous then clear + processDeliveryJob — no duplicate user-visible email if already sent, or single retry path)', async () => {
    setPlatformNotificationFailureInjection('provider_ambiguous');
    const email = `i16-${randomUUID()}@test.local`;
    const result = await stack.adapters.invitationSent(invitation({ recipientEmail: email }));
    const jobs = await prisma.deliveryJob.findMany({ where: { intentId: result.intentId! } });
    expect(jobs).toHaveLength(1);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
    clearPlatformNotificationFailureInjection();
    await stack.worker.processDeliveryJob(jobs[0].id);
    // Single successful retry path — exactly one user-visible email, never a duplicate fan-out.
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(1);
  });
});
