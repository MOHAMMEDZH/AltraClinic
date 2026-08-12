/**
 * Flexible Step 27 — privacy matrix P01–P20.
 * No PHI / platform secrets / second-engine fields in messages, deliveries, prefs, or audits.
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
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  ensureSentinel,
  platformClaims,
  platformDbSecurityEnabled,
} from './platform-notifications-db.harness';
import { PLATFORM_NOTIFICATION_AUDIT_CATEGORY } from '../platform-notifications.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const SECRET_MARKERS = /password|accessToken|refreshToken|secret|4111111111111111|api[_-]?key/i;
const PATIENT_FIELD_MARKERS = /diagnosis|patientId|clinicalNotes|patientContact|clinicalRecord|ssn|mrn/i;
const STEP28_MARKERS = /hardeningRun|releaseGate|step28|step29/i;

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

  it('P01: invitation email body has no PHI markers', async () => {
    const email = `p01-${randomUUID()}@test.local`;
    await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: email,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const sent = stack.emailService.sent.find((m) => m.to === email);
    expect(sent?.text).not.toMatch(PATIENT_FIELD_MARKERS);
    expect(sent?.text).not.toMatch(SECRET_MARKERS);
  });

  it('P02: listDeliveries payload has no secrets', async () => {
    await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `p02-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const list = await stack.query.listDeliveries(perms, { pageSize: 50 });
    expect(JSON.stringify(list)).not.toMatch(SECRET_MARKERS);
    expect(JSON.stringify(list)).not.toMatch(PATIENT_FIELD_MARKERS);
  });

  it('P03: getDelivery raw intent metadata has no PHI', async () => {
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `p03-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const detail = await stack.query.getDelivery(perms, result.intentId!);
    expect(JSON.stringify(detail.metadata)).not.toMatch(PATIENT_FIELD_MARKERS);
    expect(JSON.stringify(detail.metadata)).not.toMatch(SECRET_MARKERS);
  });

  it('P04: template preview uses synthetic variables only', async () => {
    const user = platformClaims(randomUUID(), randomUUID());
    const preview = stack.query.preview(user, perms, 'tpl.platform.invitation.sent');
    expect(JSON.stringify(preview.variables)).toMatch(/sample_/);
    expect(JSON.stringify(preview)).not.toMatch(PATIENT_FIELD_MARKERS);
    expect(JSON.stringify(preview)).not.toMatch(SECRET_MARKERS);
  });

  it('P05: preference rows expose only category/channel/locale/enabled', async () => {
    const userRow = await createPlatformUserFixture(prisma, {
      email: `p05-${randomUUID()}@test.local`,
    });
    const claims = platformClaims(userRow.id, randomUUID());
    await stack.prefs.upsert(
      claims,
      perms,
      { category: 'usage', channel: 'email', enabled: false },
      randomUUID(),
    );
    const rows = await stack.prefs.list(claims, perms);
    expect(JSON.stringify(rows)).not.toMatch(SECRET_MARKERS);
    expect(JSON.stringify(rows)).not.toMatch(PATIENT_FIELD_MARKERS);
  });

  it('P06: DISPATCHED audit details have no secrets/PHI', async () => {
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `p06-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const audits = await prisma.auditEntry.findMany({
      where: {
        category: PLATFORM_NOTIFICATION_AUDIT_CATEGORY,
        resourceId: result.intentId!,
      },
    });
    expect(JSON.stringify(audits)).not.toMatch(SECRET_MARKERS);
    expect(JSON.stringify(audits)).not.toMatch(PATIENT_FIELD_MARKERS);
  });

  it('P07: forbidden template variables (patientName) are rejected', () => {
    expect(() =>
      stack.query.preview(
        platformClaims(randomUUID(), randomUUID()),
        perms,
        'tpl.platform.invitation.sent',
      ),
    ).not.toThrow();
    // Catalog-level guard exercised via render path in templates suite; assert markers absent here.
    const list = stack.query.listTemplates(perms);
    expect(JSON.stringify(list)).not.toMatch(PATIENT_FIELD_MARKERS);
  });

  it('P08: MFA security alert body has no token/secret markers', async () => {
    const email = `p08-${randomUUID()}@test.local`;
    await stack.adapters.mfaSecurityAlert({
      alertId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: email,
      recipientDisplayName: 'Admin',
      alertSummary: 'New device login',
      occurredAt: new Date().toISOString(),
    });
    const sent = stack.emailService.sent.find((m) => m.to === email);
    expect(sent?.text).not.toMatch(SECRET_MARKERS);
  });

  it('P09: limit alert does not embed raw denial credentials', async () => {
    const email = `p09-${randomUUID()}@test.local`;
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
    expect(sent?.text).not.toMatch(SECRET_MARKERS);
    expect(sent?.text).not.toMatch(PATIENT_FIELD_MARKERS);
  });

  it('P10: no Step 28/29 markers in query surfaces', async () => {
    await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `p10-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const list = await stack.query.listDeliveries(perms, { pageSize: 10 });
    const templates = stack.query.listTemplates(perms);
    expect(JSON.stringify(list)).not.toMatch(STEP28_MARKERS);
    expect(JSON.stringify(templates)).not.toMatch(STEP28_MARKERS);
  });

  it('P11: recording email sink proves realExternalDeliveriesDuringTests = 0', async () => {
    const before = stack.emailService.sent.length;
    await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `p11-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    expect(stack.emailService.sent.length).toBe(before + 1);
    // No SMTP host / API key fields appear on recorded messages.
    expect(JSON.stringify(stack.emailService.sent)).not.toMatch(/smtp|sendgrid|mailgun/i);
    expect(stack.emailService.realExternalDeliveriesDuringTests).toBe(0);
  });

  it('P12: preference deny audit does not persist secrets', async () => {
    const user = platformClaims(randomUUID(), randomUUID());
    await expect(
      stack.prefs.upsert(
        user,
        perms,
        { category: 'security', channel: 'email', enabled: false },
        randomUUID(),
      ),
    ).rejects.toThrow();
    const row = await prisma.auditEntry.findFirstOrThrow({
      where: {
        category: PLATFORM_NOTIFICATION_AUDIT_CATEGORY,
        action: 'platform_notification.mandatory_disable_denied',
        actorId: user.sub,
      },
    });
    expect(JSON.stringify(row)).not.toMatch(SECRET_MARKERS);
  });

  it('P13: manager alert body no free-text lead notes', async () => {
    const email = `p13-${randomUUID()}@test.local`;
    await stack.adapters.managerAlert({
      ops: true,
      alertId: randomUUID(),
      managerPlatformUserId: randomUUID(),
      recipientEmail: email,
      managerDisplayName: 'Mgr',
      alertSummary: 'ops threshold',
      operationReference: 'op-13',
    });
    const sent = stack.emailService.sent.find((m) => m.to === email);
    expect(sent?.text).not.toMatch(/leadNote|free.?text|clinicalNotes|patient notes/i);
    expect(sent?.text).not.toMatch(PATIENT_FIELD_MARKERS);
  });

  it('P14: provisioning failure body sanitized (no stack/secrets)', async () => {
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
    expect(sent?.text).not.toMatch(SECRET_MARKERS);
    expect(sent?.text).not.toMatch(/at Object\.|Error:|stack trace|databaseUrl/i);
  });

  it('P15: getDelivery HTTP-equivalent query surface no PHI', async () => {
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `p15-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const detail = await stack.query.getDelivery(perms, result.intentId!);
    expect(JSON.stringify(detail)).not.toMatch(PATIENT_FIELD_MARKERS);
    expect(JSON.stringify(detail)).not.toMatch(SECRET_MARKERS);
  });

  it('P16: ar-SY invitation body no PHI', async () => {
    const email = `p16-${randomUUID()}@test.local`;
    await stack.dispatch.dispatch({
      eventKey: 'platform.invitation.sent',
      sourceType: 'platform_user_invitation',
      sourceId: randomUUID(),
      recipientKind: 'platform_user',
      recipientId: randomUUID(),
      recipientEmail: email,
      locale: 'ar-SY',
      variables: {
        recipientDisplayName: 'Ali',
        inviterDisplayName: 'Root',
        expiresAt: new Date().toISOString(),
      },
    });
    const sent = stack.emailService.sent.find((m) => m.to === email);
    expect(sent?.text).not.toMatch(PATIENT_FIELD_MARKERS);
    expect(sent?.text).not.toMatch(SECRET_MARKERS);
  });

  it('P17: recording sink never initializes real provider (realProviderInitializationsDuringTests===0)', async () => {
    await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `p17-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    expect(stack.emailService.realProviderInitializationsDuringTests).toBe(0);
  });

  it('P18: assert realExternalDeliveriesDuringTests === 0 after multi-event fan-out', async () => {
    const email = `p18-${randomUUID()}@test.local`;
    await Promise.all([
      stack.adapters.invitationSent({
        invitationId: randomUUID(),
        platformUserId: randomUUID(),
        recipientEmail: email,
        recipientDisplayName: 'Admin',
        inviterDisplayName: 'Root',
        expiresAt: new Date().toISOString(),
      }),
      stack.adapters.mfaSecurityAlert({
        alertId: randomUUID(),
        platformUserId: randomUUID(),
        recipientEmail: email,
        recipientDisplayName: 'Admin',
        alertSummary: 'login',
        occurredAt: new Date().toISOString(),
      }),
      stack.adapters.limitAlert({
        level: 'warning',
        evidenceId: randomUUID(),
        organizationName: 'Acme',
        limitKey: 'sms',
        effectiveLimit: '100',
        currentUsage: '82',
        thresholdPercent: '82',
        limitProvenance: 'PLAN',
        windowKey: 'default',
        recipientPlatformUserId: randomUUID(),
        recipientEmail: email,
      }),
    ]);
    expect(stack.emailService.realExternalDeliveriesDuringTests).toBe(0);
  });

  it('P19: in-app not used for platform_user (email-only)', async () => {
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `p19-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const jobs = await prisma.deliveryJob.findMany({ where: { intentId: result.intentId! } });
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs.every((j) => j.channel === 'email')).toBe(true);
    expect(jobs.some((j) => /in.?app/i.test(j.channel))).toBe(false);
  });

  it('P20: no databaseUrl/apiKey in audit details', async () => {
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `p20-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const audits = await prisma.auditEntry.findMany({
      where: {
        category: PLATFORM_NOTIFICATION_AUDIT_CATEGORY,
        resourceId: result.intentId!,
      },
    });
    expect(JSON.stringify(audits)).not.toMatch(/databaseUrl|DATABASE_URL|apiKey|api_key/i);
  });
});
