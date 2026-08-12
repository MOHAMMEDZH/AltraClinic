/**
 * Flexible Step 27 — retry / dead-letter matrix R01–R10.
 * Reuses the real Phase 41d `DeliveryJobService.failJob` classification + jittered backoff and
 * `DeliveryWorkerService.processDeliveryJob` lease/execute loop. `NODE_ENV=test` disables the
 * BullMQ worker (see `workersEnabled()`), so tests drive retries by invoking
 * `stack.worker.processDeliveryJob(jobId)` directly to simulate successive worker picks —
 * `leaseJob` does not gate on `scheduledAt`, only lease expiry, so this is a faithful simulation.
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
  getDeliveryArtifacts,
  platformClaims,
  platformDbSecurityEnabled,
  setPlatformNotificationFailureInjection,
} from './platform-notifications-db.harness';
import { NOTIFICATIONS_ADMIN_PERMS } from './platform-notifications-stack';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 27 retry / dead-letter matrix R01-R10 (PostgreSQL)', () => {
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

  async function dispatchInvitation() {
    return stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `r-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
  }

  it('R01: provider_transient failure leaves job pending with a scheduled retry (not dead-lettered)', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe('pending');
    expect(jobs[0].attemptCount).toBe(1);
    expect(jobs[0].scheduledAt).not.toBeNull();
  });

  it('R02: repeated transient failures increment attemptCount across simulated worker picks', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const jobId = jobs[0].id;

    await stack.worker.processDeliveryJob(jobId);
    await stack.worker.processDeliveryJob(jobId);

    const after = await prisma.deliveryJob.findUnique({ where: { id: jobId } });
    expect(after!.attemptCount).toBe(3);
    expect(after!.status).toBe('pending');
  });

  it('R03: exhausting maxAttempts under sustained transient failure dead-letters the job', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const jobId = jobs[0].id;
    const job = await prisma.deliveryJob.findUnique({ where: { id: jobId } });
    const maxAttempts = job!.maxAttempts;

    for (let i = job!.attemptCount; i < maxAttempts; i++) {
      await stack.worker.processDeliveryJob(jobId);
    }

    const final = await prisma.deliveryJob.findUnique({ where: { id: jobId } });
    expect(final!.status).toBe('dead_letter');
    expect(final!.attemptCount).toBe(maxAttempts);
    expect(final!.deadLetteredAt).not.toBeNull();
  });

  it('R04: dead-lettered job never resurrects on further processDeliveryJob calls without a manual requeue', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const jobId = jobs[0].id;
    const job = await prisma.deliveryJob.findUnique({ where: { id: jobId } });

    for (let i = job!.attemptCount; i < job!.maxAttempts; i++) {
      await stack.worker.processDeliveryJob(jobId);
    }
    const outcome = await stack.worker.processDeliveryJob(jobId);
    expect(outcome.status).toBe('skipped_leased');

    const final = await prisma.deliveryJob.findUnique({ where: { id: jobId } });
    expect(final!.status).toBe('dead_letter');
  });

  it('R05: manual retryDelivery requeues a dead-lettered job and (with injection cleared) it succeeds', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const jobId = jobs[0].id;
    const job = await prisma.deliveryJob.findUnique({ where: { id: jobId } });
    for (let i = job!.attemptCount; i < job!.maxAttempts; i++) {
      await stack.worker.processDeliveryJob(jobId);
    }
    expect((await prisma.deliveryJob.findUnique({ where: { id: jobId } }))!.status).toBe('dead_letter');

    // `provider_transient` is baked into the intent's persisted metadata at dispatch time (it
    // forces every attempt for that intent to fail, simulating a sustained outage) — simulate
    // the outage recovering by clearing the flag directly, the way an ops fix would.
    clearPlatformNotificationFailureInjection();
    const intent = await prisma.notificationIntent.findUniqueOrThrow({ where: { id: result.intentId! } });
    await prisma.notificationIntent.update({
      where: { id: result.intentId! },
      data: { metadata: { ...(intent.metadata as Record<string, unknown>), deliveryGateForceFail: false } },
    });
    const user = platformClaims(randomUUID(), randomUUID());
    const retryResult = await stack.query.retryDelivery(user, perms, result.intentId!, { reason: 'manual retry', jobId }, randomUUID());
    expect(retryResult.accepted).toBe(true);

    const final = await prisma.deliveryJob.findUnique({ where: { id: jobId } });
    expect(final!.status).toBe('completed');
  });

  it('R06: retryDelivery without deliveries.retry permission is forbidden', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const jobId = jobs[0].id;
    const viewerPerms = new Set(['notifications.deliveries.view']);
    const user = platformClaims(randomUUID(), randomUUID());
    await expect(
      stack.query.retryDelivery(user, viewerPerms, result.intentId!, { reason: 'nope', jobId }, randomUUID()),
    ).rejects.toThrow(/deliveries\.retry/i);
  });

  it('R07: retryDelivery requires a non-empty reason', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const jobId = jobs[0].id;
    clearPlatformNotificationFailureInjection();
    const user = platformClaims(randomUUID(), randomUUID());
    await expect(
      stack.query.retryDelivery(user, perms, result.intentId!, { reason: '  ', jobId }, randomUUID()),
    ).rejects.toThrow(/reason/i);
  });

  it('R08: dead_letter_transition failure injection blocks manual retry', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const jobId = jobs[0].id;
    const job = await prisma.deliveryJob.findUnique({ where: { id: jobId } });
    for (let i = job!.attemptCount; i < job!.maxAttempts; i++) {
      await stack.worker.processDeliveryJob(jobId);
    }

    setPlatformNotificationFailureInjection('dead_letter_transition');
    const user = platformClaims(randomUUID(), randomUUID());
    await expect(
      stack.query.retryDelivery(user, perms, result.intentId!, { reason: 'manual retry', jobId }, randomUUID()),
    ).rejects.toThrow(/dead-letter/i);
  });

  it('R09: manual retry records a RETRY_REQUESTED audit entry', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const jobId = jobs[0].id;
    clearPlatformNotificationFailureInjection();
    const user = platformClaims(randomUUID(), randomUUID());
    await stack.query.retryDelivery(user, perms, result.intentId!, { reason: 'manual retry', jobId }, randomUUID());

    const count = await prisma.auditEntry.count({
      where: { category: 'platform_notification_management', action: 'platform_notification.delivery_retry_requested', resourceId: jobId },
    });
    expect(count).toBe(1);
  });

  it('R10: successful delivery does not schedule a retry (no failJob path taken)', async () => {
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    expect(jobs[0].status).toBe('completed');
    expect(jobs[0].scheduledAt).toBeNull();
    expect(jobs[0].failureReason).toBeNull();
  });
});
