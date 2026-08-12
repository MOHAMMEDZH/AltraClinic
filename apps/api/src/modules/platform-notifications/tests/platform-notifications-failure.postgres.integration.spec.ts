/**
 * Flexible Step 27 — failure injection matrix F01–F32 (gate Part 6 selector order).
 * Model B containment: a selector only fires when NODE_ENV === 'test' AND
 * PLATFORM_NOTIFICATION_FAILURE_INJECTION matches it exactly (proven by the unnumbered
 * `Model B: ...` tests at the end of this suite).
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
  createPlatformDbSecurityClient,
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
  PLATFORM_NOTIFICATION_FAILURE_INJECTION_POINTS,
  isPlatformNotificationFailureInjectionActive,
} from '../platform-notifications.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 27 failure injection F01-F32 (PostgreSQL)', () => {
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
    clearPlatformNotificationFailureInjection();
    process.env.NODE_ENV = 'test';
  });

  function invitation(email = `f-${randomUUID()}@test.local`) {
    return {
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: email,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    };
  }

  function limitAlertInput(email: string) {
    return {
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
  }

  it('F01: template_lookup — catalog lookup failure aborts dispatch before any intent exists', async () => {
    setPlatformNotificationFailureInjection('template_lookup');
    await expect(stack.adapters.invitationSent(invitation())).rejects.toThrow(/template lookup/i);
    expect(await prisma.notificationIntent.count()).toBe(0);
  });

  it('F02: template_variable_validation — variable validation failure aborts before render output is used', async () => {
    setPlatformNotificationFailureInjection('template_variable_validation');
    await expect(stack.adapters.invitationSent(invitation())).rejects.toThrow(
      /template variable validation/i,
    );
    expect(await prisma.notificationIntent.count()).toBe(0);
  });

  it('F03: template_renderer — renderer failure aborts dispatch (no partial message persisted)', async () => {
    setPlatformNotificationFailureInjection('template_renderer');
    await expect(stack.adapters.invitationSent(invitation())).rejects.toThrow(/template renderer/i);
    expect(await prisma.notificationMessage.count()).toBe(0);
  });

  it('F04: locale_renderer — ar-SY localized render fails while en-US stays unaffected', async () => {
    setPlatformNotificationFailureInjection('locale_renderer');
    const base = {
      eventKey: 'platform.invitation.sent' as const,
      sourceType: 'platform_user_invitation',
      recipientKind: 'platform_user' as const,
      variables: { recipientDisplayName: 'A', inviterDisplayName: 'B', expiresAt: '2026-01-01' },
    };
    await expect(
      stack.dispatch.dispatch({
        ...base,
        sourceId: randomUUID(),
        recipientId: randomUUID(),
        recipientEmail: `f04-ar-${randomUUID()}@test.local`,
        locale: 'ar-SY',
      }),
    ).rejects.toThrow(/locale renderer/i);

    const enUs = await stack.dispatch.dispatch({
      ...base,
      sourceId: randomUUID(),
      recipientId: randomUUID(),
      recipientEmail: `f04-en-${randomUUID()}@test.local`,
      locale: 'en-US',
    });
    expect(enUs.accepted).toBe(true);
  });

  it('F05: recipient_resolution — recipient resolution failure aborts before produce', async () => {
    setPlatformNotificationFailureInjection('recipient_resolution');
    await expect(stack.adapters.invitationSent(invitation())).rejects.toThrow(
      /recipient resolution/i,
    );
    expect(await prisma.notificationIntent.count()).toBe(0);
  });

  it('F06: preference_lookup — preference read failure aborts the optional-category path', async () => {
    setPlatformNotificationFailureInjection('preference_lookup');
    await expect(
      stack.adapters.trialExpiry({
        approaching: true,
        trialId: randomUUID(),
        organizationName: 'Acme',
        expiryDate: new Date().toISOString(),
        planVersionId: randomUUID(),
        windowKey: 'd7',
        recipientPlatformUserId: randomUUID(),
        recipientEmail: `f06-${randomUUID()}@test.local`,
      }),
    ).rejects.toThrow(/preference lookup/i);
    expect(await prisma.notificationIntent.count()).toBe(0);
  });

  it('F07: mandatory_policy — mandatory-category policy evaluation failure blocks the preference mutation', async () => {
    setPlatformNotificationFailureInjection('mandatory_policy');
    const user = platformClaims(randomUUID(), randomUUID());
    await expect(
      stack.prefs.upsert(
        user,
        perms,
        { category: 'usage', channel: 'email', enabled: false },
        randomUUID(),
      ),
    ).rejects.toThrow(/mandatory policy/i);
    expect(await prisma.platformNotificationPreference.count()).toBe(0);
  });

  it('F08: event_adapter — adapter-entry failure aborts before the dispatch service is reached', async () => {
    setPlatformNotificationFailureInjection('event_adapter');
    await expect(stack.adapters.invitationSent(invitation())).rejects.toThrow(/event_adapter/i);
    expect(await prisma.notificationIntent.count()).toBe(0);
  });

  it('F09: N/A — Phase 41d has no separate Step 27 outbox claim; orchestrator queues DeliveryJob in-process (no distinct claim failure selector)', async () => {
    // There is no outbox/claim seam to inject: the catalog exposes no such selector, the Prisma
    // schema has no outbox model, and DeliveryOrchestratorService creates the DeliveryJob rows
    // in-process during produce (then the worker leases them optimistically).
    expect(
      PLATFORM_NOTIFICATION_FAILURE_INJECTION_POINTS.filter((p) => /outbox|claim/i.test(p)),
    ).toHaveLength(0);
    expect((prisma as unknown as Record<string, unknown>).notificationOutbox).toBeUndefined();

    const result = await stack.adapters.invitationSent(invitation());
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe('completed');
    // Lease-based claim (not an outbox row) is the only claim primitive, and it is idempotent.
    expect(await stack.worker.processDeliveryJob(jobs[0].id)).toEqual({ status: 'skipped_leased' });
  });

  it('F10: intent_persist — intent persistence failure aborts before producer.produceChannels', async () => {
    setPlatformNotificationFailureInjection('intent_persist');
    await expect(stack.adapters.invitationSent(invitation())).rejects.toThrow(/intent persist/i);
    expect(await prisma.notificationIntent.count()).toBe(0);
    expect(await prisma.deliveryJob.count()).toBe(0);
  });

  it('F11: N/A — no independent delivery-attempt persistence selector exists in the Step 27 catalog (attempt rows are written inside the provider path; that seam is covered by F12–F16)', async () => {
    expect(
      PLATFORM_NOTIFICATION_FAILURE_INJECTION_POINTS.filter((p) => /attempt/i.test(p)),
    ).toHaveLength(0);

    // Attempt rows are persisted on both outcomes, which is why a dedicated failure selector is
    // unnecessary: any provider selector already exercises the persistence path.
    const ok = await stack.adapters.invitationSent(invitation());
    const okArtifacts = await getDeliveryArtifacts(prisma, ok.intentId!);
    expect(okArtifacts.attempts).toHaveLength(1);
    expect(okArtifacts.attempts[0].success).toBe(true);

    setPlatformNotificationFailureInjection('provider_permanent');
    const failed = await stack.adapters.invitationSent(invitation());
    const failedArtifacts = await getDeliveryArtifacts(prisma, failed.intentId!);
    expect(failedArtifacts.attempts).toHaveLength(1);
    expect(failedArtifacts.attempts[0].success).toBe(false);
  });

  it('F12: provider_transient — transient provider failure leaves the job pending with a scheduled retry', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await stack.adapters.invitationSent(invitation());
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    expect(jobs[0].status).toBe('pending');
    expect(jobs[0].attemptCount).toBeGreaterThanOrEqual(1);
    expect(jobs[0].scheduledAt).not.toBeNull();
  });

  it('F13: provider_permanent — permanent provider failure dead-letters the job with no successful email', async () => {
    setPlatformNotificationFailureInjection('provider_permanent');
    const email = `f13-${randomUUID()}@test.local`;
    const result = await stack.adapters.invitationSent(invitation(email));
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    expect(jobs[0].status).toBe('dead_letter');
    expect(jobs[0].deadLetteredAt).not.toBeNull();
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
  });

  it('F14: provider_timeout — timeout is classified retryable and no email is delivered', async () => {
    setPlatformNotificationFailureInjection('provider_timeout');
    const email = `f14-${randomUUID()}@test.local`;
    const result = await stack.adapters.invitationSent(invitation(email));
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    expect(jobs[0].status).toBe('pending');
    expect(String(jobs[0].failureReason)).toMatch(/provider_timeout/);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
  });

  it('F15: provider_ambiguous — ambiguous provider response never counts as delivered', async () => {
    setPlatformNotificationFailureInjection('provider_ambiguous');
    const email = `f15-${randomUUID()}@test.local`;
    const result = await stack.adapters.invitationSent(invitation(email));
    const { jobs, receipts } = await getDeliveryArtifacts(prisma, result.intentId!);
    expect(jobs[0].status).not.toBe('completed');
    expect(receipts.every((r) => r.status !== 'DELIVERED')).toBe(true);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
  });

  it('F16: after_provider_before_ack — provider accepted but acknowledgement failed leaves exactly one logical intent (no duplicate fan-out)', async () => {
    setPlatformNotificationFailureInjection('after_provider_before_ack');
    const email = `f16-${randomUUID()}@test.local`;
    await stack.adapters.invitationSent(invitation(email));
    // The email may have reached the recording sink before the injected post-send throw; what must
    // never happen is a second logical intent / duplicate fan-out for the same event.
    expect(stack.emailService.sent.filter((m) => m.to === email).length).toBeLessThanOrEqual(1);
    expect(
      await prisma.notificationIntent.count({ where: { metadata: { path: ['step27'], equals: true } } }),
    ).toBe(1);
  });

  it('F17: audit_write — audit persistence failure aborts the admin-visible dispatch record', async () => {
    setPlatformNotificationFailureInjection('audit_write');
    await expect(stack.adapters.invitationSent(invitation())).rejects.toThrow(/audit write/i);
    expect(
      await prisma.auditEntry.count({
        where: {
          category: PLATFORM_NOTIFICATION_AUDIT_CATEGORY,
          action: PLATFORM_NOTIFICATION_AUDIT_ACTIONS.DISPATCHED,
        },
      }),
    ).toBe(0);
  });

  it('F18: retry_scheduler — retry scheduler failure aborts the scheduled scan', async () => {
    setPlatformNotificationFailureInjection('retry_scheduler');
    await expect(stack.scheduler.runDueScan(new Date())).rejects.toThrow(/retry scheduler/i);
  });

  it('F19: warning_scheduler — warning scheduler failure aborts the scheduled scan', async () => {
    setPlatformNotificationFailureInjection('warning_scheduler');
    await expect(stack.scheduler.runDueScan(new Date())).rejects.toThrow(/warning scheduler/i);
  });

  it('F20: addon_expiry_source — Add-on expiry source failure aborts the scan and the Add-on adapter', async () => {
    setPlatformNotificationFailureInjection('addon_expiry_source');
    await expect(stack.scheduler.runDueScan(new Date())).rejects.toThrow(/add-on expiry/i);
    await expect(
      stack.adapters.addOnExpiry({
        approaching: true,
        assignmentId: randomUUID(),
        organizationName: 'Acme',
        addOnLabel: 'addon',
        addOnVersionId: randomUUID(),
        expiryDate: new Date().toISOString(),
        windowKey: 'd7',
        recipientPlatformUserId: randomUUID(),
        recipientEmail: `f20-${randomUUID()}@test.local`,
      }),
    ).rejects.toThrow(/addon_expiry_source/i);
  });

  it('F21: override_expiry_source — Override expiry source failure aborts the scan and the Override adapter', async () => {
    setPlatformNotificationFailureInjection('override_expiry_source');
    await expect(stack.scheduler.runDueScan(new Date())).rejects.toThrow(/override expiry/i);
    await expect(
      stack.adapters.overrideExpiry({
        approaching: true,
        overrideId: randomUUID(),
        organizationName: 'Acme',
        overrideLabel: 'SALES_CONCESSION',
        expiryDate: new Date().toISOString(),
        windowKey: 'd7',
        recipientPlatformUserId: randomUUID(),
        recipientEmail: `f21-${randomUUID()}@test.local`,
      }),
    ).rejects.toThrow(/override_expiry_source/i);
  });

  it('F22: eer_limit_source — effective-limit evidence source failure aborts the limit alert', async () => {
    setPlatformNotificationFailureInjection('eer_limit_source');
    await expect(
      stack.adapters.limitAlert(limitAlertInput(`f22-${randomUUID()}@test.local`)),
    ).rejects.toThrow(/eer_limit_source/i);
  });

  it('F23: usage_source — usage counter source failure aborts the limit alert', async () => {
    setPlatformNotificationFailureInjection('usage_source');
    await expect(
      stack.adapters.limitAlert(limitAlertInput(`f23-${randomUUID()}@test.local`)),
    ).rejects.toThrow(/usage_source/i);
  });

  it('F24: compatibility_source — catalog compatibility source failure aborts the compatibility alert', async () => {
    setPlatformNotificationFailureInjection('compatibility_source');
    await expect(
      stack.adapters.compatibilityIssue({
        resultId: randomUUID(),
        organizationName: 'Acme',
        issueSummary: 'x',
        ruleReference: 'R1',
        recipientPlatformUserId: randomUUID(),
        recipientEmail: `f24-${randomUUID()}@test.local`,
      }),
    ).rejects.toThrow(/compatibility_source/i);
  });

  it('F25: provisioning_source — provisioning operation source failure aborts the provisioning notification', async () => {
    setPlatformNotificationFailureInjection('provisioning_source');
    await expect(
      stack.adapters.provisioning({
        recovered: false,
        operationId: randomUUID(),
        organizationName: 'Acme',
        operationReference: 'OP-1',
        failureClass: 'timeout',
        at: new Date().toISOString(),
        recipientPlatformUserId: randomUUID(),
        recipientEmail: `f25-${randomUUID()}@test.local`,
      }),
    ).rejects.toThrow(/provisioning_source/i);
  });

  it('F26: trial_source — Trial source failure aborts the Trial expiry notification', async () => {
    setPlatformNotificationFailureInjection('trial_source');
    await expect(
      stack.adapters.trialExpiry({
        approaching: true,
        trialId: randomUUID(),
        organizationName: 'Acme',
        expiryDate: new Date().toISOString(),
        planVersionId: randomUUID(),
        windowKey: 'd7',
        recipientPlatformUserId: randomUUID(),
        recipientEmail: `f26-${randomUUID()}@test.local`,
      }),
    ).rejects.toThrow(/trial_source/i);
  });

  it('F27: subscription_source — subscription/plan-migration source failure aborts both subscription adapters', async () => {
    setPlatformNotificationFailureInjection('subscription_source');
    await expect(
      stack.adapters.subscriptionEvent({
        kind: 'approaching',
        configId: randomUUID(),
        organizationName: 'Acme',
        expiryDate: new Date().toISOString(),
        planVersionId: randomUUID(),
        windowKey: 'd7',
        recipientPlatformUserId: randomUUID(),
        recipientEmail: `f27-${randomUUID()}@test.local`,
      }),
    ).rejects.toThrow(/subscription_source/i);
    await expect(
      stack.adapters.planMigration({
        completed: true,
        migrationId: randomUUID(),
        organizationName: 'Acme',
        fromPlanVersionId: randomUUID(),
        toPlanVersionId: randomUUID(),
        at: new Date().toISOString(),
        recipientPlatformUserId: randomUUID(),
        recipientEmail: `f27b-${randomUUID()}@test.local`,
      }),
    ).rejects.toThrow(/subscription_source/i);
  });

  it('F28: lead_reminder_source — lead reminder source failure aborts lead and demo reminders', async () => {
    setPlatformNotificationFailureInjection('lead_reminder_source');
    await expect(
      stack.adapters.leadNextActionReminder({
        leadId: randomUUID(),
        leadReference: 'L1',
        organizationName: 'Acme',
        nextActionDate: new Date().toISOString(),
        nextActionType: 'call',
        windowKey: 'default',
        ownerPlatformUserId: randomUUID(),
        recipientEmail: `f28-${randomUUID()}@test.local`,
      }),
    ).rejects.toThrow(/lead_reminder_source/i);
    await expect(
      stack.adapters.demoReminder({
        leadId: randomUUID(),
        leadReference: 'L2',
        organizationName: 'Acme',
        demoScheduledAt: new Date().toISOString(),
        windowKey: 'default',
        ownerPlatformUserId: randomUUID(),
        recipientEmail: `f28b-${randomUUID()}@test.local`,
      }),
    ).rejects.toThrow(/lead_reminder_source/i);
  });

  it('F29: manager_recipient — manager recipient resolution failure aborts the manager alert', async () => {
    setPlatformNotificationFailureInjection('manager_recipient');
    await expect(
      stack.adapters.managerAlert({
        ops: false,
        alertId: randomUUID(),
        managerPlatformUserId: randomUUID(),
        recipientEmail: `f29-${randomUUID()}@test.local`,
        managerDisplayName: 'Mgr',
        staleCount: 1,
        periodLabel: '2026-08',
      }),
    ).rejects.toThrow(/manager_recipient/i);
  });

  it('F30: service recreation / cache-loss replay — a durable write survives losing every in-process service and sink', async () => {
    const email = `f30-${randomUUID()}@test.local`;
    const input = invitation(email);
    const first = await stack.adapters.invitationSent(input);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(1);

    stack.emailService.reset();
    const rebooted = createPlatformNotificationsStack(prisma);
    const intentsBefore = await prisma.notificationIntent.count();

    const replay = await rebooted.adapters.invitationSent(input);

    expect(replay.replayed).toBe(true);
    expect(replay.intentId).toBe(first.intentId);
    expect(await prisma.notificationIntent.count()).toBe(intentsBefore);
    expect(rebooted.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
  });

  it('F31: multi_instance_retry — competing retry claim failure blocks the manual retry', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await stack.adapters.invitationSent(invitation());
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    setPlatformNotificationFailureInjection('multi_instance_retry');
    const user = platformClaims(randomUUID(), randomUUID());
    await expect(
      stack.query.retryDelivery(
        user,
        perms,
        result.intentId!,
        { reason: 'ops', jobId: jobs[0].id },
        randomUUID(),
      ),
    ).rejects.toThrow(/multi-instance retry/i);
  });

  it('F32: dead_letter_transition — dead-letter transition failure blocks the manual retry', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await stack.adapters.invitationSent(invitation());
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    setPlatformNotificationFailureInjection('dead_letter_transition');
    const user = platformClaims(randomUUID(), randomUUID());
    await expect(
      stack.query.retryDelivery(
        user,
        perms,
        result.intentId!,
        { reason: 'ops', jobId: jobs[0].id },
        randomUUID(),
      ),
    ).rejects.toThrow(/dead-letter/i);
  });

  it('Model B: catalog enumerates exactly the independent selector inventory', () => {
    expect(PLATFORM_NOTIFICATION_FAILURE_INJECTION_POINTS).toHaveLength(29);
    expect(new Set(PLATFORM_NOTIFICATION_FAILURE_INJECTION_POINTS).size).toBe(29);
  });

  it('Model B: selectors are inert when NODE_ENV is not test', () => {
    setPlatformNotificationFailureInjection('event_adapter');
    process.env.NODE_ENV = 'production';
    expect(isPlatformNotificationFailureInjectionActive('event_adapter')).toBe(false);
    process.env.NODE_ENV = 'test';
    expect(isPlatformNotificationFailureInjectionActive('event_adapter')).toBe(true);
  });

  it('Model B: selection is exact-match only (a different selector never fires another point)', async () => {
    setPlatformNotificationFailureInjection('audit_write');
    expect(isPlatformNotificationFailureInjectionActive('event_adapter')).toBe(false);
    expect(isPlatformNotificationFailureInjectionActive('audit_write')).toBe(true);
    // The invitation path passes the event_adapter gate untouched and only fails at the audit write.
    await expect(stack.adapters.invitationSent(invitation())).rejects.toThrow(/audit write/i);
  });
});
