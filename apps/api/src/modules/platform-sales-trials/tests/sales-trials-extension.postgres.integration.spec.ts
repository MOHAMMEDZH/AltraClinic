/**
 * Flexible Step 25 — extension policy E01–E12.
 * Contract: docs/TRIAL_CREATION_AND_CUSTOMER_CONVERSION.md §5
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createSalesTrialsStack, EXTENDER_TRIAL_PERMS } from './sales-trials-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupSalesTrialTables,
  clearSalesTrialsFailureInjection,
  countTrialAuditsFor,
  createPlanVersionFixture,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  deletePlanVersionFixtures,
  platformClaims,
  platformDbSecurityEnabled,
  resolveCatalogKeys,
  SALES_MANAGER_ROLE,
  setSalesTrialsFailureInjection,
  type TrialCatalogKeys,
} from './sales-trials-db.harness';
import {
  SALES_TRIAL_AUDIT_ACTIONS,
  SALES_TRIAL_PERMISSIONS,
  TRIAL_MAX_SINGLE_EXTENSION_DAYS,
} from '../platform-sales-trials.constants';
import { SalesTrialForbiddenError } from '../domain/sales-trial.errors';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;
const DAY_MS = 86_400_000;

describeDb('Step 25 Trial extension E01–E12 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let keys: TrialCatalogKeys;
  let trialPlanVersionId: string;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    keys = await resolveCatalogKeys(prisma);
  });

  afterAll(async () => {
    await cleanupSalesTrialTables(prisma);
    await deletePlanVersionFixtures(prisma);
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    clearSalesTrialsFailureInjection();
    process.env.NODE_ENV = 'test';
    await cleanupSalesTrialTables(prisma);
    await deletePlanVersionFixtures(prisma);
    await prisma.platformRefreshToken.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUser.deleteMany({});
    const pv = await createPlanVersionFixture(prisma, {
      moduleKeys: keys.moduleKeys.slice(0, 3),
      specialtyKeys: keys.specialtyKeys.slice(0, 2),
      trialDefaultEnabled: true,
      trialDefaultDays: 14,
    });
    trialPlanVersionId = pv.planVersionId;
  });

  async function manager() {
    const roleKeys = [SALES_MANAGER_ROLE];
    const user = await createPlatformUserFixture(prisma, {
      email: `trial-ext-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    return { user, claims: platformClaims(user.id, session.sessionId, roleKeys) };
  }

  async function seedActiveTrial(overrides: Record<string, unknown> = {}) {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    const trial = await stack.trials.create(
      actor.claims,
      stack.perms,
      {
        organizationName: 'Extension Clinic',
        facilityTypeKey: keys.facilityTypeKey,
        trialPlanVersionId,
        selectedModuleKeys: keys.moduleKeys.slice(0, 3),
        selectedSpecialtyKeys: keys.specialtyKeys.slice(0, 2),
        ...overrides,
      } as never,
      randomUUID(),
    );
    return { actor, stack, trial };
  }

  it('E01: extension without trial.extend permission is forbidden', async () => {
    const { actor, trial } = await seedActiveTrial();
    const limited = createSalesTrialsStack(prisma, {
      permissions: [SALES_TRIAL_PERMISSIONS.view, 'sales-lead.assign'],
    });
    await expect(
      limited.trials.extend(
        actor.claims,
        limited.perms,
        trial.id,
        { extensionDays: 5, reason: 'pilot', expectedRowVersion: trial.rowVersion },
        randomUUID(),
      ),
    ).rejects.toBeInstanceOf(SalesTrialForbiddenError);
  });

  it('E02: exceptional extension requires trial.extend.exceptional', async () => {
    const { actor, trial } = await seedActiveTrial();
    const stack = createSalesTrialsStack(prisma, {
      permissions: [...EXTENDER_TRIAL_PERMS, 'sales-lead.assign'],
    });
    await expect(
      stack.trials.extend(
        actor.claims,
        stack.perms,
        trial.id,
        {
          extensionDays: 5,
          reason: 'exception approved verbally',
          expectedRowVersion: trial.rowVersion,
          exceptional: true,
        },
        randomUUID(),
      ),
    ).rejects.toBeInstanceOf(SalesTrialForbiddenError);
  });

  it('E03: reason is mandatory for every extension', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await expect(
      stack.trials.extend(
        actor.claims,
        stack.perms,
        trial.id,
        { extensionDays: 5, reason: '   ', expectedRowVersion: trial.rowVersion },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'reason_required' });
  });

  it('E04: single extension window is bounded and never 0 = unlimited', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await expect(
      stack.trials.extend(
        actor.claims,
        stack.perms,
        trial.id,
        { extensionDays: 0, reason: 'unlimited attempt', expectedRowVersion: trial.rowVersion },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'extension_below_minimum' });
    await expect(
      stack.trials.extend(
        actor.claims,
        stack.perms,
        trial.id,
        {
          extensionDays: TRIAL_MAX_SINGLE_EXTENSION_DAYS + 1,
          reason: 'too long',
          expectedRowVersion: trial.rowVersion,
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'extension_above_maximum' });
  });

  it('E05: EXPIRED Trials are not extendable without the exceptional path', async () => {
    const { actor, stack, trial } = await seedActiveTrial({ durationDays: 1 });
    // The Trial window elapses by advancing the injectable UTC clock, never by rewriting
    // instants (the window-order CHECK constraint forbids backdating expiresAt).
    const future = createSalesTrialsStack(prisma, {
      clock: () => new Date(Date.now() + 2 * DAY_MS),
    });
    const expired = await future.expiry.processDueTrials(10);
    expect(expired.expired).toBe(1);
    const reloaded = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    await expect(
      stack.trials.extend(
        actor.claims,
        stack.perms,
        trial.id,
        { extensionDays: 5, reason: 'late save', expectedRowVersion: reloaded.rowVersion },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'trial_expired_extension_denied' });
  });

  it('E06: extension budget is bounded — the third extension of a 2-budget Trial is denied', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const first = await stack.trials.extend(
      actor.claims,
      stack.perms,
      trial.id,
      { extensionDays: 3, reason: 'first', expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const second = await stack.trials.extend(
      actor.claims,
      stack.perms,
      trial.id,
      { extensionDays: 3, reason: 'second', expectedRowVersion: first.rowVersion },
      randomUUID(),
    );
    expect(second.extensionCount).toBe(2);
    await expect(
      stack.trials.extend(
        actor.claims,
        stack.perms,
        trial.id,
        { extensionDays: 3, reason: 'third', expectedRowVersion: second.rowVersion },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'max_extensions_reached' });
  });

  it('E07: stale expectedRowVersion is an OCC conflict', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await expect(
      stack.trials.extend(
        actor.claims,
        stack.perms,
        trial.id,
        { extensionDays: 3, reason: 'stale', expectedRowVersion: trial.rowVersion - 1 },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'row_version_conflict' });
  });

  it('E08: durable idempotency replays the extension without double-applying days', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const key = randomUUID();
    const first = await stack.trials.extend(
      actor.claims,
      stack.perms,
      trial.id,
      { extensionDays: 4, reason: 'replay probe', expectedRowVersion: trial.rowVersion },
      key,
    );
    const replay = await stack.trials.extend(
      actor.claims,
      stack.perms,
      trial.id,
      { extensionDays: 4, reason: 'replay probe', expectedRowVersion: trial.rowVersion },
      key,
    );
    expect(replay.expiresAt).toBe(first.expiresAt);
    expect(replay.extensionCount).toBe(1);
    expect(
      await prisma.platformSalesTrialExtensionHistory.count({ where: { trialId: trial.id } }),
    ).toBe(1);
  });

  it('E09: each accepted extension appends exactly one forward-only history row', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const extended = await stack.trials.extend(
      actor.claims,
      stack.perms,
      trial.id,
      { extensionDays: 6, reason: 'history probe', expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const rows = await prisma.platformSalesTrialExtensionHistory.findMany({
      where: { trialId: trial.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].extensionDays).toBe(6);
    expect(rows[0].newExpiresAt.getTime()).toBeGreaterThan(rows[0].previousExpiresAt.getTime());
    expect(new Date(extended.expiresAt!).getTime()).toBe(rows[0].newExpiresAt.getTime());
  });

  it('E10: extension audits exactly once with the reason retained', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await stack.trials.extend(
      actor.claims,
      stack.perms,
      trial.id,
      { extensionDays: 6, reason: 'security review delay', expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXTENDED, trial.id)).toBe(1);
    const entry = await prisma.auditEntry.findFirstOrThrow({
      where: { action: SALES_TRIAL_AUDIT_ACTIONS.EXTENDED, resourceId: trial.id },
    });
    expect(entry.reason).toBe('security review delay');
    expect((entry.details as Record<string, unknown>).usageCountersReset).toBe(false);
  });

  it('E11: extension does not reset U01 usage counters or the commercial snapshot identity', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const snapshotBefore = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: trial.commercialConfigId! },
    });
    await stack.trials.extend(
      actor.claims,
      stack.perms,
      trial.id,
      { extensionDays: 6, reason: 'no usage reset', expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const snapshotAfter = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: trial.commercialConfigId! },
    });
    expect(snapshotAfter.id).toBe(snapshotBefore.id);
    expect(snapshotAfter.fingerprint).toBe(snapshotBefore.fingerprint);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({
        where: { configId: trial.commercialConfigId! },
      }),
    ).toBe(1);
  });

  it('E12: extension moves the Trial window and the tenant trial end instant forward together', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const extended = await stack.trials.extend(
      actor.claims,
      stack.perms,
      trial.id,
      { extensionDays: 9, reason: 'window probe', expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const gainedDays =
      (new Date(extended.expiresAt!).getTime() - new Date(trial.expiresAt!).getTime()) / DAY_MS;
    expect(Math.round(gainedDays)).toBe(9);
    const platformTenant = await prisma.platformTenant.findUniqueOrThrow({
      where: { id: trial.platformTenantId! },
    });
    expect(platformTenant.trialEndsAt?.getTime()).toBe(new Date(extended.expiresAt!).getTime());
  });

  it('E13: injected extension history failure rolls back the whole extension', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    setSalesTrialsFailureInjection('extension_history_write');
    await expect(
      stack.trials.extend(
        actor.claims,
        stack.perms,
        trial.id,
        { extensionDays: 5, reason: 'injected', expectedRowVersion: trial.rowVersion },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearSalesTrialsFailureInjection();
    const reloaded = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(reloaded.extensionCount).toBe(0);
    expect(reloaded.expiresAt?.getTime()).toBe(new Date(trial.expiresAt!).getTime());
    expect(
      await prisma.platformSalesTrialExtensionHistory.count({ where: { trialId: trial.id } }),
    ).toBe(0);
    expect(await prisma.platformSalesIdempotencyRecord.count({ where: { status: 'pending' } })).toBe(
      0,
    );
  });
});
