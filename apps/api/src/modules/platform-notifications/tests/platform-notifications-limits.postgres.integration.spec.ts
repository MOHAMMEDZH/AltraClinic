/**
 * Flexible Step 27 — usage limit alert matrix L01–L16.
 * Exercises `PlatformNotificationEventAdapters.limitAlert`'s suppression rules across
 * warning/critical/hard levels crossed with limit provenance (PLAN / UNLIMITED / UNCONFIGURED /
 * MISSING), plus dedupe, idempotent replay and required-variable enforcement.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createPlatformNotificationsStack, type PlatformNotificationsStack } from './platform-notifications-stack';
import {
  LIMIT_CRITICAL_RATIO,
  LIMIT_WARNING_RATIO,
} from '../platform-notifications.constants';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupPlatformNotificationsTables,
  clearPlatformNotificationFailureInjection,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  ensureSentinel,
  platformDbSecurityEnabled,
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

  function baseInput(overrides: Partial<Parameters<PlatformNotificationsStack['adapters']['limitAlert']>[0]> = {}) {
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

  it('L01: warning + PLAN provenance dispatches', async () => {
    const result = await stack.adapters.limitAlert(baseInput({ level: 'warning' }));
    expect(result.accepted).toBe(true);
    expect(result.suppressed).toBeFalsy();
  });

  it('L02: critical + PLAN provenance dispatches', async () => {
    const result = await stack.adapters.limitAlert(baseInput({ level: 'critical', currentUsage: '960', thresholdPercent: '96' }));
    expect(result.accepted).toBe(true);
  });

  it('L03: hard + PLAN provenance dispatches', async () => {
    const result = await stack.adapters.limitAlert(
      baseInput({ level: 'hard', currentUsage: '1000', thresholdPercent: undefined }),
    );
    expect(result.accepted).toBe(true);
  });

  it('L04: warning + UNLIMITED provenance is suppressed (no percent threshold makes sense)', async () => {
    const result = await stack.adapters.limitAlert(baseInput({ level: 'warning', limitProvenance: 'UNLIMITED' }));
    expect(result.accepted).toBe(false);
    expect(result.suppressed).toBe(true);
    expect(result.suppressReason).toBe('unlimited_no_percent_threshold');
    expect(stack.emailService.sent).toHaveLength(0);
  });

  it('L05: critical + UNLIMITED provenance is suppressed', async () => {
    const result = await stack.adapters.limitAlert(baseInput({ level: 'critical', limitProvenance: 'UNLIMITED' }));
    expect(result.suppressed).toBe(true);
    expect(result.suppressReason).toBe('unlimited_no_percent_threshold');
  });

  it('L06: hard + UNLIMITED provenance is NOT suppressed (hard denial is absolute)', async () => {
    const result = await stack.adapters.limitAlert(
      baseInput({ level: 'hard', limitProvenance: 'UNLIMITED', thresholdPercent: undefined }),
    );
    expect(result.accepted).toBe(true);
    expect(result.suppressed).toBeFalsy();
  });

  it('L07: warning + UNCONFIGURED provenance is suppressed (limit unavailable, not unlimited)', async () => {
    const result = await stack.adapters.limitAlert(baseInput({ level: 'warning', limitProvenance: 'UNCONFIGURED' }));
    expect(result.suppressed).toBe(true);
    expect(result.suppressReason).toBe('limit_unavailable_not_unlimited');
  });

  it('L08: critical + MISSING provenance is suppressed', async () => {
    const result = await stack.adapters.limitAlert(baseInput({ level: 'critical', limitProvenance: 'MISSING' }));
    expect(result.suppressed).toBe(true);
    expect(result.suppressReason).toBe('limit_unavailable_not_unlimited');
  });

  it('L09: hard + UNCONFIGURED provenance is ALSO suppressed (unavailable applies to every level)', async () => {
    const result = await stack.adapters.limitAlert(
      baseInput({ level: 'hard', limitProvenance: 'UNCONFIGURED', thresholdPercent: undefined }),
    );
    expect(result.suppressed).toBe(true);
    expect(result.suppressReason).toBe('limit_unavailable_not_unlimited');
  });

  it('L10: usage category preference disabled suppresses dispatch', async () => {
    const user = await createPlatformUserFixture(prisma, { email: `l10-${randomUUID()}@test.local` });
    await stack.prisma.platformNotificationPreference.create({
      data: { platformUserId: user.id, category: 'usage', channel: 'email', enabled: false },
    });
    const result = await stack.adapters.limitAlert(
      baseInput({ recipientPlatformUserId: user.id }),
    );
    expect(result.accepted).toBe(false);
    expect(result.suppressReason).toBe('preference_disabled');
    expect(stack.emailService.sent).toHaveLength(0);
  });

  it('L11: LIMIT_WARNING_RATIO and LIMIT_CRITICAL_RATIO thresholds are 0.8 / 0.95', () => {
    expect(LIMIT_WARNING_RATIO).toBe(0.8);
    expect(LIMIT_CRITICAL_RATIO).toBe(0.95);
  });

  it('L12: warning and critical levels for the same evidence do not dedupe against each other', async () => {
    const evidenceId = randomUUID();
    const warning = await stack.adapters.limitAlert(baseInput({ evidenceId, level: 'warning' }));
    const critical = await stack.adapters.limitAlert(baseInput({ evidenceId, level: 'critical' }));
    expect(warning.accepted).toBe(true);
    expect(critical.accepted).toBe(true);
    expect(warning.intentId).not.toBe(critical.intentId);
    expect(stack.emailService.sent).toHaveLength(2);
  });

  it('L13: identical evidenceId/level/windowKey replays idempotently (same intentId, single email)', async () => {
    const evidenceId = randomUUID();
    const email = `l13-${randomUUID()}@test.local`;
    const input = baseInput({ evidenceId, level: 'warning', recipientEmail: email });
    const first = await stack.adapters.limitAlert(input);
    const second = await stack.adapters.limitAlert(input);
    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(true);
    expect(second.replayed).toBe(true);
    expect(second.intentId).toBe(first.intentId);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(1);
  });

  it('L14: rendered email contains organizationName, limitKey, currentUsage and effectiveLimit', async () => {
    const email = `l14-${randomUUID()}@test.local`;
    await stack.adapters.limitAlert(
      baseInput({ recipientEmail: email, organizationName: 'Beta Clinic', limitKey: 'whatsapp_daily', effectiveLimit: '50', currentUsage: '41' }),
    );
    const sent = stack.emailService.sent.find((m) => m.to === email);
    expect(sent?.text).toContain('Beta Clinic');
    expect(sent?.text).toContain('whatsapp_daily');
    expect(sent?.text).toContain('41');
    expect(sent?.text).toContain('50');
  });

  it('L15: hard level dispatches without thresholdPercent (not required for hard_denied template)', async () => {
    const result = await stack.adapters.limitAlert(
      baseInput({ level: 'hard', thresholdPercent: undefined, currentUsage: '' }),
    );
    expect(result.accepted).toBe(true);
  });

  it('L16: missing required effectiveLimit throws a validation error', async () => {
    await expect(stack.adapters.limitAlert(baseInput({ effectiveLimit: '' }))).rejects.toThrow(
      /missing required template variable effectiveLimit/i,
    );
  });
});
