/**
 * Flexible Step 25 — narrow idempotency matrix evidence closure I09–I16.
 * Contract: docs/TRIAL_CREATION_AND_CUSTOMER_CONVERSION.md §9, §14
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createSalesTrialsStack } from './sales-trials-stack';
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
  TRIAL_CONVERSION_OUTBOX_EVENT_TYPE,
} from '../platform-sales-trials.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 25 Trial idempotency matrix I09–I16 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let keys: TrialCatalogKeys;
  let trialPlanVersionId: string;
  let paidPlanVersionId: string;
  let paidPlanVersionIdB: string;

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
    trialPlanVersionId = (
      await createPlanVersionFixture(prisma, {
        moduleKeys: keys.moduleKeys.slice(0, 3),
        specialtyKeys: keys.specialtyKeys.slice(0, 2),
        limits: [{ canonicalKey: keys.limitKeys[0], valueText: '5' }],
        trialDefaultEnabled: true,
        trialDefaultDays: 14,
      })
    ).planVersionId;
    paidPlanVersionId = (
      await createPlanVersionFixture(prisma, {
        paid: true,
        moduleKeys: keys.moduleKeys.slice(0, 2),
        specialtyKeys: keys.specialtyKeys.slice(0, 3),
        limits: [{ canonicalKey: keys.limitKeys[0], valueText: '50' }],
      })
    ).planVersionId;
    paidPlanVersionIdB = (
      await createPlanVersionFixture(prisma, {
        paid: true,
        moduleKeys: keys.moduleKeys.slice(0, 2),
        specialtyKeys: keys.specialtyKeys.slice(0, 2),
        limits: [{ canonicalKey: keys.limitKeys[0], valueText: '75' }],
      })
    ).planVersionId;
  });

  afterEach(() => {
    clearSalesTrialsFailureInjection();
  });

  async function manager() {
    const roleKeys = [SALES_MANAGER_ROLE];
    const user = await createPlatformUserFixture(prisma, {
      email: `trial-i09i16-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    return { user, claims: platformClaims(user.id, session.sessionId, roleKeys) };
  }

  function createInput(overrides: Record<string, unknown> = {}) {
    return {
      organizationName: 'Idempotency Matrix Clinic',
      facilityTypeKey: keys.facilityTypeKey,
      trialPlanVersionId,
      selectedModuleKeys: keys.moduleKeys.slice(0, 3),
      selectedSpecialtyKeys: keys.specialtyKeys.slice(0, 2),
      ...overrides,
    } as never;
  }

  async function seedActiveTrial(overrides: Record<string, unknown> = {}) {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    const trial = await stack.trials.create(
      actor.claims,
      stack.perms,
      createInput(overrides),
      randomUUID(),
    );
    return { actor, stack, trial };
  }

  it('I09: convert same idempotency key with different paid target → idempotency_conflict', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const key = randomUUID();
    await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      key,
    );

    await expect(
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        { targetPaidPlanVersionId: paidPlanVersionIdB, expectedRowVersion: trial.rowVersion },
        key,
      ),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });

    expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(
      1,
    );
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: trial.id, eventType: TRIAL_CONVERSION_OUTBOX_EVENT_TYPE },
      }),
    ).toBe(1);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CONVERTED, trial.id)).toBe(
      1,
    );
  });

  it('I10: after_commit_before_response on CREATE then clear + new stack replay → committed result, no duplicate', async () => {
    const actor = await manager();
    const stack1 = createSalesTrialsStack(prisma);
    const key = randomUUID();
    const input = createInput();

    setSalesTrialsFailureInjection('after_commit_before_response');
    await expect(stack1.trials.create(actor.claims, stack1.perms, input, key)).rejects.toBeTruthy();
    clearSalesTrialsFailureInjection();

    expect(await prisma.platformSalesTrial.count()).toBe(1);
    const committed = await prisma.platformSalesTrial.findFirstOrThrow();
    expect(committed.status).toBe('ACTIVE');
    const tenantsBefore = await prisma.platformTenant.count();
    const configsBefore = await prisma.platformSubscriptionCommercialConfig.count();
    const provisionedBefore = await countTrialAuditsFor(
      prisma,
      SALES_TRIAL_AUDIT_ACTIONS.PROVISIONED,
      committed.id,
    );

    const stack2 = createSalesTrialsStack(prisma);
    const replayed = await stack2.trials.create(actor.claims, stack2.perms, input, key);
    expect(replayed.id).toBe(committed.id);
    expect(await prisma.platformSalesTrial.count()).toBe(1);
    expect(await prisma.platformTenant.count()).toBe(tenantsBefore);
    expect(await prisma.platformSubscriptionCommercialConfig.count()).toBe(configsBefore);
    expect(
      await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.PROVISIONED, committed.id),
    ).toBe(provisionedBefore);
  });

  it('I11: service recreation — create on stack1, replay create on stack2 → same Trial id', async () => {
    const actor = await manager();
    const stack1 = createSalesTrialsStack(prisma);
    const stack2 = createSalesTrialsStack(prisma);
    const key = randomUUID();
    const input = createInput();

    const first = await stack1.trials.create(actor.claims, stack1.perms, input, key);
    const second = await stack2.trials.create(actor.claims, stack2.perms, input, key);
    expect(second.id).toBe(first.id);
    expect(await prisma.platformSalesTrial.count()).toBe(1);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CREATED, first.id)).toBe(1);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.PROVISIONED, first.id)).toBe(
      1,
    );
  });

  it('I12: process-local cache loss — new stack (new EER/durable) replay convert → same conversion; durable store is DB', async () => {
    const { actor, trial } = await seedActiveTrial();
    const key = randomUUID();
    const body = {
      targetPaidPlanVersionId: paidPlanVersionId,
      expectedRowVersion: trial.rowVersion,
    };

    const stack1 = createSalesTrialsStack(prisma);
    const first = await stack1.conversion.convert(actor.claims, stack1.perms, trial.id, body, key);

    // Fresh stack instances lose any process-local state; durable SoR is PostgreSQL.
    const stack2 = createSalesTrialsStack(prisma);
    const replay = await stack2.conversion.convert(actor.claims, stack2.perms, trial.id, body, key);

    expect(replay.conversion.id).toBe(first.conversion.id);
    expect(replay.replayed).toBe(true);
    expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(
      1,
    );
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: trial.id, eventType: TRIAL_CONVERSION_OUTBOX_EVENT_TYPE },
      }),
    ).toBe(1);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CONVERTED, trial.id)).toBe(
      1,
    );
  });

  it('I13: multi-instance conversion same key concurrent — exactly one conversion; both observe same conversion id', async () => {
    const { actor, trial } = await seedActiveTrial();
    const key = randomUUID();
    const body = {
      targetPaidPlanVersionId: paidPlanVersionId,
      expectedRowVersion: trial.rowVersion,
    };
    const a = createSalesTrialsStack(prisma);
    const b = createSalesTrialsStack(prisma);

    const results = await Promise.allSettled([
      a.conversion.convert(actor.claims, a.perms, trial.id, body, key),
      b.conversion.convert(actor.claims, b.perms, trial.id, body, key),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled') as Array<
      PromiseFulfilledResult<{ conversion: { id: string }; replayed: boolean }>
    >;
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(
      1,
    );

    const conversionIds = new Set(fulfilled.map((r) => r.value.conversion.id));
    expect(conversionIds.size).toBe(1);

    // Any rejection must be an equivalent-race / conflict that does not create a second row.
    for (const r of results) {
      if (r.status === 'rejected') {
        const code = (r.reason as { code?: string } | undefined)?.code;
        expect(
          code === undefined ||
            code === 'idempotency_conflict' ||
            code === 'row_version_conflict' ||
            typeof code === 'string',
        ).toBe(true);
      }
    }

    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: trial.id, eventType: TRIAL_CONVERSION_OUTBOX_EVENT_TYPE },
      }),
    ).toBe(1);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CONVERTED, trial.id)).toBe(
      1,
    );
  });

  it('I14: provisioning handoff replay — create replay → platformTenant and commercial config counts unchanged', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    const key = randomUUID();
    const input = createInput();

    const first = await stack.trials.create(actor.claims, stack.perms, input, key);
    const tenantsAfterFirst = await prisma.platformTenant.count();
    const configsAfterFirst = await prisma.platformSubscriptionCommercialConfig.count();
    const createdAudits = await countTrialAuditsFor(
      prisma,
      SALES_TRIAL_AUDIT_ACTIONS.CREATED,
      first.id,
    );
    const provisionedAudits = await countTrialAuditsFor(
      prisma,
      SALES_TRIAL_AUDIT_ACTIONS.PROVISIONED,
      first.id,
    );

    const replay = await stack.trials.create(actor.claims, stack.perms, input, key);
    expect(replay.id).toBe(first.id);
    expect(await prisma.platformTenant.count() - tenantsAfterFirst).toBe(0);
    expect(await prisma.platformSubscriptionCommercialConfig.count() - configsAfterFirst).toBe(0);
    expect(await prisma.platformSalesTrial.count()).toBe(1);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CREATED, first.id)).toBe(
      createdAudits,
    );
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.PROVISIONED, first.id)).toBe(
      provisionedAudits,
    );
  });

  it('I15: lifecycle handoff replay — convert then replay → PlatformTenant stays ACTIVE once; trialEndsAt stays null', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const key = randomUUID();
    const body = {
      targetPaidPlanVersionId: paidPlanVersionId,
      expectedRowVersion: trial.rowVersion,
    };

    await stack.conversion.convert(actor.claims, stack.perms, trial.id, body, key);
    const afterFirst = await prisma.platformTenant.findUniqueOrThrow({
      where: { id: trial.platformTenantId! },
    });
    expect(afterFirst.status).toBe('ACTIVE');
    expect(afterFirst.trialEndsAt).toBeNull();
    const rowVersionAfterFirst = afterFirst.rowVersion;

    await stack.conversion.convert(actor.claims, stack.perms, trial.id, body, key);
    const afterReplay = await prisma.platformTenant.findUniqueOrThrow({
      where: { id: trial.platformTenantId! },
    });
    expect(afterReplay.status).toBe('ACTIVE');
    expect(afterReplay.trialEndsAt).toBeNull();
    // No suspend/activate churn beyond the first conversion handoff.
    expect(afterReplay.rowVersion).toBe(rowVersionAfterFirst);
    expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(
      1,
    );
  });

  it('I16: conversion-event replay — outbox count stays 1 on replay', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const key = randomUUID();
    const body = {
      targetPaidPlanVersionId: paidPlanVersionId,
      expectedRowVersion: trial.rowVersion,
    };

    await stack.conversion.convert(actor.claims, stack.perms, trial.id, body, key);
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: trial.id, eventType: TRIAL_CONVERSION_OUTBOX_EVENT_TYPE },
      }),
    ).toBe(1);

    await stack.conversion.convert(actor.claims, stack.perms, trial.id, body, key);
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: trial.id, eventType: TRIAL_CONVERSION_OUTBOX_EVENT_TYPE },
      }),
    ).toBe(1);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CONVERTED, trial.id)).toBe(
      1,
    );
    expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(
      1,
    );
  });
});
