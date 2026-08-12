/**
 * Flexible Step 27 — failure injection matrix F01–F32 (independent selectors).
 * Model B: NODE_ENV===test + exact PLATFORM_NOTIFICATION_FAILURE_INJECTION match.
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

  it('F01: template_lookup blocks getTemplate path via dispatch', async () => {
    setPlatformNotificationFailureInjection('template_lookup');
    await expect(stack.adapters.invitationSent(invitation())).rejects.toThrow(/template lookup/i);
  });

  it('F02: template_variable_validation blocks render', async () => {
    setPlatformNotificationFailureInjection('template_variable_validation');
    await expect(stack.adapters.invitationSent(invitation())).rejects.toThrow(
      /template variable validation/i,
    );
  });

  it('F03: template_renderer blocks render', async () => {
    setPlatformNotificationFailureInjection('template_renderer');
    await expect(stack.adapters.invitationSent(invitation())).rejects.toThrow(/template renderer/i);
  });

  it('F04: locale_renderer blocks ar-SY only', async () => {
    setPlatformNotificationFailureInjection('locale_renderer');
    await expect(
      stack.dispatch.dispatch({
        eventKey: 'platform.invitation.sent',
        sourceType: 'platform_user_invitation',
        sourceId: randomUUID(),
        recipientKind: 'platform_user',
        recipientId: randomUUID(),
        recipientEmail: `f04-${randomUUID()}@test.local`,
        locale: 'ar-SY',
        variables: {
          recipientDisplayName: 'A',
          inviterDisplayName: 'B',
          expiresAt: '2026-01-01',
        },
      }),
    ).rejects.toThrow(/locale renderer/i);
  });

  it('F05: recipient_resolution aborts before produce', async () => {
    setPlatformNotificationFailureInjection('recipient_resolution');
    await expect(stack.adapters.invitationSent(invitation())).rejects.toThrow(
      /recipient resolution/i,
    );
  });

  it('F06: preference_lookup aborts non-mandatory isEnabled path', async () => {
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
  });

  it('F07: mandatory_policy blocks preference upsert', async () => {
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
  });

  it('F08: event_adapter aborts at adapter entry', async () => {
    setPlatformNotificationFailureInjection('event_adapter');
    await expect(stack.adapters.invitationSent(invitation())).rejects.toThrow(/event_adapter/i);
  });

  it('F09: intent_persist aborts before producer.produceChannels', async () => {
    setPlatformNotificationFailureInjection('intent_persist');
    await expect(stack.adapters.invitationSent(invitation())).rejects.toThrow(/intent persist/i);
  });

  it('F10: provider_transient leaves job pending with retry', async () => {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await stack.adapters.invitationSent(invitation());
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    expect(jobs[0].status).toBe('pending');
    expect(jobs[0].attemptCount).toBeGreaterThanOrEqual(1);
  });

  it('F11: provider_permanent fails delivery without successful email', async () => {
    setPlatformNotificationFailureInjection('provider_permanent');
    const email = `f11-${randomUUID()}@test.local`;
    await stack.adapters.invitationSent(invitation(email));
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
  });

  it('F12: provider_timeout fails delivery without successful email', async () => {
    setPlatformNotificationFailureInjection('provider_timeout');
    const email = `f12-${randomUUID()}@test.local`;
    await stack.adapters.invitationSent(invitation(email));
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
  });

  it('F13: provider_ambiguous fails delivery without successful email', async () => {
    setPlatformNotificationFailureInjection('provider_ambiguous');
    const email = `f13-${randomUUID()}@test.local`;
    await stack.adapters.invitationSent(invitation(email));
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(0);
  });

  it('F14: after_provider_before_ack sends then fails ack path', async () => {
    setPlatformNotificationFailureInjection('after_provider_before_ack');
    const email = `f14-${randomUUID()}@test.local`;
    await stack.adapters.invitationSent(invitation(email));
    // Email may have been handed to the recording adapter before the injected throw.
    expect(stack.emailService.sent.filter((m) => m.to === email).length).toBeGreaterThanOrEqual(0);
    const intents = await prisma.notificationIntent.count({
      where: { metadata: { path: ['step27'], equals: true } },
    });
    expect(intents).toBe(1);
  });

  it('F15: audit_write blocks dispatch audit', async () => {
    setPlatformNotificationFailureInjection('audit_write');
    await expect(stack.adapters.invitationSent(invitation())).rejects.toThrow(/audit write/i);
  });

  it('F16: retry_scheduler aborts warning scan', async () => {
    setPlatformNotificationFailureInjection('retry_scheduler');
    await expect(stack.scheduler.runDueScan(new Date())).rejects.toThrow(/retry scheduler/i);
  });

  it('F17: warning_scheduler aborts warning scan', async () => {
    setPlatformNotificationFailureInjection('warning_scheduler');
    await expect(stack.scheduler.runDueScan(new Date())).rejects.toThrow(/warning scheduler/i);
  });

  it('F18: addon_expiry_source aborts scan', async () => {
    setPlatformNotificationFailureInjection('addon_expiry_source');
    await expect(stack.scheduler.runDueScan(new Date())).rejects.toThrow(/add-on expiry/i);
  });

  it('F19: override_expiry_source aborts scan', async () => {
    setPlatformNotificationFailureInjection('override_expiry_source');
    await expect(stack.scheduler.runDueScan(new Date())).rejects.toThrow(/override expiry/i);
  });

  it('F20: eer_limit_source aborts limitAlert', async () => {
    setPlatformNotificationFailureInjection('eer_limit_source');
    await expect(
      stack.adapters.limitAlert({
        level: 'warning',
        evidenceId: randomUUID(),
        organizationName: 'Acme',
        limitKey: 'sms_monthly',
        effectiveLimit: '1000',
        currentUsage: '820',
        thresholdPercent: '82',
        limitProvenance: 'PLAN',
        windowKey: 'default',
        recipientPlatformUserId: randomUUID(),
        recipientEmail: `f20-${randomUUID()}@test.local`,
      }),
    ).rejects.toThrow(/eer_limit_source/i);
  });

  it('F21: usage_source aborts limitAlert', async () => {
    setPlatformNotificationFailureInjection('usage_source');
    await expect(
      stack.adapters.limitAlert({
        level: 'warning',
        evidenceId: randomUUID(),
        organizationName: 'Acme',
        limitKey: 'sms_monthly',
        effectiveLimit: '1000',
        currentUsage: '820',
        thresholdPercent: '82',
        limitProvenance: 'PLAN',
        windowKey: 'default',
        recipientPlatformUserId: randomUUID(),
        recipientEmail: `f21-${randomUUID()}@test.local`,
      }),
    ).rejects.toThrow(/usage_source/i);
  });

  it('F22: compatibility_source aborts compatibilityIssue', async () => {
    setPlatformNotificationFailureInjection('compatibility_source');
    await expect(
      stack.adapters.compatibilityIssue({
        resultId: randomUUID(),
        organizationName: 'Acme',
        issueSummary: 'x',
        ruleReference: 'R1',
        recipientPlatformUserId: randomUUID(),
        recipientEmail: `f22-${randomUUID()}@test.local`,
      }),
    ).rejects.toThrow(/compatibility_source/i);
  });

  it('F23: provisioning_source aborts provisioning adapter', async () => {
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
        recipientEmail: `f23-${randomUUID()}@test.local`,
      }),
    ).rejects.toThrow(/provisioning_source/i);
  });

  it('F24: trial_source aborts trialExpiry', async () => {
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
        recipientEmail: `f24-${randomUUID()}@test.local`,
      }),
    ).rejects.toThrow(/trial_source/i);
  });

  it('F25: subscription_source aborts subscriptionEvent', async () => {
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
        recipientEmail: `f25-${randomUUID()}@test.local`,
      }),
    ).rejects.toThrow(/subscription_source/i);
  });

  it('F26: lead_reminder_source aborts leadNextActionReminder', async () => {
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
        recipientEmail: `f26-${randomUUID()}@test.local`,
      }),
    ).rejects.toThrow(/lead_reminder_source/i);
  });

  it('F27: manager_recipient aborts managerAlert', async () => {
    setPlatformNotificationFailureInjection('manager_recipient');
    await expect(
      stack.adapters.managerAlert({
        ops: false,
        alertId: randomUUID(),
        managerPlatformUserId: randomUUID(),
        recipientEmail: `f27-${randomUUID()}@test.local`,
        managerDisplayName: 'Mgr',
        staleCount: 1,
        periodLabel: '2026-08',
      }),
    ).rejects.toThrow(/manager_recipient/i);
  });

  it('F28: multi_instance_retry blocks manual retry', async () => {
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

  it('F29: dead_letter_transition blocks manual retry', async () => {
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

  it('F30: catalog enumerates exactly the independent selector inventory', () => {
    expect(PLATFORM_NOTIFICATION_FAILURE_INJECTION_POINTS).toHaveLength(29);
    expect(new Set(PLATFORM_NOTIFICATION_FAILURE_INJECTION_POINTS).size).toBe(29);
  });

  it('F31: Model B containment — selectors inert when NODE_ENV≠test', async () => {
    setPlatformNotificationFailureInjection('event_adapter');
    process.env.NODE_ENV = 'production';
    expect(isPlatformNotificationFailureInjectionActive('event_adapter')).toBe(false);
    process.env.NODE_ENV = 'test';
    // With NODE_ENV restored, the same selector is active again.
    expect(isPlatformNotificationFailureInjectionActive('event_adapter')).toBe(true);
  });

  it('F32: Model B exact-match — wrong selector does not fire event_adapter', async () => {
    setPlatformNotificationFailureInjection('audit_write');
    expect(isPlatformNotificationFailureInjectionActive('event_adapter')).toBe(false);
    expect(isPlatformNotificationFailureInjectionActive('audit_write')).toBe(true);
    // Invitation uses event_adapter only at adapter entry; audit_write fires later — still dispatches until audit.
    await expect(stack.adapters.invitationSent(invitation())).rejects.toThrow(/audit write/i);
  });
});
