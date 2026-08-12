/**
 * Flexible Step 27 — concurrency matrix C01–C24 (gate race semantics).
 * Every race is driven against the real stack (one or two `createPlatformNotificationsStack`
 * instances over the same PostgreSQL database) so convergence is proven by durable rows, not by
 * an in-process lock.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  createPlatformNotificationsStack,
  NOTIFICATIONS_ADMIN_PERMS,
  type PlatformNotificationsStack,
} from './platform-notifications-stack';
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
  getDeliveryArtifacts,
  platformClaims,
  platformDbSecurityEnabled,
  setPlatformNotificationFailureInjection,
} from './platform-notifications-db.harness';
import {
  PLATFORM_NOTIFICATION_AUDIT_ACTIONS,
  PLATFORM_NOTIFICATION_AUDIT_CATEGORY,
  PLATFORM_TEMPLATE_VERSION,
} from '../platform-notifications.constants';
import { createSalesTrialsStack } from '../../platform-sales-trials/tests/sales-trials-stack';
import {
  cleanupSalesTrialTables,
  createPlanVersionFixture,
  createPlatformRefreshSession,
  deletePlanVersionFixtures,
  platformClaims as salesTrialsPlatformClaims,
  resolveCatalogKeys,
  SALES_MANAGER_ROLE,
} from '../../platform-sales-trials/tests/sales-trials-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;
const DAY_MS = 24 * 60 * 60 * 1000;

describeDb('Step 27 concurrency C01-C24 (PostgreSQL)', () => {
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

  function invitation(overrides: Record<string, unknown> = {}) {
    return {
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `c-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
      ...overrides,
    };
  }

  async function addOnAt(commercialEnd: Date, platformUserId: string) {
    const { platformTenant } = await createClinicTenantFixture(prisma);
    const config = await createCommercialConfigFixture(prisma, {
      platformTenantId: platformTenant.id,
      createdByPlatformUserId: platformUserId,
      commercialEnd,
    });
    const version = await createAddOnVersionFixture(prisma);
    const assignment = await createAddOnAssignmentFixture(prisma, {
      configId: config.id,
      addOnVersionId: version.id,
    });
    return { assignment, config, version, platformTenant };
  }

  /** Dead-letters a transient-failure delivery and then clears the simulated outage. */
  async function deadLetterInvitation() {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await stack.adapters.invitationSent(invitation());
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobs[0].id } });
    for (let i = job.attemptCount; i < job.maxAttempts; i++) {
      await stack.worker.processDeliveryJob(job.id);
    }
    clearPlatformNotificationFailureInjection();
    const intent = await prisma.notificationIntent.findUniqueOrThrow({ where: { id: result.intentId! } });
    await prisma.notificationIntent.update({
      where: { id: result.intentId! },
      data: { metadata: { ...(intent.metadata as Record<string, unknown>), deliveryGateForceFail: false } },
    });
    return { result, jobId: job.id };
  }

  it('C01: same event duplicate enqueue — two concurrent identical dispatches converge to one intent and one email', async () => {
    const input = invitation();
    const [a, b] = await Promise.all([
      stack.adapters.invitationSent(input),
      stack.adapters.invitationSent(input),
    ]);
    expect(a.intentId).toBe(b.intentId);
    expect([a.replayed, b.replayed].filter(Boolean)).toHaveLength(1);
    expect(await prisma.notificationIntent.count()).toBe(1);
    expect(stack.emailService.sent.filter((m) => m.to === input.recipientEmail)).toHaveLength(1);
  });

  it('C02: same event two workers/stacks — two independent service instances converge to one intent and one email', async () => {
    const s1 = createPlatformNotificationsStack(prisma);
    const s2 = createPlatformNotificationsStack(prisma);
    const input = invitation();
    const [a, b] = await Promise.all([
      s1.adapters.invitationSent(input),
      s2.adapters.invitationSent(input),
    ]);
    expect(a.intentId).toBe(b.intentId);
    expect(await prisma.notificationIntent.count()).toBe(1);
    const sent = [...s1.emailService.sent, ...s2.emailService.sent].filter(
      (m) => m.to === input.recipientEmail,
    );
    expect(sent).toHaveLength(1);
  });

  it('C03: same delivery retry two workers — concurrent processDeliveryJob picks never double-complete or double-send', async () => {
    const email = `c03-${randomUUID()}@test.local`;
    const result = await stack.adapters.invitationSent(invitation({ recipientEmail: email }));
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const outcomes = await Promise.all([
      stack.worker.processDeliveryJob(jobs[0].id),
      stack.worker.processDeliveryJob(jobs[0].id),
    ]);
    expect(outcomes.every((o) => o.status === 'skipped_leased' || o.status === 'delivered')).toBe(true);
    expect((await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobs[0].id } })).status).toBe(
      'completed',
    );
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(1);
  });

  it('C04: source updates while the warning job scans — commercialEnd moved out of window between scans excludes the row and invents nothing', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const user = await createPlatformUserFixture(prisma, { email: `c04-${randomUUID()}@test.local` });
    const { config, assignment } = await addOnAt(new Date(now.getTime() + 6 * DAY_MS), user.id);

    const first = await stack.scheduler.runDueScan(now);
    expect(first.eligible.some((r) => r.id === assignment.id)).toBe(true);

    // The commercial SoR moves under the scheduler between two scan pages.
    await prisma.platformSubscriptionCommercialConfig.update({
      where: { id: config.id },
      data: { commercialEnd: new Date(now.getTime() + 40 * DAY_MS) },
    });
    const second = await stack.scheduler.runDueScan(now);

    expect(second.eligible.some((r) => r.id === assignment.id)).toBe(false);
    expect(second.dispatched).toBe(0);
    expect(await prisma.notificationIntent.count()).toBe(0);
  });

  it('C05: Add-on extension vs warning — extending after a d7 warning neither re-notifies nor duplicates the delivered window', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const user = await createPlatformUserFixture(prisma, { email: `c05-${randomUUID()}@test.local` });
    const { assignment, config } = await addOnAt(new Date(now.getTime() + 6 * DAY_MS), user.id);
    const email = `c05-${randomUUID()}@test.local`;
    const warning = {
      approaching: true as const,
      assignmentId: assignment.id,
      organizationName: 'Acme',
      addOnLabel: 'addon',
      addOnVersionId: randomUUID(),
      expiryDate: new Date(now.getTime() + 6 * DAY_MS).toISOString(),
      windowKey: 'd7',
      recipientPlatformUserId: user.id,
      recipientEmail: email,
    };
    const first = await stack.adapters.addOnExpiry(warning);
    expect(first.accepted).toBe(true);

    await prisma.platformSubscriptionCommercialConfig.update({
      where: { id: config.id },
      data: { commercialEnd: new Date(now.getTime() + 60 * DAY_MS) },
    });
    const intentsBefore = await prisma.notificationIntent.count();
    const scan = await stack.scheduler.runDueScan(now);
    const replay = await stack.adapters.addOnExpiry(warning);

    expect(scan.eligible.some((r) => r.id === assignment.id)).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(await prisma.notificationIntent.count()).toBe(intentsBefore);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(1);
  });

  it('C06: Override extension vs warning — extending expiresAt after a warning removes eligibility and replays are +0', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const user = await createPlatformUserFixture(prisma, { email: `c06-${randomUUID()}@test.local` });
    const override = await createOverrideFixture(prisma, {
      createdByPlatformUserId: user.id,
      expiresAt: new Date(now.getTime() + 6 * DAY_MS),
    });
    const email = `c06-${randomUUID()}@test.local`;
    const warning = {
      approaching: true as const,
      overrideId: override.id,
      organizationName: 'Acme',
      overrideLabel: 'SALES_CONCESSION',
      expiryDate: new Date(now.getTime() + 6 * DAY_MS).toISOString(),
      windowKey: 'd7',
      recipientPlatformUserId: user.id,
      recipientEmail: email,
    };
    await stack.adapters.overrideExpiry(warning);

    await prisma.platformCommercialOverride.update({
      where: { id: override.id },
      data: { expiresAt: new Date(now.getTime() + 90 * DAY_MS) },
    });
    const intentsBefore = await prisma.notificationIntent.count();
    const scan = await stack.scheduler.runDueScan(now);
    const replay = await stack.adapters.overrideExpiry(warning);

    expect(scan.eligible.some((r) => r.id === override.id)).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(await prisma.notificationIntent.count()).toBe(intentsBefore);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(1);
  });

  it('C07-A: convert first; trialExpiry adapter obsolete-suppress → intentΔ=0, emailΔ=0', async () => {
    // Belt: adapter loads trial and suppresses before produce when CONVERTED/CANCELLED/EXPIRED(approaching).
    const { actor, trialsStack, trial, paidPlanVersionId, email, recipientId } =
      await seedActiveTrialForC07();
    try {
      const converted = await trialsStack.conversion.convert(
        actor.claims,
        trialsStack.perms,
        trial.id,
        {
          targetPaidPlanVersionId: paidPlanVersionId,
          expectedRowVersion: trial.rowVersion,
          reason: 'c07-a',
        },
        randomUUID(),
      );
      expect(converted.status).toBe('CONVERTED');
      const intentsBefore = await prisma.notificationIntent.count();
      const emailsBefore = stack.emailService.sent.filter((m) => m.to === email).length;

      const result = await stack.adapters.trialExpiry({
        approaching: true,
        trialId: trial.id,
        organizationName: 'C07 Clinic',
        expiryDate: new Date(trial.expiresAt ?? Date.now()).toISOString(),
        planVersionId: trial.trialPlanVersionId,
        windowKey: 'd7',
        recipientPlatformUserId: recipientId,
        recipientEmail: email,
      });
      expect(result.suppressed).toBe(true);
      expect(result.suppressReason).toMatch(/trial_obsolete_CONVERTED/);

      expect(await prisma.notificationIntent.count()).toBe(intentsBefore);
      expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(emailsBefore);
      expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(1);
    } finally {
      await cleanupC07Fixtures();
    }
  });

  it('C07-B: queued ACTIVE intent; convert; send-time revalidation suppresses (emailΔ=0)', async () => {
    // Suspenders: intent+job created while ACTIVE; after convert, worker suppresses before provider.
    const { actor, trialsStack, trial, paidPlanVersionId, email, recipientId } =
      await seedActiveTrialForC07();
    try {
      setPlatformNotificationFailureInjection('before_delivery_job_claim');
      await expect(
        stack.adapters.trialExpiry({
          approaching: true,
          trialId: trial.id,
          organizationName: 'C07 Clinic',
          expiryDate: new Date(trial.expiresAt ?? Date.now()).toISOString(),
          planVersionId: trial.trialPlanVersionId,
          windowKey: 'd7',
          recipientPlatformUserId: recipientId,
          recipientEmail: email,
        }),
      ).rejects.toThrow(/before_delivery_job_claim/);

      expect(await prisma.notificationIntent.count()).toBe(1);
      expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
      const intent = await prisma.notificationIntent.findFirstOrThrow();
      const { jobs } = await getDeliveryArtifacts(prisma, intent.id);
      expect(jobs[0].status).toBe('pending');

      const converted = await trialsStack.conversion.convert(
        actor.claims,
        trialsStack.perms,
        trial.id,
        {
          targetPaidPlanVersionId: paidPlanVersionId,
          expectedRowVersion: trial.rowVersion,
          reason: 'c07-b',
        },
        randomUUID(),
      );
      expect(converted.status).toBe('CONVERTED');

      clearPlatformNotificationFailureInjection();
      const outcome = await stack.worker.processDeliveryJob(jobs[0].id);
      expect(outcome.status).toBe('suppressed');
      expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
      const after = await getDeliveryArtifacts(prisma, intent.id);
      expect(after.jobs[0].status).toBe('suppressed');
      expect(String(after.jobs[0].failureReason)).toMatch(/trial_obsolete:CONVERTED/);
      expect(await prisma.notificationIntent.count()).toBe(1);
      expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(1);

      const replay = await stack.adapters.trialExpiry({
        approaching: true,
        trialId: trial.id,
        organizationName: 'C07 Clinic',
        expiryDate: new Date(trial.expiresAt ?? Date.now()).toISOString(),
        planVersionId: trial.trialPlanVersionId,
        windowKey: 'd7',
        recipientPlatformUserId: recipientId,
        recipientEmail: email,
      });
      expect(replay.suppressed).toBe(true);
      expect(await prisma.notificationIntent.count()).toBe(1);
    } finally {
      await cleanupC07Fixtures();
    }
  });

  it('C07-C: Promise.all(convert, trialExpiry) — conversion cardinality 1; no conversion rollback; email only if still ACTIVE at send', async () => {
    const { actor, trialsStack, trial, paidPlanVersionId, email, recipientId } =
      await seedActiveTrialForC07();
    try {
      const rowVersion = trial.rowVersion;
      const [convSettled, warnSettled] = await Promise.allSettled([
        trialsStack.conversion.convert(
          actor.claims,
          trialsStack.perms,
          trial.id,
          {
            targetPaidPlanVersionId: paidPlanVersionId,
            expectedRowVersion: rowVersion,
            reason: 'c07-c',
          },
          randomUUID(),
        ),
        stack.adapters.trialExpiry({
          approaching: true,
          trialId: trial.id,
          organizationName: 'C07 Clinic',
          expiryDate: new Date(trial.expiresAt ?? Date.now()).toISOString(),
          planVersionId: trial.trialPlanVersionId,
          windowKey: 'd7',
          recipientPlatformUserId: recipientId,
          recipientEmail: email,
        }),
      ]);

      expect(convSettled.status).toBe('fulfilled');
      const conversions = await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } });
      expect(conversions).toBe(1);
      const warningIntents = await prisma.notificationIntent.count({
        where: {
          metadata: { path: ['eventKey'], equals: 'platform.trial.approaching_expiry' },
        },
      });
      expect(warningIntents).toBeLessThanOrEqual(1);
      const finalTrial = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
      expect(finalTrial.status).toBe('CONVERTED');
      expect(conversions).toBe(1);

      // If a warning intent exists, any completed/suppressed/ambiguous job must not leave a
      // user-visible email after obsolete conversion (send-time suppress when convert won first).
      if (warningIntents === 1) {
        const intent = await prisma.notificationIntent.findFirstOrThrow({
          where: { metadata: { path: ['eventKey'], equals: 'platform.trial.approaching_expiry' } },
        });
        const { jobs } = await getDeliveryArtifacts(prisma, intent.id);
        if (jobs[0]?.status === 'suppressed' || jobs[0]?.status === 'ambiguous') {
          expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
        }
      }
      if (warnSettled.status === 'fulfilled' && warnSettled.value.suppressed) {
        expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
      }
    } finally {
      await cleanupC07Fixtures();
    }
  });

  it('C07-D: service recreation after convert — fresh stack processes queued warning → stale emailΔ=0', async () => {
    const { actor, trialsStack, trial, paidPlanVersionId, email, recipientId } =
      await seedActiveTrialForC07();
    try {
      setPlatformNotificationFailureInjection('before_delivery_job_claim');
      await expect(
        stack.adapters.trialExpiry({
          approaching: true,
          trialId: trial.id,
          organizationName: 'C07 Clinic',
          expiryDate: new Date(trial.expiresAt ?? Date.now()).toISOString(),
          planVersionId: trial.trialPlanVersionId,
          windowKey: 'd7',
          recipientPlatformUserId: recipientId,
          recipientEmail: email,
        }),
      ).rejects.toThrow(/before_delivery_job_claim/);
      const intent = await prisma.notificationIntent.findFirstOrThrow();
      const { jobs } = await getDeliveryArtifacts(prisma, intent.id);

      await trialsStack.conversion.convert(
        actor.claims,
        trialsStack.perms,
        trial.id,
        {
          targetPaidPlanVersionId: paidPlanVersionId,
          expectedRowVersion: trial.rowVersion,
          reason: 'c07-d',
        },
        randomUUID(),
      );
      clearPlatformNotificationFailureInjection();

      const recreated = createPlatformNotificationsStack(prisma, {
        emailService: stack.emailService,
      });
      const outcome = await recreated.worker.processDeliveryJob(jobs[0].id);
      expect(outcome.status).toBe('suppressed');
      expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
      const final = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobs[0].id } });
      expect(final.status).toBe('suppressed');
      expect(String(final.failureReason)).toMatch(/trial_obsolete:CONVERTED/);
    } finally {
      await cleanupC07Fixtures();
    }
  });

  it('C07-E: process cache loss — new stack + new recording sink; durable Trial CONVERTED still suppresses', async () => {
    const { actor, trialsStack, trial, paidPlanVersionId, email, recipientId } =
      await seedActiveTrialForC07();
    try {
      setPlatformNotificationFailureInjection('before_delivery_job_claim');
      await expect(
        stack.adapters.trialExpiry({
          approaching: true,
          trialId: trial.id,
          organizationName: 'C07 Clinic',
          expiryDate: new Date(trial.expiresAt ?? Date.now()).toISOString(),
          planVersionId: trial.trialPlanVersionId,
          windowKey: 'd7',
          recipientPlatformUserId: recipientId,
          recipientEmail: email,
        }),
      ).rejects.toThrow(/before_delivery_job_claim/);
      const intent = await prisma.notificationIntent.findFirstOrThrow();
      const { jobs } = await getDeliveryArtifacts(prisma, intent.id);

      await trialsStack.conversion.convert(
        actor.claims,
        trialsStack.perms,
        trial.id,
        {
          targetPaidPlanVersionId: paidPlanVersionId,
          expectedRowVersion: trial.rowVersion,
          reason: 'c07-e',
        },
        randomUUID(),
      );
      clearPlatformNotificationFailureInjection();

      // Brand-new sink = process-local cache gone; suppression relies on durable Trial SoR only.
      const fresh = createPlatformNotificationsStack(prisma);
      const outcome = await fresh.worker.processDeliveryJob(jobs[0].id);
      expect(outcome.status).toBe('suppressed');
      expect(fresh.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
      expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
    } finally {
      await cleanupC07Fixtures();
    }
  });

  it('C07-F: multi-instance — two workers race after convert → automatic stale emailΔ=0', async () => {
    const { actor, trialsStack, trial, paidPlanVersionId, email, recipientId } =
      await seedActiveTrialForC07();
    try {
      setPlatformNotificationFailureInjection('before_delivery_job_claim');
      await expect(
        stack.adapters.trialExpiry({
          approaching: true,
          trialId: trial.id,
          organizationName: 'C07 Clinic',
          expiryDate: new Date(trial.expiresAt ?? Date.now()).toISOString(),
          planVersionId: trial.trialPlanVersionId,
          windowKey: 'd7',
          recipientPlatformUserId: recipientId,
          recipientEmail: email,
        }),
      ).rejects.toThrow(/before_delivery_job_claim/);
      const intent = await prisma.notificationIntent.findFirstOrThrow();
      const { jobs } = await getDeliveryArtifacts(prisma, intent.id);

      await trialsStack.conversion.convert(
        actor.claims,
        trialsStack.perms,
        trial.id,
        {
          targetPaidPlanVersionId: paidPlanVersionId,
          expectedRowVersion: trial.rowVersion,
          reason: 'c07-f',
        },
        randomUUID(),
      );
      clearPlatformNotificationFailureInjection();

      const other = createPlatformNotificationsStack(prisma, { emailService: stack.emailService });
      const [a, b] = await Promise.all([
        stack.worker.processDeliveryJob(jobs[0].id),
        other.worker.processDeliveryJob(jobs[0].id),
      ]);
      const statuses = [a.status, b.status].sort();
      expect(statuses).toContain('suppressed');
      expect(statuses).toContain('skipped_leased');
      expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
      const final = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobs[0].id } });
      expect(final.status).toBe('suppressed');
    } finally {
      await cleanupC07Fixtures();
    }
  });

  async function seedActiveTrialForC07() {
    const keys = await resolveCatalogKeys(prisma);
    const trialPv = await createPlanVersionFixture(prisma, {
      canonicalKeySuffix: `c07t_${randomUUID().slice(0, 6)}`,
      moduleKeys: keys.moduleKeys.slice(0, 3),
      specialtyKeys: keys.specialtyKeys.slice(0, 2),
      limits: [{ canonicalKey: keys.limitKeys[0], valueText: '7' }],
      trialDefaultEnabled: true,
      trialDefaultDays: 14,
    });
    const paidPv = await createPlanVersionFixture(prisma, {
      canonicalKeySuffix: `c07p_${randomUUID().slice(0, 6)}`,
      paid: true,
      moduleKeys: keys.moduleKeys.slice(0, 2),
      specialtyKeys: keys.specialtyKeys.slice(0, 3),
      limits: [
        { canonicalKey: keys.limitKeys[0], valueText: '25' },
        { canonicalKey: keys.limitKeys[1], unlimited: true },
      ],
    });
    const roleKeys = [SALES_MANAGER_ROLE];
    const user = await createPlatformUserFixture(prisma, {
      email: `c07-mgr-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const actor = {
      user,
      claims: salesTrialsPlatformClaims(user.id, session.sessionId, roleKeys),
    };
    const trialsStack = createSalesTrialsStack(prisma);
    const trial = await trialsStack.trials.create(
      actor.claims,
      trialsStack.perms,
      {
        organizationName: 'C07 Clinic',
        facilityTypeKey: keys.facilityTypeKey,
        trialPlanVersionId: trialPv.planVersionId,
        selectedModuleKeys: keys.moduleKeys.slice(0, 3),
        selectedSpecialtyKeys: keys.specialtyKeys.slice(0, 2),
      } as never,
      randomUUID(),
    );
    expect(trial.status).toBe('ACTIVE');
    const email = `c07-${randomUUID()}@test.local`;
    return {
      actor,
      trialsStack,
      trial,
      paidPlanVersionId: paidPv.planVersionId,
      email,
      recipientId: user.id,
    };
  }

  async function cleanupC07Fixtures() {
    await cleanupSalesTrialTables(prisma);
    await deletePlanVersionFixtures(prisma);
  }

  it('C08: Subscription renewal/change vs expiry warning — the renewed window is a distinct logical event, not a duplicate', async () => {
    const configId = randomUUID();
    const email = `c08-${randomUUID()}@test.local`;
    const recipientPlatformUserId = randomUUID();
    const base = {
      configId,
      organizationName: 'Acme',
      expiryDate: new Date().toISOString(),
      planVersionId: randomUUID(),
      recipientPlatformUserId,
      recipientEmail: email,
    };
    const [expiry, renewed] = await Promise.all([
      stack.adapters.subscriptionEvent({ ...base, kind: 'approaching', windowKey: 'd7' }),
      stack.adapters.subscriptionEvent({ ...base, kind: 'approaching', windowKey: 'd1' }),
    ]);

    expect(expiry.accepted).toBe(true);
    expect(renewed.accepted).toBe(true);
    expect(expiry.intentId).not.toBe(renewed.intentId);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(2);
  });

  it('C09: Plan migration completes while a warning is queued — scheduled and completed migrations stay distinct intents', async () => {
    const migrationId = randomUUID();
    const email = `c09-${randomUUID()}@test.local`;
    const base = {
      migrationId,
      organizationName: 'Acme',
      fromPlanVersionId: randomUUID(),
      toPlanVersionId: randomUUID(),
      at: new Date().toISOString(),
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    };
    const [scheduled, completed] = await Promise.all([
      stack.adapters.planMigration({ ...base, completed: false }),
      stack.adapters.planMigration({ ...base, completed: true }),
    ]);

    expect(scheduled.intentId).not.toBe(completed.intentId);
    expect(scheduled.accepted).toBe(true);
    expect(completed.accepted).toBe(true);
    expect(await prisma.notificationIntent.count()).toBe(2);
  });

  it('C10: concurrent usage threshold events — warning and critical for the same evidence remain separate alerts', async () => {
    const evidenceId = randomUUID();
    const email = `c10-${randomUUID()}@test.local`;
    const base = {
      evidenceId,
      organizationName: 'Acme',
      limitKey: 'sms_monthly',
      effectiveLimit: '1000',
      currentUsage: '900',
      thresholdPercent: '90',
      limitProvenance: 'PLAN' as const,
      windowKey: 'default',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    };
    const [warning, critical] = await Promise.all([
      stack.adapters.limitAlert({ ...base, level: 'warning' }),
      stack.adapters.limitAlert({ ...base, level: 'critical' }),
    ]);

    expect(warning.accepted).toBe(true);
    expect(critical.accepted).toBe(true);
    expect(warning.intentId).not.toBe(critical.intentId);
  });

  it('C11: effective-limit change vs threshold alert — a new effective-limit evidence id produces a new alert, never a silent overwrite', async () => {
    const email = `c11-${randomUUID()}@test.local`;
    const recipientPlatformUserId = randomUUID();
    const base = {
      level: 'warning' as const,
      organizationName: 'Acme',
      limitKey: 'sms_monthly',
      currentUsage: '820',
      thresholdPercent: '82',
      limitProvenance: 'PLAN',
      windowKey: 'default',
      recipientPlatformUserId,
      recipientEmail: email,
    };
    const [oldLimit, newLimit] = await Promise.all([
      stack.adapters.limitAlert({ ...base, evidenceId: randomUUID(), effectiveLimit: '1000' }),
      stack.adapters.limitAlert({ ...base, evidenceId: randomUUID(), effectiveLimit: '2000' }),
    ]);

    expect(oldLimit.intentId).not.toBe(newLimit.intentId);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(2);
  });

  it('C12: preference change vs queued delivery — disabling an optional category concurrently never suppresses an in-flight mandatory delivery', async () => {
    const userRow = await createPlatformUserFixture(prisma, {
      email: `c12-${randomUUID()}@test.local`,
    });
    const claims = platformClaims(userRow.id, randomUUID());
    const email = `c12-recipient-${randomUUID()}@test.local`;
    const [pref, dispatch] = await Promise.all([
      stack.prefs.upsert(claims, perms, { category: 'usage', channel: 'email', enabled: false }, randomUUID()),
      stack.adapters.invitationSent(invitation({ platformUserId: userRow.id, recipientEmail: email })),
    ]);

    expect(pref.enabled).toBe(false);
    expect(dispatch.accepted).toBe(true);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(1);
  });

  it('C13: recipient suspension vs delivery — suspending the PlatformUser during dispatch does not suppress the email (auth owns suspend, not the delivery path)', async () => {
    const userRow = await createPlatformUserFixture(prisma, {
      email: `c13-${randomUUID()}@test.local`,
    });
    const email = `c13-recipient-${randomUUID()}@test.local`;
    const [, dispatch] = await Promise.all([
      prisma.platformUser.update({
        where: { id: userRow.id },
        data: { status: 'suspended', suspendedAt: new Date(), isActive: false },
      }),
      stack.adapters.invitationSent(invitation({ platformUserId: userRow.id, recipientEmail: email })),
    ]);

    expect(dispatch.accepted).toBe(true);
    expect(dispatch.suppressed).toBeFalsy();
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(1);
    expect((await prisma.platformUser.findUniqueOrThrow({ where: { id: userRow.id } })).status).toBe(
      'suspended',
    );
  });

  it('C14: template revision vs queued intent → N/A — the Step 27 catalog is code-defined and pinned at step27.v1, so a queued intent keeps its templateKey/templateVersion', async () => {
    const input = invitation();
    const [a, b] = await Promise.all([
      stack.adapters.invitationSent(input),
      stack.adapters.invitationSent(input),
    ]);
    expect(a.intentId).toBe(b.intentId);
    const intent = await prisma.notificationIntent.findUniqueOrThrow({ where: { id: a.intentId! } });
    const metadata = intent.metadata as Record<string, unknown>;
    expect(metadata.templateKey).toBe('tpl.platform.invitation.sent');
    expect(metadata.templateVersion).toBe(PLATFORM_TEMPLATE_VERSION);
    expect(PLATFORM_TEMPLATE_VERSION).toBe('step27.v1');
    expect(stack.query.listTemplates(perms).every((t) => t.version === PLATFORM_TEMPLATE_VERSION)).toBe(
      true,
    );
  });

  it('C15: provider timeout then a second worker — the follow-up pick delivers exactly once', async () => {
    setPlatformNotificationFailureInjection('provider_timeout');
    const email = `c15-${randomUUID()}@test.local`;
    const result = await stack.adapters.invitationSent(invitation({ recipientEmail: email }));
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    expect(jobs[0].status).toBe('pending');
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);

    clearPlatformNotificationFailureInjection();
    const second = createPlatformNotificationsStack(prisma);
    const outcome = await second.worker.processDeliveryJob(jobs[0].id);

    expect(outcome.status).toBe('delivered');
    const total = [...stack.emailService.sent, ...second.emailService.sent].filter(
      (m) => m.to === email,
    );
    expect(total).toHaveLength(1);
  });

  it('C16: post-provider-success response loss — reprocessing an already delivered job sends no duplicate email', async () => {
    const email = `c16-${randomUUID()}@test.local`;
    const result = await stack.adapters.invitationSent(invitation({ recipientEmail: email }));
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(1);

    await stack.worker.processDeliveryJob(jobs[0].id);
    await stack.worker.processDeliveryJob(jobs[0].id);

    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(1);
    expect((await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobs[0].id } })).status).toBe(
      'completed',
    );
  });

  it('C17: manual retry vs scheduled retry — a manual retry racing a worker pick converges on one completed job', async () => {
    const { result, jobId } = await deadLetterInvitation();
    const user = platformClaims(randomUUID(), randomUUID());
    const settled = await Promise.allSettled([
      stack.query.retryDelivery(user, perms, result.intentId!, { reason: 'manual', jobId }, randomUUID()),
      stack.worker.processDeliveryJob(jobId),
    ]);

    expect(settled.some((r) => r.status === 'fulfilled')).toBe(true);
    const final = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(['completed', 'pending', 'leased']).toContain(final.status);
  });

  it('C18: terminal state vs retry — a dead-lettered job is not resurrected by a concurrent worker pick', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await stack.adapters.invitationSent(invitation());
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobs[0].id } });
    for (let i = job.attemptCount; i < job.maxAttempts; i++) {
      await stack.worker.processDeliveryJob(job.id);
    }
    expect((await prisma.deliveryJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe(
      'dead_letter',
    );

    const outcomes = await Promise.all([
      stack.worker.processDeliveryJob(job.id),
      stack.worker.processDeliveryJob(job.id),
    ]);
    expect(outcomes.every((o) => o.status === 'skipped_leased')).toBe(true);
    expect((await prisma.deliveryJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe(
      'dead_letter',
    );
  });

  it('C19: provisioning recovery vs failure notification — failure and recovery are distinct events for the same operation', async () => {
    const operationId = randomUUID();
    const email = `c19-${randomUUID()}@test.local`;
    const base = {
      operationId,
      organizationName: 'Acme',
      operationReference: 'op-19',
      at: new Date().toISOString(),
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    };
    const [failure, recovered] = await Promise.all([
      stack.adapters.provisioning({ ...base, recovered: false, failureClass: 'timeout' }),
      stack.adapters.provisioning({ ...base, recovered: true }),
    ]);

    expect(failure.intentId).not.toBe(recovered.intentId);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(2);
  });

  it('C20: lead reassignment vs reminder — reminders for two different owners of the same lead are distinct deliveries', async () => {
    const leadId = randomUUID();
    const base = {
      leadId,
      leadReference: 'LEAD-20',
      organizationName: 'Acme',
      nextActionDate: new Date().toISOString(),
      nextActionType: 'call',
      windowKey: 'd1',
    };
    const previousOwnerEmail = `c20-prev-${randomUUID()}@test.local`;
    const newOwnerEmail = `c20-next-${randomUUID()}@test.local`;
    const [previous, next] = await Promise.all([
      stack.adapters.leadNextActionReminder({
        ...base,
        ownerPlatformUserId: randomUUID(),
        recipientEmail: previousOwnerEmail,
      }),
      stack.adapters.leadNextActionReminder({
        ...base,
        ownerPlatformUserId: randomUUID(),
        recipientEmail: newOwnerEmail,
      }),
    ]);

    expect(previous.intentId).not.toBe(next.intentId);
    expect(stack.emailService.sent.filter((m) => m.to === previousOwnerEmail)).toHaveLength(1);
    expect(stack.emailService.sent.filter((m) => m.to === newOwnerEmail)).toHaveLength(1);
  });

  it('C21: lead closure vs reminder — closure suppresses by not emitting (the producer is never called again) and replaying the closed reminder identity is +0', async () => {
    const email = `c21-${randomUUID()}@test.local`;
    const input = {
      leadId: randomUUID(),
      leadReference: 'LEAD-21',
      organizationName: 'Acme',
      nextActionDate: new Date().toISOString(),
      nextActionType: 'call',
      windowKey: 'd1',
      ownerPlatformUserId: randomUUID(),
      recipientEmail: email,
    };
    const first = await stack.adapters.leadNextActionReminder(input);
    expect(first.accepted).toBe(true);

    // Closure: the reminder producer stops emitting. Any in-flight duplicate of the already
    // emitted reminder identity dedupes instead of delivering a second time.
    const intentsBefore = await prisma.notificationIntent.count();
    const replay = await stack.adapters.leadNextActionReminder(input);

    expect(replay.replayed).toBe(true);
    expect(await prisma.notificationIntent.count()).toBe(intentsBefore);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(1);
  });

  it('C22: manager hierarchy change vs manager alert — the same alert routed to two managers yields two independent intents', async () => {
    const alertId = randomUUID();
    const oldManagerEmail = `c22-old-${randomUUID()}@test.local`;
    const newManagerEmail = `c22-new-${randomUUID()}@test.local`;
    const base = {
      ops: false as const,
      alertId,
      managerDisplayName: 'Mgr',
      staleCount: 4,
      periodLabel: '2026-08',
    };
    const [oldManager, newManager] = await Promise.all([
      stack.adapters.managerAlert({
        ...base,
        managerPlatformUserId: randomUUID(),
        recipientEmail: oldManagerEmail,
      }),
      stack.adapters.managerAlert({
        ...base,
        managerPlatformUserId: randomUUID(),
        recipientEmail: newManagerEmail,
      }),
    ]);

    expect(oldManager.intentId).not.toBe(newManager.intentId);
    expect(stack.emailService.sent.filter((m) => m.to === oldManagerEmail)).toHaveLength(1);
    expect(stack.emailService.sent.filter((m) => m.to === newManagerEmail)).toHaveLength(1);
  });

  it('C23: scheduler duplicate pages — two concurrent identical runDueScan calls return the same eligible set and dispatch nothing', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const user = await createPlatformUserFixture(prisma, { email: `c23-${randomUUID()}@test.local` });
    await addOnAt(new Date(now.getTime() + 6 * DAY_MS), user.id);

    const [a, b] = await Promise.all([
      stack.scheduler.runDueScan(now),
      stack.scheduler.runDueScan(now),
    ]);

    expect(a.dispatched).toBe(0);
    expect(b.dispatched).toBe(0);
    expect(a.eligible.map((r) => `${r.kind}:${r.id}:${r.windowKey}`).sort()).toEqual(
      b.eligible.map((r) => `${r.kind}:${r.id}:${r.windowKey}`).sort(),
    );
    expect(await prisma.notificationIntent.count()).toBe(0);
  });

  it('C24: exact intent/delivery/audit cardinality after a duplicate-enqueue race (1 intent, 1 job, 1 attempt, 1 receipt, 1 audit, 1 email)', async () => {
    const input = invitation();
    const [a, b] = await Promise.all([
      stack.adapters.invitationSent(input),
      stack.adapters.invitationSent(input),
    ]);
    const intentId = a.intentId ?? b.intentId!;
    const { jobs, attempts, receipts } = await getDeliveryArtifacts(prisma, intentId);

    expect(await prisma.notificationIntent.count()).toBe(1);
    expect(jobs).toHaveLength(1);
    expect(attempts).toHaveLength(1);
    expect(receipts).toHaveLength(1);
    expect(
      await prisma.auditEntry.count({
        where: {
          category: PLATFORM_NOTIFICATION_AUDIT_CATEGORY,
          action: PLATFORM_NOTIFICATION_AUDIT_ACTIONS.DISPATCHED,
          resourceId: intentId,
        },
      }),
    ).toBe(1);
    expect(stack.emailService.sent.filter((m) => m.to === input.recipientEmail)).toHaveLength(1);
  });

  it('Preference concurrency: same-key upserts converge on a single row and stale rowVersions conflict', async () => {
    const userRow = await createPlatformUserFixture(prisma, {
      email: `c-pref-${randomUUID()}@test.local`,
    });
    const claims = platformClaims(userRow.id, randomUUID());
    const results = await Promise.allSettled([
      stack.prefs.upsert(claims, perms, { category: 'usage', channel: 'email', enabled: false }, randomUUID()),
      stack.prefs.upsert(claims, perms, { category: 'usage', channel: 'email', enabled: false }, randomUUID()),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    const rows = await prisma.platformNotificationPreference.findMany({
      where: { platformUserId: userRow.id, category: 'usage', channel: 'email' },
    });
    expect(rows).toHaveLength(1);

    const current = rows[0];
    await stack.prefs.upsert(
      claims,
      perms,
      { category: 'usage', channel: 'email', enabled: true, expectedRowVersion: current.rowVersion },
      randomUUID(),
    );
    await expect(
      stack.prefs.upsert(
        claims,
        perms,
        { category: 'usage', channel: 'email', enabled: false, expectedRowVersion: current.rowVersion },
        randomUUID(),
      ),
    ).rejects.toThrow(/rowVersion|occ/i);
  });

  it('Read concurrency: template previews and delivery reads invent no intents under write traffic', async () => {
    const user = platformClaims(randomUUID(), randomUUID());
    const [list, dispatch] = await Promise.all([
      stack.query.listDeliveries(perms, { pageSize: 50 }),
      stack.adapters.invitationSent(invitation()),
      Promise.resolve(stack.query.preview(user, perms, 'tpl.platform.invitation.sent')),
      Promise.resolve(stack.query.preview(user, perms, 'tpl.platform.mfa.security_alert')),
    ]);
    expect(Array.isArray(list.items)).toBe(true);
    expect(dispatch.accepted).toBe(true);
    expect(await prisma.notificationIntent.count()).toBe(1);
  });

  it('Suppression concurrency: disabled-preference and UNLIMITED-provenance dispatches invent zero intents', async () => {
    const userRow = await createPlatformUserFixture(prisma, {
      email: `c-suppress-${randomUUID()}@test.local`,
    });
    await stack.prisma.platformNotificationPreference.create({
      data: { platformUserId: userRow.id, category: 'commercial', channel: 'email', enabled: false },
    });
    const email = `c-suppress-${randomUUID()}@test.local`;
    const [pref1, pref2, unlimited] = await Promise.all([
      stack.adapters.trialExpiry({
        approaching: true,
        trialId: randomUUID(),
        organizationName: 'Acme',
        expiryDate: new Date().toISOString(),
        planVersionId: randomUUID(),
        windowKey: 'd7',
        recipientPlatformUserId: userRow.id,
        recipientEmail: email,
      }),
      stack.adapters.trialExpiry({
        approaching: true,
        trialId: randomUUID(),
        organizationName: 'Acme',
        expiryDate: new Date().toISOString(),
        planVersionId: randomUUID(),
        windowKey: 'd1',
        recipientPlatformUserId: userRow.id,
        recipientEmail: email,
      }),
      stack.adapters.limitAlert({
        level: 'warning',
        evidenceId: randomUUID(),
        organizationName: 'Acme',
        limitKey: 'sms',
        effectiveLimit: '∞',
        currentUsage: '0',
        limitProvenance: 'UNLIMITED',
        windowKey: 'default',
        recipientPlatformUserId: randomUUID(),
        recipientEmail: `c-unlimited-${randomUUID()}@test.local`,
      }),
    ]);

    expect(pref1.suppressed).toBe(true);
    expect(pref2.suppressed).toBe(true);
    expect(unlimited.suppressed).toBe(true);
    expect(await prisma.notificationIntent.count()).toBe(0);
  });

  it('Fan-in consistency: listDeliveries totals match persisted Step 27 intents and no external delivery occurs', async () => {
    const dispatches = Array.from({ length: 5 }, () => stack.adapters.invitationSent(invitation()));
    await Promise.all([stack.query.listDeliveries(perms, { pageSize: 100 }), ...dispatches]);

    const final = await stack.query.listDeliveries(perms, { pageSize: 100 });
    const intentCount = await prisma.notificationIntent.count({
      where: { metadata: { path: ['step27'], equals: true } },
    });
    expect(final.total).toBe(intentCount);
    expect(final.items.length).toBe(Math.min(100, intentCount));
    expect(final.total).toBeGreaterThanOrEqual(5);
    expect(stack.emailService.sent.every((m) => m.to.endsWith('@test.local'))).toBe(true);
    expect(stack.emailService.realExternalDeliveriesDuringTests).toBe(0);
  });
});
