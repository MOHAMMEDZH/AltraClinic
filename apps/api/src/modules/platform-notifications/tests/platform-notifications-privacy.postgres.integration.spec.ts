/**
 * Flexible Step 27 — privacy matrix P01–P20.
 *
 * Every ID inspects one canonical Step 27 surface and requires a forbidden-marker count of
 * exactly 0. `forbiddenMarkers()` returns the *names* of every marker family that matched, so
 * a failure reports which class of data leaked (PHI, secret, infrastructure, stack, Step 28)
 * instead of an opaque boolean.
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
import { PLATFORM_NOTIFICATION_AUDIT_CATEGORY } from '../platform-notifications.constants';
import { listPlatformTemplates } from '../application/templates/platform-template.catalog';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

/** Canonical forbidden-marker families. A conforming Step 27 surface matches none of them. */
const FORBIDDEN_MARKERS: ReadonlyArray<{ family: string; pattern: RegExp }> = [
  { family: 'phi', pattern: /patientName|patientId|patientContact|clinicalNotes|clinicalRecord|diagnosis|\bmrn\b|\bssn\b/i },
  { family: 'secret', pattern: /password|accessToken|refreshToken|secret|api[_-]?key|4111111111111111/i },
  { family: 'provider_credential', pattern: /smtp|sendgrid|mailgun|resend[_-]?key/i },
  { family: 'infrastructure', pattern: /databaseUrl|DATABASE_URL|connectionString|postgresql:\/\//i },
  { family: 'stack_trace', pattern: /at Object\.|\.ts:\d+|node_modules/i },
  { family: 'step28', pattern: /hardeningRun|releaseGate|step28|step29/i },
];

const PAYMENT_MARKERS = /iban|credit.?card|cardNumber|cvv|paymentIntent|stripeCustomer|bankAccount|wire.?transfer/i;
const CLINICAL_MARKERS = /diagnosis|clinicalNotes|clinicalRecord|treatmentPlan|prescription|labResult/i;
const PATIENT_USAGE_MARKERS = /patientUsage|patientId|per.?patient|mrn\b/i;

/** Returns the names of every forbidden-marker family present on a surface (expected: []). */
function forbiddenMarkers(surface: unknown): string[] {
  const text = typeof surface === 'string' ? surface : JSON.stringify(surface ?? null);
  return FORBIDDEN_MARKERS.filter((m) => m.pattern.test(text)).map((m) => m.family);
}

describeDb('Step 27 privacy P01-P20 (PostgreSQL)', () => {
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

  async function invitation(email: string) {
    return stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: email,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
  }

  async function deadLetterInvitation(email: string) {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await invitation(email);
    const { jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    const jobId = jobs[0].id;
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } });
    for (let i = job.attemptCount; i < job.maxAttempts; i++) {
      await stack.worker.processDeliveryJob(jobId);
    }
    clearPlatformNotificationFailureInjection();
    const intent = await prisma.notificationIntent.findUniqueOrThrow({
      where: { id: result.intentId! },
    });
    await prisma.notificationIntent.update({
      where: { id: result.intentId! },
      data: {
        metadata: {
          ...(intent.metadata as Record<string, unknown>),
          deliveryGateForceFail: false,
        },
      },
    });
    return result;
  }

  it('P01: no patient identifiers in templates', async () => {
    const catalog = listPlatformTemplates();
    expect(catalog.length).toBeGreaterThan(0);
    expect(forbiddenMarkers(catalog)).toEqual([]);
    for (const tpl of catalog) {
      expect(JSON.stringify(tpl)).not.toMatch(/patientId|patientName|patientContact|\bmrn\b/i);
      expect(tpl.variables.every((v) => !/patient/i.test(v))).toBe(true);
    }
  });

  it('P02: no clinical details', async () => {
    const email = `p02-${randomUUID()}@test.local`;
    await invitation(email);
    await stack.adapters.limitAlert({
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
      recipientEmail: email,
    });
    const catalog = listPlatformTemplates();
    const sent = stack.emailService.sent;
    expect(JSON.stringify(catalog)).not.toMatch(CLINICAL_MARKERS);
    for (const message of sent) {
      expect(message.text).not.toMatch(CLINICAL_MARKERS);
      expect(forbiddenMarkers(message.text)).toEqual([]);
    }
  });

  it('P03: no patient-level usage detail', async () => {
    const email = `p03-${randomUUID()}@test.local`;
    await stack.adapters.limitAlert({
      level: 'hard',
      evidenceId: randomUUID(),
      organizationName: 'Acme',
      limitKey: 'sms_monthly',
      effectiveLimit: '1000',
      currentUsage: '1000',
      limitProvenance: 'PLAN',
      windowKey: 'default',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    const sent = stack.emailService.sent.find((m) => m.to === email);
    expect(sent).toBeDefined();
    expect(sent!.text).not.toMatch(PATIENT_USAGE_MARKERS);
    expect(forbiddenMarkers(sent!.text)).toEqual([]);
    const detail = await stack.query.getDelivery(
      perms,
      (await prisma.notificationIntent.findFirstOrThrow({
        where: { metadata: { path: ['templateKey'], equals: 'tpl.platform.limit.hard_denied' } },
      })).id,
    );
    expect(JSON.stringify(detail.metadata)).not.toMatch(PATIENT_USAGE_MARKERS);
  });

  it('P04: no PHI in delivery DB', async () => {
    const result = await invitation(`p04-${randomUUID()}@test.local`);
    const { intent, message, jobs, attempts } = await getDeliveryArtifacts(prisma, result.intentId!);
    expect(forbiddenMarkers(intent)).toEqual([]);
    expect(forbiddenMarkers(message)).toEqual([]);
    expect(forbiddenMarkers(jobs)).toEqual([]);
    expect(forbiddenMarkers(attempts)).toEqual([]);
  });

  it('P05: no PHI in retry/dead-letter', async () => {
    const email = `p05-${randomUUID()}@test.local`;
    const result = await deadLetterInvitation(email);
    const { jobs, attempts, intent, message } = await getDeliveryArtifacts(prisma, result.intentId!);
    expect(jobs[0].status).toBe('dead_letter');
    expect(jobs[0].deadLetteredAt).not.toBeNull();
    expect(forbiddenMarkers(intent)).toEqual([]);
    expect(forbiddenMarkers(message)).toEqual([]);
    expect(forbiddenMarkers(jobs)).toEqual([]);
    expect(forbiddenMarkers(attempts)).toEqual([]);
    expect(JSON.stringify({ jobs, attempts })).not.toMatch(/patientId|diagnosis|clinicalNotes|\bmrn\b/i);
  });

  it('P06: no PHI in audit', async () => {
    const result = await invitation(`p06-${randomUUID()}@test.local`);
    const audits = await prisma.auditEntry.findMany({
      where: {
        category: PLATFORM_NOTIFICATION_AUDIT_CATEGORY,
        resourceId: result.intentId!,
      },
    });
    expect(audits.length).toBeGreaterThan(0);
    expect(forbiddenMarkers(audits)).toEqual([]);
  });

  it('P07: no PHI in logs (assert no PHI in recording sink / rendered output that would be logged; or assert template catalog + rendered bodies)', async () => {
    const email = `p07-${randomUUID()}@test.local`;
    await invitation(email);
    await stack.adapters.mfaSecurityAlert({
      alertId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: email,
      recipientDisplayName: 'Admin',
      alertSummary: 'login',
      occurredAt: new Date().toISOString(),
    });
    const catalog = listPlatformTemplates();
    const renderedStandInForLogs = {
      catalog,
      sink: stack.emailService.sent,
    };
    expect(forbiddenMarkers(renderedStandInForLogs)).toEqual([]);
    for (const message of stack.emailService.sent) {
      expect(forbiddenMarkers(message.subject)).toEqual([]);
      expect(forbiddenMarkers(message.text)).toEqual([]);
      expect(forbiddenMarkers(message.html ?? '')).toEqual([]);
    }
  });

  it('P08: no provider secrets in messages', async () => {
    const email = `p08-${randomUUID()}@test.local`;
    await invitation(email);
    const sent = stack.emailService.sent.find((m) => m.to === email);
    expect(sent).toBeDefined();
    expect(forbiddenMarkers(sent)).toEqual([]);
    expect(JSON.stringify(sent)).not.toMatch(/smtp|sendgrid|mailgun|api[_-]?key|providerSecret/i);
  });

  it('P09: no provider secrets in DB delivery metadata', async () => {
    const result = await invitation(`p09-${randomUUID()}@test.local`);
    const { intent, message, jobs } = await getDeliveryArtifacts(prisma, result.intentId!);
    for (const surface of [intent?.metadata, message, jobs]) {
      expect(forbiddenMarkers(surface)).toEqual([]);
      expect(JSON.stringify(surface)).not.toMatch(/smtp|sendgrid|mailgun|resend|api[_-]?key/i);
    }
  });

  it('P10: no access/refresh/session tokens', async () => {
    const email = `p10-${randomUUID()}@test.local`;
    await invitation(email);
    const list = await stack.query.listDeliveries(perms, { pageSize: 10 });
    const sent = stack.emailService.sent.find((m) => m.to === email);
    for (const surface of [list, sent, stack.emailService.sent]) {
      expect(JSON.stringify(surface)).not.toMatch(/accessToken|refreshToken|sessionToken|Bearer\s+[A-Za-z0-9\-._]+/i);
      expect(forbiddenMarkers(surface)).toEqual([]);
    }
  });

  it('P11: no MFA seeds', async () => {
    const email = `p11-${randomUUID()}@test.local`;
    await stack.adapters.mfaSecurityAlert({
      alertId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: email,
      recipientDisplayName: 'Admin',
      alertSummary: 'New device login',
      occurredAt: new Date().toISOString(),
    });
    const sent = stack.emailService.sent.find((m) => m.to === email);
    expect(sent).toBeDefined();
    expect(sent!.text).not.toMatch(/mfaSecret|mfaSeed|totp|otpauth:\/\/|recovery.?code|authenticator.?seed/i);
    expect(forbiddenMarkers(sent!.text)).toEqual([]);
  });

  it('P12: no password/reset secret outside accepted secure flow', async () => {
    const email = `p12-${randomUUID()}@test.local`;
    const result = await invitation(email);
    const sent = stack.emailService.sent.find((m) => m.to === email);
    expect(sent).toBeDefined();
    expect(sent!.text).not.toMatch(/password|resetToken|reset_token|rawInviteToken|inviteSecret/i);
    expect(forbiddenMarkers(sent!.text)).toEqual([]);
    const audits = await prisma.auditEntry.findMany({
      where: {
        category: PLATFORM_NOTIFICATION_AUDIT_CATEGORY,
        resourceId: result.intentId!,
      },
    });
    expect(audits.length).toBeGreaterThan(0);
    expect(JSON.stringify(audits)).not.toMatch(/password|resetToken|rawInviteToken/i);
    expect(forbiddenMarkers(audits)).toEqual([]);
  });

  it('P13: no raw secure invite artifact in logs/audit', async () => {
    const result = await invitation(`p13-${randomUUID()}@test.local`);
    const audits = await prisma.auditEntry.findMany({
      where: {
        category: PLATFORM_NOTIFICATION_AUDIT_CATEGORY,
        resourceId: result.intentId!,
      },
    });
    const sink = stack.emailService.sent;
    for (const surface of [audits, sink]) {
      expect(JSON.stringify(surface)).not.toMatch(
        /rawInviteToken|inviteToken=|secureInviteArtifact|invitationSecret/i,
      );
      expect(forbiddenMarkers(surface)).toEqual([]);
    }
  });

  it('P14: no raw exception stack in recipient message', async () => {
    const email = `p14-${randomUUID()}@test.local`;
    await stack.adapters.provisioning({
      recovered: false,
      operationId: randomUUID(),
      organizationName: 'Acme',
      operationReference: 'op-14',
      failureClass: 'timeout',
      at: new Date().toISOString(),
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    const sent = stack.emailService.sent.find((m) => m.to === email);
    expect(sent).toBeDefined();
    expect(sent!.text).toMatch(/timeout/);
    expect(sent!.text).not.toMatch(/Error:|stack trace|at Object\.|\.ts:\d+/i);
    expect(forbiddenMarkers(sent!.text)).toEqual([]);
  });

  it('P15: lead reminder excludes unsafe free text', async () => {
    const email = `p15-${randomUUID()}@test.local`;
    await stack.adapters.leadNextActionReminder({
      leadId: randomUUID(),
      leadReference: 'LEAD-15',
      organizationName: 'Acme',
      nextActionDate: new Date().toISOString(),
      nextActionType: 'call',
      windowKey: 'd1',
      ownerPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    const sent = stack.emailService.sent.find((m) => m.to === email);
    expect(sent).toBeDefined();
    expect(sent!.text).not.toMatch(/leadNote|noteBody|free.?text|patient notes|clinical/i);
    expect(forbiddenMarkers(sent!.text)).toEqual([]);
  });

  it('P16: template preview uses synthetic/safe data', async () => {
    const preview = stack.query.preview(
      platformClaims(randomUUID(), randomUUID()),
      perms,
      'tpl.platform.invitation.sent',
    );
    expect(Object.values(preview.variables).every((v) => String(v).startsWith('sample_'))).toBe(
      true,
    );
    expect(forbiddenMarkers(preview)).toEqual([]);
    expect(await prisma.notificationIntent.count()).toBe(0);
  });

  it('P17: manager alert respects commercial-only scope', async () => {
    const email = `p17-${randomUUID()}@test.local`;
    await stack.adapters.managerAlert({
      ops: true,
      alertId: randomUUID(),
      managerPlatformUserId: randomUUID(),
      recipientEmail: email,
      managerDisplayName: 'Mgr',
      alertSummary: 'ops threshold',
      operationReference: 'op-17',
    });
    const sent = stack.emailService.sent.find((m) => m.to === email);
    expect(sent).toBeDefined();
    expect(sent!.text).not.toMatch(/patient|diagnosis|clinical|mrn|phi/i);
    expect(forbiddenMarkers(sent!.text)).toEqual([]);
    const intent = await prisma.notificationIntent.findFirstOrThrow({
      where: { metadata: { path: ['templateKey'], equals: 'tpl.platform.sales.manager_ops' } },
    });
    expect((intent.metadata as Record<string, unknown>).sourceType).toBe('platform_ops_alert');
    expect(intent.category).toMatch(/sales|commercial|operational/i);
  });

  it('P18: no cross-tenant recipient leakage', async () => {
    const emailA = `p18a-${randomUUID()}@test.local`;
    const emailB = `p18b-${randomUUID()}@test.local`;
    const recipientA = randomUUID();
    const recipientB = randomUUID();
    const a = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: recipientA,
      recipientEmail: emailA,
      recipientDisplayName: 'AdminA',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const b = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: recipientB,
      recipientEmail: emailB,
      recipientDisplayName: 'AdminB',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const detailA = await stack.query.getDelivery(perms, a.intentId!);
    const detailB = await stack.query.getDelivery(perms, b.intentId!);
    expect((detailA.metadata as Record<string, unknown>).recipientEmail).toBe(emailA);
    expect((detailB.metadata as Record<string, unknown>).recipientEmail).toBe(emailB);
    expect(JSON.stringify(detailA.metadata)).not.toContain(emailB);
    expect(JSON.stringify(detailB.metadata)).not.toContain(emailA);
    expect(JSON.stringify(detailA.metadata)).not.toContain(recipientB);
    expect(JSON.stringify(detailB.metadata)).not.toContain(recipientA);
    expect(stack.emailService.sent.find((m) => m.to === emailA)?.text).not.toContain(emailB);
    expect(stack.emailService.sent.find((m) => m.to === emailB)?.text).not.toContain(emailA);
  });

  it('P19: no Step 28 security-report data', async () => {
    const result = await invitation(`p19-${randomUUID()}@test.local`);
    const surfaces: unknown[] = [
      listPlatformTemplates(),
      stack.query.listTemplates(perms),
      stack.query.getTemplate(perms, 'tpl.platform.invitation.sent'),
      await stack.query.listDeliveries(perms, { pageSize: 10 }),
      await stack.query.getDelivery(perms, result.intentId!),
      stack.emailService.sent,
    ];
    for (const surface of surfaces) {
      expect(forbiddenMarkers(surface)).toEqual([]);
      expect(JSON.stringify(surface)).not.toMatch(/hardeningRun|releaseGate|step28|step29|security.?report/i);
    }
  });

  it('P20: no billing/payment data added', async () => {
    const catalog = listPlatformTemplates();
    const email = `p20-${randomUUID()}@test.local`;
    await invitation(email);
    await stack.adapters.subscriptionEvent({
      kind: 'approaching',
      configId: randomUUID(),
      organizationName: 'Acme',
      expiryDate: new Date().toISOString(),
      planVersionId: randomUUID(),
      windowKey: 'd7',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: email,
    });
    expect(JSON.stringify(catalog)).not.toMatch(PAYMENT_MARKERS);
    for (const message of stack.emailService.sent) {
      expect(message.text).not.toMatch(PAYMENT_MARKERS);
      expect(message.subject).not.toMatch(PAYMENT_MARKERS);
      expect(forbiddenMarkers(message)).toEqual([]);
    }
  });
});
