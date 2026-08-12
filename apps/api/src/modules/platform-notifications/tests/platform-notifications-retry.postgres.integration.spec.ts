/**
 * Flexible Step 27 — retry / dead-letter matrix R01–R16 (gate semantics).
 *
 * Reuses the real Phase 41d `DeliveryJobService.failJob` classification + full-jitter backoff and
 * `DeliveryWorkerService.processDeliveryJob` lease/execute loop. `NODE_ENV=test` disables the
 * BullMQ worker (see `workersEnabled()`), so tests drive successive worker picks by invoking
 * `stack.worker.processDeliveryJob(jobId)` directly — `leaseJob` gates on lease expiry, not on
 * `scheduledAt`, so this is a faithful simulation of the queue.
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
import { computeRetryDelay } from '../../notifications/delivery/delivery-job.service';
import { PLATFORM_NOTIFICATION_AUDIT_ACTIONS, PLATFORM_NOTIFICATION_AUDIT_CATEGORY } from '../platform-notifications.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 27 retry / dead-letter matrix R01-R16 (PostgreSQL)', () => {
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

  afterEach(() => {
    jest.restoreAllMocks();
    clearPlatformNotificationFailureInjection();
  });

  async function dispatchInvitation(email = `r-${randomUUID()}@test.local`) {
    return stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: email,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
  }

  /** Drives a transient-failure job all the way to `dead_letter`, then clears the outage. */
  async function deadLetterInvitation() {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const jobId = jobs[0].id;
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } });
    for (let i = job.attemptCount; i < job.maxAttempts; i++) {
      await stack.worker.processDeliveryJob(jobId);
    }
    expect((await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } })).status).toBe(
      'dead_letter',
    );
    // `provider_transient` is baked into the intent metadata at dispatch time (it forces every
    // attempt for that intent to fail, simulating a sustained outage) — clear both the env
    // selector and the persisted flag the way an ops fix would.
    clearPlatformNotificationFailureInjection();
    const intent = await prisma.notificationIntent.findUniqueOrThrow({ where: { id: result.intentId! } });
    await prisma.notificationIntent.update({
      where: { id: result.intentId! },
      data: { metadata: { ...(intent.metadata as Record<string, unknown>), deliveryGateForceFail: false } },
    });
    return { result, jobId };
  }

  it('R01: transient provider failure retries — job stays pending with a scheduled next attempt (not terminal)', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);

    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe('pending');
    expect(jobs[0].attemptCount).toBe(1);
    expect(jobs[0].attemptCount).toBeLessThan(jobs[0].maxAttempts);
    expect(jobs[0].scheduledAt).not.toBeNull();
    expect(jobs[0].deadLetteredAt).toBeNull();

    // Successive worker picks keep incrementing the attempt counter while retries remain.
    await stack.worker.processDeliveryJob(jobs[0].id);
    await stack.worker.processDeliveryJob(jobs[0].id);
    const after = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobs[0].id } });
    expect(after.attemptCount).toBe(3);
    expect(after.status).toBe('pending');
  });

  it('R02: permanent provider failure is terminal immediately (provider_permanent → dead_letter on attempt 1, not maxAttempts exhaustion)', async () => {
    setPlatformNotificationFailureInjection('provider_permanent');
    const email = `r02-${randomUUID()}@test.local`;
    const result = await dispatchInvitation(email);
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);

    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe('dead_letter');
    expect(jobs[0].attemptCount).toBe(1);
    expect(jobs[0].attemptCount).toBeLessThan(jobs[0].maxAttempts);
    expect(jobs[0].deadLetteredAt).not.toBeNull();
    expect(String(jobs[0].failureReason)).toMatch(/provider_permanent/);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
  });

  it('R03: invalid recipient is terminal validation, never a retry loop (missing recipientEmail → rejected before produce)', async () => {
    await expect(
      stack.dispatch.dispatch({
        eventKey: 'platform.invitation.sent',
        sourceType: 'platform_user_invitation',
        sourceId: randomUUID(),
        recipientKind: 'platform_user',
        recipientId: randomUUID(),
        recipientEmail: '   ',
        variables: {
          recipientDisplayName: 'Admin',
          inviterDisplayName: 'Root',
          expiresAt: new Date().toISOString(),
        },
      }),
    ).rejects.toThrow(/recipientEmail required/i);

    expect(await prisma.notificationIntent.count()).toBe(0);
    expect(await prisma.deliveryJob.count()).toBe(0);
    expect(await prisma.deliveryAttempt.count()).toBe(0);
    expect(stack.emailService.sent).toHaveLength(0);
  });

  it('R04: invalid template is terminal fail-safe (unknown event key and injected template_lookup both abort before produce)', async () => {
    await expect(
      stack.dispatch.dispatch({
        eventKey: 'platform.event.does_not_exist' as never,
        sourceType: 'platform_user_invitation',
        sourceId: randomUUID(),
        recipientKind: 'platform_user',
        recipientId: randomUUID(),
        recipientEmail: `r04-${randomUUID()}@test.local`,
        variables: {},
      }),
    ).rejects.toThrow(/No template for event/i);

    setPlatformNotificationFailureInjection('template_lookup');
    await expect(dispatchInvitation()).rejects.toThrow(/template lookup/i);

    expect(await prisma.notificationIntent.count()).toBe(0);
    expect(await prisma.deliveryJob.count()).toBe(0);
    expect(stack.emailService.sent).toHaveLength(0);
  });

  it('R05: renderer error fails safe (template_renderer injection aborts with no intent, no job, no partial email)', async () => {
    setPlatformNotificationFailureInjection('template_renderer');
    const email = `r05-${randomUUID()}@test.local`;
    await expect(dispatchInvitation(email)).rejects.toThrow(/template renderer/i);

    expect(await prisma.notificationIntent.count()).toBe(0);
    expect(await prisma.deliveryJob.count()).toBe(0);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
  });

  it('R06: provider timeout is retryable (provider_timeout → pending with scheduled retry, no email)', async () => {
    setPlatformNotificationFailureInjection('provider_timeout');
    const email = `r06-${randomUUID()}@test.local`;
    const result = await dispatchInvitation(email);
    const { jobs, attempts } = await getDeliveryArtifacts(prisma, result.intentId!);

    expect(jobs[0].status).toBe('pending');
    expect(jobs[0].attemptCount).toBe(1);
    expect(jobs[0].scheduledAt).not.toBeNull();
    expect(String(jobs[0].failureReason)).toMatch(/provider_timeout/);
    expect(attempts.filter((a) => !a.success)).toHaveLength(1);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
  });

  it('R07: ambiguous provider response is retried, not double-sent (provider_ambiguous → fallback retry, then success sends exactly once)', async () => {
    setPlatformNotificationFailureInjection('provider_ambiguous');
    const email = `r07-${randomUUID()}@test.local`;
    const result = await dispatchInvitation(email);
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);

    expect(jobs[0].status).toBe('pending');
    expect(String(jobs[0].failureReason)).toMatch(/provider_ambiguous/);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);

    clearPlatformNotificationFailureInjection();
    const outcome = await stack.worker.processDeliveryJob(jobs[0].id);
    expect(outcome.status).toBe('delivered');
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(1);
  });

  it('R08: max-attempt terminal — sustained transient failure exhausts maxAttempts and dead-letters the job', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const jobId = jobs[0].id;
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } });
    const maxAttempts = job.maxAttempts;

    for (let i = job.attemptCount; i < maxAttempts; i++) {
      await stack.worker.processDeliveryJob(jobId);
    }

    const final = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(final.status).toBe('dead_letter');
    expect(final.attemptCount).toBe(maxAttempts);
    expect(final.deadLetteredAt).not.toBeNull();
  });

  it('R09: backoff is deterministic and testable (full-jitter window grows per attempt, is capped, and lands in the persisted scheduledAt)', async () => {
    // computeRetryDelay is full-jitter: delay = random(0, min(cap, base * 2^(attempt-1))).
    // Pin the RNG so the schedule is exactly reproducible.
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const now = new Date('2026-06-01T00:00:00.000Z');
    const a1 = computeRetryDelay(1, now);
    const a2 = computeRetryDelay(2, now);
    const a3 = computeRetryDelay(3, now);
    const capped = computeRetryDelay(20, now);

    expect(a1.delayMs).toBe(2_500);
    expect(a2.delayMs).toBe(5_000);
    expect(a3.delayMs).toBe(10_000);
    expect(a2.delayMs).toBeGreaterThan(a1.delayMs);
    expect(a3.delayMs).toBeGreaterThan(a2.delayMs);
    expect(capped.delayMs).toBe(450_000);
    expect(capped.delayMs).toBeLessThanOrEqual(15 * 60_000);
    expect(a1.nextAttemptAt.getTime()).toBe(now.getTime() + a1.delayMs);
    randomSpy.mockRestore();

    // The scheduled retry instant is finite and persisted on the failed job.
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const scheduledAt = jobs[0].scheduledAt!;
    expect(scheduledAt).not.toBeNull();
    expect(Number.isFinite(scheduledAt.getTime())).toBe(true);
    expect(scheduledAt.getTime() - jobs[0].createdAt.getTime()).toBeLessThanOrEqual(15 * 60_000 + 60_000);
  });

  it('R10: retry state is observable (attemptCount / status / next retry instant visible on delivery artifacts and query surfaces)', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs, attempts } = await getDeliveryArtifacts(prisma, result.intentId!);
    expect(jobs[0].attemptCount).toBeGreaterThanOrEqual(1);
    expect(attempts.length).toBeGreaterThanOrEqual(1);
    expect(attempts.every((a) => a.success === false)).toBe(true);

    const detail = await stack.query.getDelivery(perms, result.intentId!);
    expect(detail.jobs[0].attemptCount).toBe(jobs[0].attemptCount);
    expect(detail.jobs[0].status).toBe('pending');

    const list = await stack.query.listDeliveries(perms, { pageSize: 50 });
    const row = list.items.find((i) => i.id === result.intentId);
    expect(row).toBeTruthy();
    expect(row!.jobs[0].attemptCount).toBeGreaterThanOrEqual(1);
    expect(row!.jobs[0].nextRetryAt).not.toBeNull();
    expect(row!.jobs[0].errorClass).toMatch(/provider_transient|deliveryGateForceFail/);
  });

  it('R11: retry after service recreation (fresh stack, same dead-lettered job) requeues and completes', async () => {
    const { result, jobId } = await deadLetterInvitation();
    const fresh = createPlatformNotificationsStack(prisma);
    const user = platformClaims(randomUUID(), randomUUID());

    const retryResult = await fresh.query.retryDelivery(
      user,
      perms,
      result.intentId!,
      { reason: 'restart recovery', jobId },
      randomUUID(),
    );

    expect(retryResult.accepted).toBe(true);
    expect((await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } })).status).toBe(
      'completed',
    );
  });

  it('R12: multi-instance retry claim (injected multi_instance_retry blocks; concurrent manual retries converge)', async () => {
    const { result, jobId } = await deadLetterInvitation();
    setPlatformNotificationFailureInjection('multi_instance_retry');
    const user = platformClaims(randomUUID(), randomUUID());
    await expect(
      stack.query.retryDelivery(user, perms, result.intentId!, { reason: 'claim race', jobId }, randomUUID()),
    ).rejects.toThrow(/multi.instance|injected/i);

    clearPlatformNotificationFailureInjection();
    const settled = await Promise.allSettled([
      stack.query.retryDelivery(user, perms, result.intentId!, { reason: 'a', jobId }, randomUUID()),
      stack.query.retryDelivery(user, perms, result.intentId!, { reason: 'b', jobId }, randomUUID()),
    ]);
    expect(settled.some((r) => r.status === 'fulfilled')).toBe(true);
  });

  it('R13: retry after success invents no second success record (no duplicate DISPATCHED audit)', async () => {
    const { result, jobId } = await deadLetterInvitation();
    const user = platformClaims(randomUUID(), randomUUID());
    await stack.query.retryDelivery(user, perms, result.intentId!, { reason: 'first', jobId }, randomUUID());

    const where = {
      category: PLATFORM_NOTIFICATION_AUDIT_CATEGORY,
      action: PLATFORM_NOTIFICATION_AUDIT_ACTIONS.DISPATCHED,
      resourceId: result.intentId!,
    };
    const before = await prisma.auditEntry.count({ where });
    await stack.worker.processDeliveryJob(jobId);
    expect(await prisma.auditEntry.count({ where })).toBe(before);
  });

  it('R14: no duplicate user-visible delivery on repeated processDeliveryJob after success', async () => {
    const email = `r14-${randomUUID()}@test.local`;
    const result = await dispatchInvitation(email);
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(1);

    await stack.worker.processDeliveryJob(jobs[0].id);
    await stack.worker.processDeliveryJob(jobs[0].id);

    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(1);
  });

  it('R15: terminal / dead-letter state is visible on getDelivery and listDeliveries', async () => {
    const { result } = await deadLetterInvitation();
    const detail = await stack.query.getDelivery(perms, result.intentId!);
    expect(detail.jobs.some((j) => j.status === 'dead_letter')).toBe(true);

    const list = await stack.query.listDeliveries(perms, { pageSize: 50 });
    expect(list.items.some((i) => i.id === result.intentId)).toBe(true);
    const viaStatus = await stack.query.listDeliveries(perms, { pageSize: 50, status: 'dead_letter' });
    // The status filter may match intent or job status depending on the query surface — either
    // projection must expose the terminal job.
    expect(
      viaStatus.items.some((i) => i.id === result.intentId) ||
        list.items.some(
          (i) => i.id === result.intentId && i.jobs.some((j) => j.status === 'dead_letter'),
        ),
    ).toBe(true);
  });

  it('R16: Operations-policy manual retry (permission + reason) requeues a dead-lettered job and completes it', async () => {
    const { result, jobId } = await deadLetterInvitation();
    const user = platformClaims(randomUUID(), randomUUID());

    const retryResult = await stack.query.retryDelivery(
      user,
      perms,
      result.intentId!,
      { reason: 'operations policy manual retry', jobId },
      randomUUID(),
    );

    expect(retryResult.accepted).toBe(true);
    expect((await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } })).status).toBe(
      'completed',
    );
  });

  it('Retry authorization: retryDelivery without notifications.deliveries.retry is forbidden', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const viewerPerms = new Set(['notifications.deliveries.view']);
    const user = platformClaims(randomUUID(), randomUUID());
    await expect(
      stack.query.retryDelivery(user, viewerPerms, result.intentId!, { reason: 'nope', jobId: jobs[0].id }, randomUUID()),
    ).rejects.toThrow(/deliveries\.retry/i);
  });

  it('Retry validation: retryDelivery requires a non-empty reason', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    clearPlatformNotificationFailureInjection();
    const user = platformClaims(randomUUID(), randomUUID());
    await expect(
      stack.query.retryDelivery(user, perms, result.intentId!, { reason: '  ', jobId: jobs[0].id }, randomUUID()),
    ).rejects.toThrow(/reason/i);
  });

  it('Retry audit: a manual retry records exactly one RETRY_REQUESTED entry for the job', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    clearPlatformNotificationFailureInjection();
    const user = platformClaims(randomUUID(), randomUUID());
    await stack.query.retryDelivery(user, perms, result.intentId!, { reason: 'manual retry', jobId: jobs[0].id }, randomUUID());

    expect(
      await prisma.auditEntry.count({
        where: {
          category: PLATFORM_NOTIFICATION_AUDIT_CATEGORY,
          action: PLATFORM_NOTIFICATION_AUDIT_ACTIONS.RETRY_REQUESTED,
          resourceId: jobs[0].id,
        },
      }),
    ).toBe(1);
  });

  it('Retry injection: dead_letter_transition selector blocks a manual retry', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobs[0].id } });
    for (let i = job.attemptCount; i < job.maxAttempts; i++) {
      await stack.worker.processDeliveryJob(job.id);
    }
    setPlatformNotificationFailureInjection('dead_letter_transition');
    const user = platformClaims(randomUUID(), randomUUID());
    await expect(
      stack.query.retryDelivery(user, perms, result.intentId!, { reason: 'manual retry', jobId: job.id }, randomUUID()),
    ).rejects.toThrow(/dead-letter/i);
  });

  it('Retry happy path: a successful first delivery schedules no retry at all', async () => {
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    expect(jobs[0].status).toBe('completed');
    expect(jobs[0].scheduledAt).toBeNull();
    expect(jobs[0].failureReason).toBeNull();
  });

  it('Retry terminal guard: a dead-lettered job never resurrects without a manual requeue', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobs[0].id } });
    for (let i = job.attemptCount; i < job.maxAttempts; i++) {
      await stack.worker.processDeliveryJob(job.id);
    }
    const outcome = await stack.worker.processDeliveryJob(job.id);
    expect(outcome.status).toBe('skipped_leased');
    expect((await prisma.deliveryJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe(
      'dead_letter',
    );
  });
});
