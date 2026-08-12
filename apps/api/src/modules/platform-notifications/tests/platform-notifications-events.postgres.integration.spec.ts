/**
 * Flexible Step 27 — event adapter matrix N01–N24.
 * Each case drives one `PlatformNotificationEventAdapters` method end to end through the real
 * Phase 41d engine (producer → orchestrator → synchronous worker in NODE_ENV=test) and asserts
 * the outcome (accepted/suppressed), the recorded email, and the recoverable template key.
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
  platformDbSecurityEnabled,
} from './platform-notifications-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 27 event matrix N01-N24 (PostgreSQL)', () => {
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

  async function templateKeyFor(intentId: string | undefined): Promise<string | null> {
    if (!intentId) return null;
    const perms: ReadonlySet<string> = new Set(NOTIFICATIONS_ADMIN_PERMS);
    const list = await stack.query.listDeliveries(perms, { pageSize: 100 });
    const row = list.items.find((i) => i.id === intentId);
    return (row?.templateKey as string) ?? null;
  }

  it('N01: invitation.sent dispatches mandatory security email', async () => {
    const email = `n01-${randomUUID()}@test.local`;
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: email,
      recipientDisplayName: 'New Admin',
      inviterDisplayName: 'Root Admin',
      expiresAt: new Date().toISOString(),
    });
    expect(result.accepted).toBe(true);
    expect(stack.emailService.sent).toHaveLength(1);
    expect(stack.emailService.sent[0].to).toBe(email);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.invitation.sent');
  });

  it('N02: mfa.security_alert dispatches mandatory security email', async () => {
    const email = `n02-${randomUUID()}@test.local`;
    const result = await stack.adapters.mfaSecurityAlert({
      alertId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: email,
      recipientDisplayName: 'Admin',
      alertSummary: 'New device login',
      occurredAt: new Date().toISOString(),
    });
    expect(result.accepted).toBe(true);
    expect(stack.emailService.sent[0].to).toBe(email);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.mfa.security_alert');
  });

  it('N03: tenant.lifecycle_transition dispatches mandatory lifecycle email', async () => {
    const email = `n03-${randomUUID()}@test.local`;
    const result = await stack.adapters.lifecycleTransition({
      platformTenantId: randomUUID(),
      organizationName: 'Acme Clinic',
      fromState: 'TRIAL',
      toState: 'ACTIVE',
      occurredAt: new Date().toISOString(),
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(stack.emailService.sent[0].text).toContain('ACTIVE');
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.tenant.lifecycle');
  });

  it('N04: trial.approaching_expiry dispatches non-mandatory commercial email', async () => {
    const email = `n04-${randomUUID()}@test.local`;
    const result = await stack.adapters.trialExpiry({
      approaching: true,
      trialId: randomUUID(),
      organizationName: 'Acme Clinic',
      expiryDate: new Date().toISOString(),
      planVersionId: randomUUID(),
      windowKey: 'd7',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.trial.approaching_expiry');
  });

  it('N05: trial.expired dispatches non-mandatory commercial email', async () => {
    const email = `n05-${randomUUID()}@test.local`;
    const result = await stack.adapters.trialExpiry({
      approaching: false,
      trialId: randomUUID(),
      organizationName: 'Acme Clinic',
      expiryDate: new Date().toISOString(),
      planVersionId: randomUUID(),
      windowKey: 'expired',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.trial.expired');
  });

  it('N06: subscription.approaching_expiry dispatches', async () => {
    const email = `n06-${randomUUID()}@test.local`;
    const result = await stack.adapters.subscriptionEvent({
      kind: 'approaching',
      configId: randomUUID(),
      organizationName: 'Acme Clinic',
      expiryDate: new Date().toISOString(),
      planVersionId: randomUUID(),
      windowKey: 'd7',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.subscription.approaching_expiry');
  });

  it('N07: subscription.expired dispatches', async () => {
    const email = `n07-${randomUUID()}@test.local`;
    const result = await stack.adapters.subscriptionEvent({
      kind: 'expired',
      configId: randomUUID(),
      organizationName: 'Acme Clinic',
      expiryDate: new Date().toISOString(),
      planVersionId: randomUUID(),
      windowKey: 'expired',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.subscription.expired');
  });

  it('N08: plan_version.migration_scheduled dispatches', async () => {
    const email = `n08-${randomUUID()}@test.local`;
    const result = await stack.adapters.planMigration({
      completed: false,
      migrationId: randomUUID(),
      organizationName: 'Acme Clinic',
      fromPlanVersionId: randomUUID(),
      toPlanVersionId: randomUUID(),
      at: new Date().toISOString(),
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.plan_version.migration_scheduled');
  });

  it('N09: plan_version.migration_completed dispatches', async () => {
    const email = `n09-${randomUUID()}@test.local`;
    const result = await stack.adapters.planMigration({
      completed: true,
      migrationId: randomUUID(),
      organizationName: 'Acme Clinic',
      fromPlanVersionId: randomUUID(),
      toPlanVersionId: randomUUID(),
      at: new Date().toISOString(),
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.plan_version.migration_completed');
  });

  it('N10: addon.approaching_expiry dispatches', async () => {
    const email = `n10-${randomUUID()}@test.local`;
    const result = await stack.adapters.addOnExpiry({
      approaching: true,
      assignmentId: randomUUID(),
      organizationName: 'Acme Clinic',
      addOnLabel: 'addon.sms_pack',
      addOnVersionId: randomUUID(),
      expiryDate: new Date().toISOString(),
      windowKey: 'd7',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.addon.approaching_expiry');
  });

  it('N11: addon.expired dispatches', async () => {
    const email = `n11-${randomUUID()}@test.local`;
    const result = await stack.adapters.addOnExpiry({
      approaching: false,
      assignmentId: randomUUID(),
      organizationName: 'Acme Clinic',
      addOnLabel: 'addon.sms_pack',
      addOnVersionId: randomUUID(),
      expiryDate: new Date().toISOString(),
      windowKey: 'expired',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.addon.expired');
  });

  it('N12: override.approaching_expiry dispatches', async () => {
    const email = `n12-${randomUUID()}@test.local`;
    const result = await stack.adapters.overrideExpiry({
      approaching: true,
      overrideId: randomUUID(),
      organizationName: 'Acme Clinic',
      overrideLabel: 'SALES_CONCESSION',
      expiryDate: new Date().toISOString(),
      windowKey: 'd1',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.override.approaching_expiry');
  });

  it('N13: override.expired dispatches', async () => {
    const email = `n13-${randomUUID()}@test.local`;
    const result = await stack.adapters.overrideExpiry({
      approaching: false,
      overrideId: randomUUID(),
      organizationName: 'Acme Clinic',
      overrideLabel: 'SALES_CONCESSION',
      expiryDate: new Date().toISOString(),
      windowKey: 'expired',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.override.expired');
  });

  it('N14: limit.warning_threshold dispatches', async () => {
    const email = `n14-${randomUUID()}@test.local`;
    const result = await stack.adapters.limitAlert({
      level: 'warning',
      evidenceId: randomUUID(),
      organizationName: 'Acme Clinic',
      limitKey: 'sms_monthly',
      effectiveLimit: '1000',
      currentUsage: '820',
      thresholdPercent: '82',
      limitProvenance: 'PLAN',
      windowKey: 'default',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.limit.warning');
  });

  it('N15: limit.critical_threshold dispatches', async () => {
    const email = `n15-${randomUUID()}@test.local`;
    const result = await stack.adapters.limitAlert({
      level: 'critical',
      evidenceId: randomUUID(),
      organizationName: 'Acme Clinic',
      limitKey: 'sms_monthly',
      effectiveLimit: '1000',
      currentUsage: '960',
      thresholdPercent: '96',
      limitProvenance: 'PLAN',
      windowKey: 'default',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.limit.critical');
  });

  it('N16: limit.hard_denied dispatches', async () => {
    const email = `n16-${randomUUID()}@test.local`;
    const result = await stack.adapters.limitAlert({
      level: 'hard',
      evidenceId: randomUUID(),
      organizationName: 'Acme Clinic',
      limitKey: 'sms_monthly',
      effectiveLimit: '1000',
      currentUsage: '1000',
      limitProvenance: 'PLAN',
      windowKey: 'default',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.limit.hard_denied');
  });

  it('N17: compatibility.issue dispatches non-mandatory operational email', async () => {
    const email = `n17-${randomUUID()}@test.local`;
    const result = await stack.adapters.compatibilityIssue({
      resultId: randomUUID(),
      organizationName: 'Acme Clinic',
      issueSummary: 'Module X incompatible with Module Y',
      ruleReference: 'RULE-042',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.compatibility.issue');
  });

  it('N18: provisioning.failure dispatches mandatory operational email', async () => {
    const email = `n18-${randomUUID()}@test.local`;
    const result = await stack.adapters.provisioning({
      recovered: false,
      operationId: randomUUID(),
      organizationName: 'Acme Clinic',
      operationReference: 'OP-1',
      failureClass: 'timeout',
      at: new Date().toISOString(),
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.provisioning.failure');
  });

  it('N19: provisioning.recovered dispatches non-mandatory operational email', async () => {
    const email = `n19-${randomUUID()}@test.local`;
    const result = await stack.adapters.provisioning({
      recovered: true,
      operationId: randomUUID(),
      organizationName: 'Acme Clinic',
      operationReference: 'OP-1',
      at: new Date().toISOString(),
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.provisioning.recovered');
  });

  it('N20: sales.lead_next_action_reminder dispatches', async () => {
    const email = `n20-${randomUUID()}@test.local`;
    const result = await stack.adapters.leadNextActionReminder({
      leadId: randomUUID(),
      leadReference: 'LEAD-1',
      organizationName: 'Acme Clinic',
      nextActionDate: new Date().toISOString(),
      nextActionType: 'call',
      windowKey: 'default',
      ownerPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.sales.lead_next_action');
  });

  it('N21: sales.demo_reminder dispatches', async () => {
    const email = `n21-${randomUUID()}@test.local`;
    const result = await stack.adapters.demoReminder({
      leadId: randomUUID(),
      leadReference: 'LEAD-1',
      organizationName: 'Acme Clinic',
      demoScheduledAt: new Date().toISOString(),
      windowKey: 'default',
      ownerPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.sales.demo_reminder');
  });

  it('N22: sales.manager_stale_alert dispatches', async () => {
    const email = `n22-${randomUUID()}@test.local`;
    const result = await stack.adapters.managerAlert({
      ops: false,
      alertId: randomUUID(),
      managerPlatformUserId: randomUUID(),
      recipientEmail: email,
      managerDisplayName: 'Manager',
      staleCount: 5,
      periodLabel: '2026-08',
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.sales.manager_stale');
  });

  it('N23: sales.manager_ops_alert dispatches', async () => {
    const email = `n23-${randomUUID()}@test.local`;
    const result = await stack.adapters.managerAlert({
      ops: true,
      alertId: randomUUID(),
      managerPlatformUserId: randomUUID(),
      recipientEmail: email,
      managerDisplayName: 'Manager',
      alertSummary: 'Queue backlog',
      operationReference: 'OP-9',
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.sales.manager_ops');
  });

  it('N24: subscription.material_change dispatches', async () => {
    const email = `n24-${randomUUID()}@test.local`;
    const result = await stack.adapters.subscriptionEvent({
      kind: 'material_change',
      configId: randomUUID(),
      organizationName: 'Acme Clinic',
      changeSummary: 'Seat count increased',
      planVersionId: randomUUID(),
      occurredAt: new Date().toISOString(),
      windowKey: 'default',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(result.accepted).toBe(true);
    expect(await templateKeyFor(result.intentId)).toBe('tpl.platform.subscription.material_change');
  });
});
