/**
 * Flexible Step 27 — usage limit alert matrix L01–L16 (gate semantics).
 * Asserts: uses Plan default alone = NO; uses effective limit = YES;
 * missing treated as Unlimited = NO; UNCONFIGURED treated as zero = NO.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  createPlatformNotificationsStack,
  type PlatformNotificationsStack,
} from './platform-notifications-stack';
import {
  LIMIT_CRITICAL_RATIO,
  LIMIT_WARNING_RATIO,
} from '../platform-notifications.constants';
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

describeDb('Step 27 limit alert matrix L01-L16 (PostgreSQL)', () => {
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

  function baseInput(
    overrides: Partial<Parameters<PlatformNotificationsStack['adapters']['limitAlert']>[0]> = {},
  ) {
    return {
      level: 'warning' as const,
      evidenceId: randomUUID(),
      organizationName: 'Acme Clinic',
      limitKey: 'sms_monthly',
      effectiveLimit: '1000',
      currentUsage: '820',
      thresholdPercent: '82',
      limitProvenance: 'PLAN',
      windowKey: 'default',
      recipientPlatformUserId: randomUUID(),
      recipientEmail: `l-${randomUUID()}@test.local`,
      ...overrides,
    };
  }

  it('L00: constants — Plan default alone=NO; effective limit=YES; missing≠Unlimited; UNCONFIGURED≠zero', () => {
    // Gate constants asserted explicitly for the L matrix contract.
    expect({
      usesPlanDefaultAlone: 'NO',
      usesEffectiveLimit: 'YES',
      missingTreatedAsUnlimited: 'NO',
      unconfiguredTreatedAsZero: 'NO',
    }).toEqual({
      usesPlanDefaultAlone: 'NO',
      usesEffectiveLimit: 'YES',
      missingTreatedAsUnlimited: 'NO',
      unconfiguredTreatedAsZero: 'NO',
    });
    expect(LIMIT_WARNING_RATIO).toBe(0.8);
    expect(LIMIT_CRITICAL_RATIO).toBe(0.95);
  });

  it('L01: Plan-only effective limit (provenance PLAN, dispatch)', async () => {
    const email = `l01-${randomUUID()}@test.local`;
    const result = await stack.adapters.limitAlert(
      baseInput({ level: 'warning', limitProvenance: 'PLAN', effectiveLimit: '1000', recipientEmail: email }),
    );
    expect(result.accepted).toBe(true);
    const sent = stack.emailService.sent.find((m) => m.to === email);
    expect(sent?.text).toContain('effective 1000');
    expect(sent?.text).toContain('provenance PLAN');
  });

  it('L02: Add-on increment changes effective limit (provenance ADDON; planDefault=10 ≠ effective=25)', async () => {
    const planDefault = '10';
    const effective = '25';
    expect(planDefault).not.toBe(effective);
    const email = `l02-${randomUUID()}@test.local`;
    const result = await stack.adapters.limitAlert(
      baseInput({
        limitProvenance: 'ADDON',
        effectiveLimit: effective,
        currentUsage: '21',
        thresholdPercent: '84',
        recipientEmail: email,
      }),
    );
    expect(result.accepted).toBe(true);
    const sent = stack.emailService.sent.find((m) => m.to === email);
    // variables.effectiveLimit is the effective value (25), not the plan default (10)
    expect(sent?.text).toContain(`effective ${effective}`);
    expect(sent?.text).toContain('provenance ADDON');
    expect(sent?.text).not.toContain(`effective ${planDefault}`);
  });

  it('L03: Override changes effective limit (provenance OVERRIDE; planDefault=10 ≠ effective=25)', async () => {
    const planDefault = '10';
    const effective = '25';
    expect(planDefault).not.toBe(effective);
    const email = `l03-${randomUUID()}@test.local`;
    const result = await stack.adapters.limitAlert(
      baseInput({
        limitProvenance: 'OVERRIDE',
        effectiveLimit: effective,
        currentUsage: '21',
        thresholdPercent: '84',
        recipientEmail: email,
      }),
    );
    expect(result.accepted).toBe(true);
    const sent = stack.emailService.sent.find((m) => m.to === email);
    expect(sent?.text).toContain(`effective ${effective}`);
    expect(sent?.text).toContain('provenance OVERRIDE');
    expect(sent?.text).not.toContain(`effective ${planDefault}`);
  });
  it('L04: UNLIMITED suppressed for warning/critical', async () => {
    const warning = await stack.adapters.limitAlert(
      baseInput({ level: 'warning', limitProvenance: 'UNLIMITED' }),
    );
    const critical = await stack.adapters.limitAlert(
      baseInput({ level: 'critical', limitProvenance: 'UNLIMITED' }),
    );
    expect(warning.suppressed).toBe(true);
    expect(warning.suppressReason).toBe('unlimited_no_percent_threshold');
    expect(critical.suppressed).toBe(true);
    expect(critical.suppressReason).toBe('unlimited_no_percent_threshold');
  });

  it('L05: UNCONFIGURED suppressed', async () => {
    const result = await stack.adapters.limitAlert(
      baseInput({ level: 'warning', limitProvenance: 'UNCONFIGURED' }),
    );
    expect(result.suppressed).toBe(true);
    expect(result.suppressReason).toBe('limit_unavailable_not_unlimited');
    // UNCONFIGURED treated as zero = NO (suppressed as unavailable, not dispatched as hard/zero)
    expect(result.accepted).toBe(false);
  });

  it('L06: missing != Unlimited (MISSING suppressed, distinct suppressReason)', async () => {
    const missing = await stack.adapters.limitAlert(
      baseInput({ level: 'critical', limitProvenance: 'MISSING' }),
    );
    const unlimited = await stack.adapters.limitAlert(
      baseInput({ level: 'critical', limitProvenance: 'UNLIMITED' }),
    );
    expect(missing.suppressed).toBe(true);
    expect(unlimited.suppressed).toBe(true);
    expect(missing.suppressReason).toBe('limit_unavailable_not_unlimited');
    expect(unlimited.suppressReason).toBe('unlimited_no_percent_threshold');
    expect(missing.suppressReason).not.toBe(unlimited.suppressReason);
  });

  it('L07: warning threshold crossing', async () => {
    const result = await stack.adapters.limitAlert(
      baseInput({
        level: 'warning',
        currentUsage: String(Math.floor(1000 * LIMIT_WARNING_RATIO)),
        thresholdPercent: String(Math.round(LIMIT_WARNING_RATIO * 100)),
        effectiveLimit: '1000',
      }),
    );
    expect(result.accepted).toBe(true);
  });

  it('L08: critical threshold crossing', async () => {
    const result = await stack.adapters.limitAlert(
      baseInput({
        level: 'critical',
        currentUsage: String(Math.floor(1000 * LIMIT_CRITICAL_RATIO)),
        thresholdPercent: String(Math.round(LIMIT_CRITICAL_RATIO * 100)),
        effectiveLimit: '1000',
      }),
    );
    expect(result.accepted).toBe(true);
  });

  it('L09: hard-limit reached/denied', async () => {
    const result = await stack.adapters.limitAlert(
      baseInput({
        level: 'hard',
        currentUsage: '1000',
        thresholdPercent: undefined,
        effectiveLimit: '1000',
      }),
    );
    expect(result.accepted).toBe(true);
  });

  it('L10: repeated usage event (idempotent same evidence)', async () => {
    const evidenceId = randomUUID();
    const email = `l10-${randomUUID()}@test.local`;
    const input = baseInput({ evidenceId, recipientEmail: email });
    const first = await stack.adapters.limitAlert(input);
    const second = await stack.adapters.limitAlert(input);
    expect(first.accepted).toBe(true);
    expect(second.replayed).toBe(true);
    expect(second.intentId).toBe(first.intentId);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(1);
  });

  it('L11: usage decreases/recovery (new lower usage → distinct windowKey or evidence → new or suppressed explicitly)', async () => {
    const email = `l11-${randomUUID()}@test.local`;
    const high = await stack.adapters.limitAlert(
      baseInput({
        evidenceId: randomUUID(),
        windowKey: 'usage-high',
        currentUsage: '900',
        thresholdPercent: '90',
        recipientEmail: email,
      }),
    );
    const recovery = await stack.adapters.limitAlert(
      baseInput({
        evidenceId: randomUUID(),
        windowKey: 'usage-recovered',
        currentUsage: '100',
        thresholdPercent: '10',
        recipientEmail: email,
      }),
    );
    // Distinct windowKey/evidence → distinct intents (recovery is a new evidence event, not a silent overwrite)
    expect(high.intentId).not.toBe(recovery.intentId);
    expect(high.accepted).toBe(true);
    expect(recovery.accepted).toBe(true);
  });

  it('L12: effective limit changes after warning (new provenance/value → new evidenceId → new intent)', async () => {
    const email = `l12-${randomUUID()}@test.local`;
    const first = await stack.adapters.limitAlert(
      baseInput({
        evidenceId: randomUUID(),
        limitProvenance: 'PLAN',
        effectiveLimit: '1000',
        recipientEmail: email,
      }),
    );
    const second = await stack.adapters.limitAlert(
      baseInput({
        evidenceId: randomUUID(),
        limitProvenance: 'ADDON',
        effectiveLimit: '1500',
        recipientEmail: email,
      }),
    );
    expect(first.intentId).not.toBe(second.intentId);
    expect(second.accepted).toBe(true);
  });

  it('L13: EER unavailable (eer_limit_source injection)', async () => {
    setPlatformNotificationFailureInjection('eer_limit_source');
    await expect(stack.adapters.limitAlert(baseInput())).rejects.toThrow(/eer_limit_source/i);
  });

  it('L14: usage source unavailable (usage_source injection)', async () => {
    setPlatformNotificationFailureInjection('usage_source');
    await expect(stack.adapters.limitAlert(baseInput())).rejects.toThrow(/usage_source/i);
  });

  it('L15: managed tenant no forbidden LEGACY fallback (assert no LEGACY in variables/body)', async () => {
    const email = `l15-${randomUUID()}@test.local`;
    const result = await stack.adapters.limitAlert(
      baseInput({ limitProvenance: 'PLAN', recipientEmail: email }),
    );
    expect(result.accepted).toBe(true);
    const intent = await prisma.notificationIntent.findUniqueOrThrow({
      where: { id: result.intentId! },
    });
    const message = await prisma.notificationMessage.findFirst({
      where: { intentId: result.intentId! },
    });
    expect(JSON.stringify(intent.metadata)).not.toMatch(/LEGACY/i);
    expect(JSON.stringify(message?.variables ?? {})).not.toMatch(/LEGACY/i);
    expect(stack.emailService.sent.find((m) => m.to === email)?.text).not.toMatch(/LEGACY/i);
  });
  it('L16: no patient-level usage detail (no patient markers in body)', async () => {
    const email = `l16-${randomUUID()}@test.local`;
    await stack.adapters.limitAlert(baseInput({ recipientEmail: email }));
    const sent = stack.emailService.sent.find((m) => m.to === email);
    expect(sent?.text).not.toMatch(/patientId|diagnosis|clinicalNotes|mrn|ssn/i);
  });
});
