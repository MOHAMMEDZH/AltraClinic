/**
 * Flexible Step 27 — concurrency matrix C01–C24.
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
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  ensureSentinel,
  getDeliveryArtifacts,
  platformClaims,
  platformDbSecurityEnabled,
  setPlatformNotificationFailureInjection,
} from './platform-notifications-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

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

  it('C01: concurrent identical invitation dispatches converge to one email', async () => {
    const input = invitation();
    const [a, b] = await Promise.all([
      stack.adapters.invitationSent(input),
      stack.adapters.invitationSent(input),
    ]);
    expect(a.intentId).toBe(b.intentId);
    expect(stack.emailService.sent.filter((m) => m.to === input.recipientEmail)).toHaveLength(1);
  });

  it('C02: concurrent distinct invitations both succeed', async () => {
    const email = `c02-${randomUUID()}@test.local`;
    const [a, b] = await Promise.all([
      stack.adapters.invitationSent(invitation({ recipientEmail: email })),
      stack.adapters.invitationSent(invitation({ recipientEmail: email })),
    ]);
    expect(a.intentId).not.toBe(b.intentId);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(2);
  });

  it('C03: concurrent preference upserts with same key converge without duplicate rows', async () => {
    const userRow = await createPlatformUserFixture(prisma, {
      email: `c03-${randomUUID()}@test.local`,
    });
    const claims = platformClaims(userRow.id, randomUUID());
    const results = await Promise.allSettled([
      stack.prefs.upsert(
        claims,
        perms,
        { category: 'usage', channel: 'email', enabled: false },
        randomUUID(),
      ),
      stack.prefs.upsert(
        claims,
        perms,
        { category: 'usage', channel: 'email', enabled: false },
        randomUUID(),
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    const rows = await prisma.platformNotificationPreference.findMany({
      where: { platformUserId: userRow.id, category: 'usage', channel: 'email' },
    });
    expect(rows).toHaveLength(1);
  });

  it('C04: preference OCC conflict when expectedRowVersion is stale', async () => {
    const userRow = await createPlatformUserFixture(prisma, {
      email: `c04-${randomUUID()}@test.local`,
    });
    const claims = platformClaims(userRow.id, randomUUID());
    const first = await stack.prefs.upsert(
      claims,
      perms,
      { category: 'usage', channel: 'email', enabled: false },
      randomUUID(),
    );
    await stack.prefs.upsert(
      claims,
      perms,
      { category: 'usage', channel: 'email', enabled: true, expectedRowVersion: first.rowVersion },
      randomUUID(),
    );
    await expect(
      stack.prefs.upsert(
        claims,
        perms,
        { category: 'usage', channel: 'email', enabled: false, expectedRowVersion: first.rowVersion },
        randomUUID(),
      ),
    ).rejects.toThrow(/rowVersion|occ/i);
  });

  it('C05: concurrent warning scans are read-only and do not invent dispatches', async () => {
    const [a, b] = await Promise.all([
      stack.scheduler.runDueScan(new Date()),
      stack.scheduler.runDueScan(new Date()),
    ]);
    expect(a.dispatched).toBe(0);
    expect(b.dispatched).toBe(0);
  });

  it('C06: concurrent d7/d1 trial windows remain distinct intents', async () => {
    const trialId = randomUUID();
    const email = `c06-${randomUUID()}@test.local`;
    const recipient = randomUUID();
    const [d7, d1] = await Promise.all([
      stack.adapters.trialExpiry({
        approaching: true,
        trialId,
        organizationName: 'Acme',
        expiryDate: new Date().toISOString(),
        planVersionId: randomUUID(),
        windowKey: 'd7',
        recipientPlatformUserId: recipient,
        recipientEmail: email,
      }),
      stack.adapters.trialExpiry({
        approaching: true,
        trialId,
        organizationName: 'Acme',
        expiryDate: new Date().toISOString(),
        planVersionId: randomUUID(),
        windowKey: 'd1',
        recipientPlatformUserId: recipient,
        recipientEmail: email,
      }),
    ]);
    expect(d7.intentId).not.toBe(d1.intentId);
  });

  it('C07: concurrent listDeliveries reads are stable under write traffic', async () => {
    await stack.adapters.invitationSent(invitation());
    const [list, dispatch] = await Promise.all([
      stack.query.listDeliveries(perms, { pageSize: 50 }),
      stack.adapters.invitationSent(invitation()),
    ]);
    expect(list.items.length).toBeGreaterThanOrEqual(1);
    expect(dispatch.accepted).toBe(true);
  });

  it('C08: concurrent retries on same job converge safely', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await stack.adapters.invitationSent(invitation());
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    clearPlatformNotificationFailureInjection();
    const intent = await prisma.notificationIntent.findUniqueOrThrow({
      where: { id: result.intentId! },
    });
    await prisma.notificationIntent.update({
      where: { id: result.intentId! },
      data: {
        metadata: { ...(intent.metadata as Record<string, unknown>), deliveryGateForceFail: false },
      },
    });
    const user = platformClaims(randomUUID(), randomUUID());
    const settled = await Promise.allSettled([
      stack.query.retryDelivery(
        user,
        perms,
        result.intentId!,
        { reason: 'a', jobId: jobs[0].id },
        randomUUID(),
      ),
      stack.query.retryDelivery(
        user,
        perms,
        result.intentId!,
        { reason: 'b', jobId: jobs[0].id },
        randomUUID(),
      ),
    ]);
    expect(settled.some((r) => r.status === 'fulfilled')).toBe(true);
  });

  it('C09: two stacks sharing one Prisma client still dedupe', async () => {
    const s1 = createPlatformNotificationsStack(prisma);
    const s2 = createPlatformNotificationsStack(prisma);
    const input = invitation();
    const [a, b] = await Promise.all([
      s1.adapters.invitationSent(input),
      s2.adapters.invitationSent(input),
    ]);
    expect(a.intentId).toBe(b.intentId);
  });

  it('C10: concurrent preference disable + mandatory security dispatch still delivers', async () => {
    const userRow = await createPlatformUserFixture(prisma, {
      email: `c10-${randomUUID()}@test.local`,
    });
    const claims = platformClaims(userRow.id, randomUUID());
    const email = `c10-${randomUUID()}@test.local`;
    const [pref, dispatch] = await Promise.all([
      stack.prefs.upsert(
        claims,
        perms,
        { category: 'usage', channel: 'email', enabled: false },
        randomUUID(),
      ),
      stack.adapters.invitationSent(
        invitation({ platformUserId: userRow.id, recipientEmail: email }),
      ),
    ]);
    expect(pref.enabled).toBe(false);
    expect(dispatch.accepted).toBe(true);
    expect(stack.emailService.sent.some((m) => m.to === email)).toBe(true);
  });

  it('C11: concurrent template previews do not invent intents', async () => {
    const user = platformClaims(randomUUID(), randomUUID());
    await Promise.all([
      Promise.resolve(stack.query.preview(user, perms, 'tpl.platform.invitation.sent')),
      Promise.resolve(stack.query.preview(user, perms, 'tpl.platform.invitation.sent')),
    ]);
    expect(await prisma.notificationIntent.count()).toBe(0);
  });

  it('C12: concurrent limit warning + critical for same evidence both accept', async () => {
    const evidenceId = randomUUID();
    const email = `c12-${randomUUID()}@test.local`;
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
    const [w, c] = await Promise.all([
      stack.adapters.limitAlert({ ...base, level: 'warning' }),
      stack.adapters.limitAlert({ ...base, level: 'critical' }),
    ]);
    expect(w.accepted).toBe(true);
    expect(c.accepted).toBe(true);
    expect(w.intentId).not.toBe(c.intentId);
  });

  it('C13: concurrent getDelivery reads while retry runs', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await stack.adapters.invitationSent(invitation());
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    clearPlatformNotificationFailureInjection();
    const intent = await prisma.notificationIntent.findUniqueOrThrow({
      where: { id: result.intentId! },
    });
    await prisma.notificationIntent.update({
      where: { id: result.intentId! },
      data: {
        metadata: { ...(intent.metadata as Record<string, unknown>), deliveryGateForceFail: false },
      },
    });
    const user = platformClaims(randomUUID(), randomUUID());
    const [detail] = await Promise.all([
      stack.query.getDelivery(perms, result.intentId!),
      stack.query.retryDelivery(
        user,
        perms,
        result.intentId!,
        { reason: 'race', jobId: jobs[0].id },
        randomUUID(),
      ),
    ]);
    expect(detail.id).toBe(result.intentId);
  });

  it('C14: realExternalDeliveriesDuringTests remains 0 under concurrency', async () => {
    const email = `c14-${randomUUID()}@test.local`;
    await Promise.all([
      stack.adapters.invitationSent(invitation({ recipientEmail: email })),
      stack.adapters.invitationSent(invitation({ recipientEmail: email })),
      stack.adapters.invitationSent(invitation({ recipientEmail: email })),
    ]);
    // RecordingTransactionalEmailService is the only send sink — no network adapter.
    expect(stack.emailService.sent.every((m) => m.to.endsWith('@test.local'))).toBe(true);
    expect(stack.emailService.realExternalDeliveriesDuringTests).toBe(0);
  });

  it('C15: concurrent suppressed preference dispatches invent zero intents', async () => {
    const userRow = await createPlatformUserFixture(prisma, {
      email: `c15-${randomUUID()}@test.local`,
    });
    await stack.prisma.platformNotificationPreference.create({
      data: {
        platformUserId: userRow.id,
        category: 'commercial',
        channel: 'email',
        enabled: false,
      },
    });
    const email = `c15-${randomUUID()}@test.local`;
    const [a, b] = await Promise.all([
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
    ]);
    expect(a.suppressed).toBe(true);
    expect(b.suppressed).toBe(true);
    expect(await prisma.notificationIntent.count()).toBe(0);
  });

  it('C16: concurrent processDeliveryJob picks do not double-complete a finished job', async () => {
    const result = await stack.adapters.invitationSent(invitation());
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const outcomes = await Promise.all([
      stack.worker.processDeliveryJob(jobs[0].id),
      stack.worker.processDeliveryJob(jobs[0].id),
    ]);
    expect(outcomes.every((o) => o.status === 'skipped_leased' || o.status === 'delivered')).toBe(
      true,
    );
    const final = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobs[0].id } });
    expect(final.status).toBe('completed');
  });

  it('C17: concurrent N01+N02 distinct events', async () => {
    const email = `c17-${randomUUID()}@test.local`;
    const [inv, mfa] = await Promise.all([
      stack.adapters.invitationSent(invitation({ recipientEmail: email })),
      stack.adapters.mfaSecurityAlert({
        alertId: randomUUID(),
        platformUserId: randomUUID(),
        recipientEmail: email,
        recipientDisplayName: 'Admin',
        alertSummary: 'login',
        occurredAt: new Date().toISOString(),
      }),
    ]);
    expect(inv.intentId).not.toBe(mfa.intentId);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(2);
  });

  it('C18: concurrent preference list+upsert', async () => {
    const userRow = await createPlatformUserFixture(prisma, {
      email: `c18-${randomUUID()}@test.local`,
    });
    const claims = platformClaims(userRow.id, randomUUID());
    const [list, upsert] = await Promise.all([
      stack.prefs.list(claims, perms),
      stack.prefs.upsert(
        claims,
        perms,
        { category: 'usage', channel: 'email', enabled: false },
        randomUUID(),
      ),
    ]);
    expect(Array.isArray(list)).toBe(true);
    expect(upsert.enabled).toBe(false);
  });

  it('C19: concurrent warning scan + addon dispatch', async () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const DAY_MS = 24 * 60 * 60 * 1000;
    const userRow = await createPlatformUserFixture(prisma, {
      email: `c19-${randomUUID()}@test.local`,
    });
    const { platformTenant } = await createClinicTenantFixture(prisma);
    const config = await createCommercialConfigFixture(prisma, {
      platformTenantId: platformTenant.id,
      createdByPlatformUserId: userRow.id,
      commercialEnd: new Date(now.getTime() + 6 * DAY_MS),
    });
    const version = await createAddOnVersionFixture(prisma);
    const assignment = await createAddOnAssignmentFixture(prisma, {
      configId: config.id,
      addOnVersionId: version.id,
    });
    const email = `c19-${randomUUID()}@test.local`;
    const [scan, dispatch] = await Promise.all([
      stack.scheduler.runDueScan(now),
      stack.adapters.addOnExpiry({
        approaching: true,
        assignmentId: assignment.id,
        organizationName: 'Acme',
        addOnLabel: 'addon',
        addOnVersionId: version.id,
        expiryDate: new Date(now.getTime() + 6 * DAY_MS).toISOString(),
        windowKey: 'd7',
        recipientPlatformUserId: userRow.id,
        recipientEmail: email,
      }),
    ]);
    expect(scan.dispatched).toBe(0);
    expect(dispatch.accepted).toBe(true);
  });

  it('C20: two stacks (true multi-instance) same invitation → 1 email', async () => {
    const s1 = createPlatformNotificationsStack(prisma);
    const s2 = createPlatformNotificationsStack(prisma);
    const input = invitation();
    const [a, b] = await Promise.all([
      s1.adapters.invitationSent(input),
      s2.adapters.invitationSent(input),
    ]);
    expect(a.intentId).toBe(b.intentId);
    const sent = [...s1.emailService.sent, ...s2.emailService.sent].filter(
      (m) => m.to === input.recipientEmail,
    );
    expect(sent.length).toBe(1);
  });

  it('C21: concurrent template previews under injection clear', async () => {
    clearPlatformNotificationFailureInjection();
    const user = platformClaims(randomUUID(), randomUUID());
    await Promise.all([
      Promise.resolve(stack.query.preview(user, perms, 'tpl.platform.invitation.sent')),
      Promise.resolve(stack.query.preview(user, perms, 'tpl.platform.mfa.security_alert')),
    ]);
    expect(await prisma.notificationIntent.count()).toBe(0);
  });

  it('C22: concurrent dead-letter manual retries converge', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await stack.adapters.invitationSent(invitation());
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobs[0].id } });
    for (let i = job.attemptCount; i < job.maxAttempts; i++) {
      await stack.worker.processDeliveryJob(job.id);
    }
    clearPlatformNotificationFailureInjection();
    const intent = await prisma.notificationIntent.findUniqueOrThrow({
      where: { id: result.intentId! },
    });
    await prisma.notificationIntent.update({
      where: { id: result.intentId! },
      data: {
        metadata: { ...(intent.metadata as Record<string, unknown>), deliveryGateForceFail: false },
      },
    });
    const user = platformClaims(randomUUID(), randomUUID());
    const settled = await Promise.allSettled([
      stack.query.retryDelivery(
        user,
        perms,
        result.intentId!,
        { reason: 'c22a', jobId: jobs[0].id },
        randomUUID(),
      ),
      stack.query.retryDelivery(
        user,
        perms,
        result.intentId!,
        { reason: 'c22b', jobId: jobs[0].id },
        randomUUID(),
      ),
    ]);
    expect(settled.some((r) => r.status === 'fulfilled')).toBe(true);
    const final = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobs[0].id } });
    expect(['completed', 'pending', 'dead_letter']).toContain(final.status);
  });

  it('C23: concurrent limitAlert UNLIMITED suppressions invent 0 intents', async () => {
    const [a, b] = await Promise.all([
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
        recipientEmail: `c23a-${randomUUID()}@test.local`,
      }),
      stack.adapters.limitAlert({
        level: 'critical',
        evidenceId: randomUUID(),
        organizationName: 'Acme',
        limitKey: 'sms',
        effectiveLimit: '∞',
        currentUsage: '0',
        limitProvenance: 'UNLIMITED',
        windowKey: 'default',
        recipientPlatformUserId: randomUUID(),
        recipientEmail: `c23b-${randomUUID()}@test.local`,
      }),
    ]);
    expect(a.suppressed).toBe(true);
    expect(b.suppressed).toBe(true);
    expect(await prisma.notificationIntent.count()).toBe(0);
  });

  it('C24: high fan-in listDeliveries under concurrent dispatches remains consistent', async () => {
    const dispatches = Array.from({ length: 5 }, () =>
      stack.adapters.invitationSent(invitation()),
    );
    await Promise.all([
      stack.query.listDeliveries(perms, { pageSize: 100 }),
      ...dispatches,
    ]);
    // After fan-in settles, listDeliveries must match persisted Step 27 intents consistently.
    const final = await stack.query.listDeliveries(perms, { pageSize: 100 });
    const intentCount = await prisma.notificationIntent.count({
      where: { metadata: { path: ['step27'], equals: true } },
    });
    expect(final.total).toBe(intentCount);
    expect(final.items.length).toBe(Math.min(100, intentCount));
    expect(final.total).toBeGreaterThanOrEqual(5);
  });
});
