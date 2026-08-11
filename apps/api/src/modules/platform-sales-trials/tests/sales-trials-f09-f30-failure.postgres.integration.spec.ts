/**
 * Flexible Step 25 — failure-injection closure F09–F30.
 * Patterns: governance F01–F08; conversion F25-01/02 (different namespace — do not rename).
 * Contract: docs/TRIAL_CREATION_AND_CUSTOMER_CONVERSION.md §8–§10
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
  diffSnapshots,
  platformClaims,
  platformDbSecurityEnabled,
  protectedSoRSnapshot,
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
const DAY_MS = 86_400_000;

describeDb('Step 25 Trial failure injection F09–F30 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let keys: TrialCatalogKeys;
  let trialPlanVersionId: string;
  let paidPlanVersionId: string;

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
  });

  async function manager() {
    const roleKeys = [SALES_MANAGER_ROLE];
    const user = await createPlatformUserFixture(prisma, {
      email: `trial-f09-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    return { user, claims: platformClaims(user.id, session.sessionId, roleKeys) };
  }

  function createInput(overrides: Record<string, unknown> = {}) {
    return {
      organizationName: 'Failure Clinic',
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
    const tenantId = (
      await prisma.platformTenant.findUniqueOrThrow({ where: { id: trial.platformTenantId! } })
    ).tenantId;
    return { actor, stack, trial, tenantId };
  }

  function futureStack(days = 30) {
    return createSalesTrialsStack(prisma, { clock: () => new Date(Date.now() + days * DAY_MS) });
  }

  function convertBody(trial: { rowVersion: number }, overrides: Record<string, unknown> = {}) {
    return {
      targetPaidPlanVersionId: paidPlanVersionId,
      expectedRowVersion: trial.rowVersion,
      ...overrides,
    };
  }

  async function outboxCount(trialId: string): Promise<number> {
    return prisma.outboxEvent.count({
      where: { aggregateId: trialId, eventType: TRIAL_CONVERSION_OUTBOX_EVENT_TYPE },
    });
  }

  async function conversionCount(trialId: string): Promise<number> {
    return prisma.platformSalesTrialConversion.count({ where: { trialId } });
  }

  async function pendingIdempotencyCount(): Promise<number> {
    return prisma.platformSalesIdempotencyRecord.count({ where: { status: 'pending' } });
  }

  // F01 already proves Model B containment for after_trial_draft_insert; this adjacency
  // covers selectors introduced in F09–F30 (brief, non-gate-ID).
  it('containment: F09/F26 selectors inert when NODE_ENV≠test', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    setSalesTrialsFailureInjection('after_tenant_provisioning');
    try {
      const trial = await stack.trials.create(
        actor.claims,
        stack.perms,
        createInput({ organizationName: 'Containment Clinic' }),
        randomUUID(),
      );
      expect(trial.status).toBe('ACTIVE');
    } finally {
      process.env.NODE_ENV = previous;
      clearSalesTrialsFailureInjection();
    }
  });

  it('F09: provisioning request failure — after_tenant_provisioning → no ACTIVE; not falsely provisioned', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    setSalesTrialsFailureInjection('after_tenant_provisioning');
    await expect(
      stack.trials.create(actor.claims, stack.perms, createInput(), randomUUID()),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearSalesTrialsFailureInjection();

    expect(await prisma.platformSalesTrial.count({ where: { status: 'ACTIVE' } })).toBe(0);
    const provisioned = await prisma.auditEntry.count({
      where: { action: SALES_TRIAL_AUDIT_ACTIONS.PROVISIONED, category: 'sales_trial_management' },
    });
    expect(provisioned).toBe(0);
    expect(await prisma.platformSalesTrialConversion.count()).toBe(0);
    expect(await pendingIdempotencyCount()).toBe(0);
  });

  it('F10: lifecycle handoff failure — expiry_lifecycle_handoff → recoverable via reconcileExpiredLifecycle', async () => {
    const { trial } = await seedActiveTrial({ durationDays: 1 });
    const stack = futureStack();
    setSalesTrialsFailureInjection('expiry_lifecycle_handoff');
    await expect(stack.expiry.processDueTrials(10)).rejects.toMatchObject({
      code: 'injected_failure',
    });
    clearSalesTrialsFailureInjection();

    const afterFailure = await prisma.platformSalesTrial.findUniqueOrThrow({
      where: { id: trial.id },
    });
    expect(afterFailure.status).toBe('EXPIRED');
    const tenantAfterFailure = await prisma.platformTenant.findUniqueOrThrow({
      where: { id: trial.platformTenantId! },
    });
    // Durable EXPIRED without silent lifecycle lie — tenant still ACTIVE until reconcile.
    expect(tenantAfterFailure.status).toBe('ACTIVE');
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXPIRED, trial.id)).toBe(1);

    const repaired = await stack.expiry.reconcileExpiredLifecycle(10);
    expect(repaired).toBe(1);
    const tenantAfterRepair = await prisma.platformTenant.findUniqueOrThrow({
      where: { id: trial.platformTenantId! },
    });
    expect(tenantAfterRepair.status).toBe('SUSPENDED');
  });

  it('F11: EER invalidation failure on convert — safe error; durable convert; new EER from SoR', async () => {
    const { actor, stack, trial, tenantId } = await seedActiveTrial();
    const key = randomUUID();
    const body = convertBody(trial);
    // Warm process-local cache so stale trial allow would be the failure mode if trusted.
    const warm = await stack.eer.resolveEffectiveEntitlements(tenantId);
    expect(warm.source).toBe('SNAPSHOT');
    expect(warm.modules).toContain(keys.moduleKeys[2]);

    setSalesTrialsFailureInjection('eer_invalidation');
    await expect(
      stack.conversion.convert(actor.claims, stack.perms, trial.id, body, key),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearSalesTrialsFailureInjection();

    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('CONVERTED');
    expect(await conversionCount(trial.id)).toBe(1);
    expect(await outboxCount(trial.id)).toBe(1);

    // Recovery/replay: same key returns durable result; new EER instance reads paid SoR.
    const stack2 = createSalesTrialsStack(prisma);
    const replay = await stack2.conversion.convert(actor.claims, stack2.perms, trial.id, body, key);
    expect(replay.status).toBe('CONVERTED');
    expect(replay.replayed).toBe(true);
    expect(await conversionCount(trial.id)).toBe(1);

    const cold = await stack2.eer.resolveEffectiveEntitlements(tenantId);
    expect(cold.source).toBe('SNAPSHOT');
    expect(cold.source).not.toBe('LEGACY');
    expect(cold.modules).not.toContain(keys.moduleKeys[2]);
  });

  it('F12: audit write failure — after_audit_staging_before_commit on create → no unaudited ACTIVE', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    setSalesTrialsFailureInjection('after_audit_staging_before_commit');
    await expect(
      stack.trials.create(actor.claims, stack.perms, createInput(), randomUUID()),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearSalesTrialsFailureInjection();

    expect(await prisma.platformSalesTrial.count({ where: { status: 'ACTIVE' } })).toBe(0);
    const createdAudits = await prisma.auditEntry.count({
      where: { action: SALES_TRIAL_AUDIT_ACTIONS.CREATED, category: 'sales_trial_management' },
    });
    expect(createdAudits).toBe(0);
    expect(await pendingIdempotencyCount()).toBe(0);
  });

  it('F13: after durable idempotency claim — after_idempotency_claim → claim released; retry succeeds', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    const key = randomUUID();
    const input = createInput({ organizationName: 'F13 Retry Clinic' });
    setSalesTrialsFailureInjection('after_idempotency_claim');
    await expect(stack.trials.create(actor.claims, stack.perms, input, key)).rejects.toMatchObject({
      code: 'injected_failure',
    });
    clearSalesTrialsFailureInjection();

    expect(await prisma.platformSalesTrial.count({ where: { status: 'ACTIVE' } })).toBe(0);
    expect(await pendingIdempotencyCount()).toBe(0);

    const retried = await stack.trials.create(actor.claims, stack.perms, input, key);
    expect(retried.status).toBe('ACTIVE');
    expect(
      await prisma.platformSalesTrial.count({ where: { organizationName: 'F13 Retry Clinic' } }),
    ).toBe(1);
  });

  it('F14: before Trial-create commit — before_commit → no ACTIVE; retry works', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    const key = randomUUID();
    const input = createInput({ organizationName: 'F14 Before Commit' });
    setSalesTrialsFailureInjection('before_commit');
    await expect(stack.trials.create(actor.claims, stack.perms, input, key)).rejects.toMatchObject({
      code: 'injected_failure',
    });
    clearSalesTrialsFailureInjection();

    expect(await prisma.platformSalesTrial.count({ where: { status: 'ACTIVE' } })).toBe(0);
    expect(await pendingIdempotencyCount()).toBe(0);

    const retried = await stack.trials.create(actor.claims, stack.perms, input, key);
    expect(retried.status).toBe('ACTIVE');
  });

  it('F15: after create commit before response — throws but ACTIVE committed; replay same key; no duplicate', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    const key = randomUUID();
    const input = createInput({ organizationName: 'F15 Response Loss' });
    setSalesTrialsFailureInjection('after_commit_before_response');
    await expect(stack.trials.create(actor.claims, stack.perms, input, key)).rejects.toMatchObject({
      code: 'injected_failure',
    });
    clearSalesTrialsFailureInjection();

    const committed = await prisma.platformSalesTrial.findFirstOrThrow({
      where: { organizationName: 'F15 Response Loss' },
    });
    expect(committed.status).toBe('ACTIVE');
    expect(
      await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.PROVISIONED, committed.id),
    ).toBe(1);

    const replay = await stack.trials.create(actor.claims, stack.perms, input, key);
    expect(replay.id).toBe(committed.id);
    expect(
      await prisma.platformSalesTrial.count({ where: { organizationName: 'F15 Response Loss' } }),
    ).toBe(1);
    expect(
      await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.PROVISIONED, committed.id),
    ).toBe(1);
  });

  it('F16: extension policy failure — extension_policy_validation → no history; extensionCount unchanged', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    setSalesTrialsFailureInjection('extension_policy_validation');
    await expect(
      stack.trials.extend(
        actor.claims,
        stack.perms,
        trial.id,
        { extensionDays: 5, reason: 'policy fails', expectedRowVersion: trial.rowVersion },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearSalesTrialsFailureInjection();

    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('ACTIVE');
    expect(row.extensionCount).toBe(0);
    expect(
      await prisma.platformSalesTrialExtensionHistory.count({ where: { trialId: trial.id } }),
    ).toBe(0);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXTENDED, trial.id)).toBe(0);
    expect(await pendingIdempotencyCount()).toBe(0);
  });

  it('F17: extension history/audit failure — extension_history_write → no history; EXTENDED audit=0; retry works', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const key = randomUUID();
    const body = {
      extensionDays: 4,
      reason: 'history fails then retry',
      expectedRowVersion: trial.rowVersion,
    };
    setSalesTrialsFailureInjection('extension_history_write');
    await expect(
      stack.trials.extend(actor.claims, stack.perms, trial.id, body, key),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearSalesTrialsFailureInjection();

    expect(
      await prisma.platformSalesTrialExtensionHistory.count({ where: { trialId: trial.id } }),
    ).toBe(0);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXTENDED, trial.id)).toBe(0);
    const mid = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(mid.extensionCount).toBe(0);
    expect(mid.status).toBe('ACTIVE');

    const retried = await stack.trials.extend(actor.claims, stack.perms, trial.id, body, key);
    expect(retried.extensionCount).toBe(1);
    expect(
      await prisma.platformSalesTrialExtensionHistory.count({ where: { trialId: trial.id } }),
    ).toBe(1);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXTENDED, trial.id)).toBe(1);
  });

  it('F18: expiry claim failure — expiry_claim → trial stays ACTIVE; retry processDueTrials succeeds', async () => {
    const { trial } = await seedActiveTrial({ durationDays: 1 });
    const stack = futureStack();
    setSalesTrialsFailureInjection('expiry_claim');
    await expect(stack.expiry.processDueTrials(10)).rejects.toMatchObject({
      code: 'injected_failure',
    });
    clearSalesTrialsFailureInjection();

    expect(
      (await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } })).status,
    ).toBe('ACTIVE');
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXPIRED, trial.id)).toBe(0);

    const run = await stack.expiry.processDueTrials(10);
    expect(run.expired).toBe(1);
    expect(
      (await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } })).status,
    ).toBe('EXPIRED');
  });

  it('F19: expiry transition failure — expiry_grant_disposition → stays ACTIVE; no partial EXPIRED', async () => {
    const { trial } = await seedActiveTrial({
      durationDays: 1,
      trialOnlyGrants: [{ grantKey: 'addon.trial_boost', kind: 'ADD_ON', trialOnly: true }],
    });
    const stack = futureStack();
    setSalesTrialsFailureInjection('expiry_grant_disposition');
    await expect(stack.expiry.processDueTrials(10)).rejects.toMatchObject({
      code: 'injected_failure',
    });
    clearSalesTrialsFailureInjection();

    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('ACTIVE');
    const grants = row.trialOnlyGrantsJson as Array<Record<string, unknown>>;
    expect(grants.find((g) => g.grantKey === 'addon.trial_boost')?.expiredAt ?? null).toBeNull();
    // No EXPIRED row with undisposed trial-only grants.
    expect(await prisma.platformSalesTrial.count({ where: { status: 'EXPIRED' } })).toBe(0);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXPIRED, trial.id)).toBe(0);
  });

  it('F20: trial-only Add-on expiry failure — expiry_grant_disposition → no partial; clear then full disposition', async () => {
    const { trial } = await seedActiveTrial({
      durationDays: 1,
      trialOnlyGrants: [{ grantKey: 'addon.trial_boost', kind: 'ADD_ON', trialOnly: true }],
    });
    const stack = futureStack();
    setSalesTrialsFailureInjection('expiry_grant_disposition');
    await expect(stack.expiry.processDueTrials(10)).rejects.toMatchObject({
      code: 'injected_failure',
    });
    clearSalesTrialsFailureInjection();

    const mid = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(mid.status).toBe('ACTIVE');
    const midGrants = mid.trialOnlyGrantsJson as Array<Record<string, unknown>>;
    expect(midGrants.find((g) => g.grantKey === 'addon.trial_boost')?.expiredAt ?? null).toBeNull();

    const run = await stack.expiry.processDueTrials(10);
    expect(run.expired).toBe(1);
    const done = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(done.status).toBe('EXPIRED');
    const grants = done.trialOnlyGrantsJson as Array<Record<string, unknown>>;
    expect(grants.find((g) => g.grantKey === 'addon.trial_boost')?.expiredAt).toBeTruthy();
  });

  it('F21: trial-only Override expiry failure — expiry_grant_disposition → no partial; clear then full disposition', async () => {
    const { trial } = await seedActiveTrial({
      durationDays: 1,
      trialOnlyGrants: [
        { grantKey: 'override.trial_discount', kind: 'OVERRIDE', trialOnly: true },
      ],
    });
    const stack = futureStack();
    setSalesTrialsFailureInjection('expiry_grant_disposition');
    await expect(stack.expiry.processDueTrials(10)).rejects.toMatchObject({
      code: 'injected_failure',
    });
    clearSalesTrialsFailureInjection();

    const mid = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(mid.status).toBe('ACTIVE');
    const midGrants = mid.trialOnlyGrantsJson as Array<Record<string, unknown>>;
    expect(
      midGrants.find((g) => g.grantKey === 'override.trial_discount')?.expiredAt ?? null,
    ).toBeNull();

    await stack.expiry.processDueTrials(10);
    const done = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(done.status).toBe('EXPIRED');
    const grants = done.trialOnlyGrantsJson as Array<Record<string, unknown>>;
    expect(grants.find((g) => g.grantKey === 'override.trial_discount')?.expiredAt).toBeTruthy();
  });

  it('F22: comparison-preview dependency failure — safe error; protectedSoRSnapshot delta all 0', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const before = await protectedSoRSnapshot(prisma);
    setSalesTrialsFailureInjection('comparison_preview_dependency');
    await expect(
      stack.preview.preview(actor.claims, stack.perms, trial.id, paidPlanVersionId),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearSalesTrialsFailureInjection();

    const delta = diffSnapshots(before, await protectedSoRSnapshot(prisma));
    for (const [key, value] of Object.entries(delta)) {
      expect({ key, value }).toEqual({ key, value: 0 });
    }
    expect(
      (await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } })).status,
    ).toBe('ACTIVE');
  });

  it('F23: conversion write failure — conversion_disposition_validation → ACTIVE; conversion count=0', async () => {
    const { actor, stack, trial } = await seedActiveTrial({
      trialOnlyGrants: [{ grantKey: 'addon.trial_boost', kind: 'ADD_ON', trialOnly: true }],
    });
    setSalesTrialsFailureInjection('conversion_disposition_validation');
    await expect(
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        convertBody(trial, {
          dispositions: [{ grantKey: 'addon.trial_boost', disposition: 'EXPIRE_ON_CONVERSION' }],
        }),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearSalesTrialsFailureInjection();

    expect(
      (await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } })).status,
    ).toBe('ACTIVE');
    expect(await conversionCount(trial.id)).toBe(0);
    expect(await outboxCount(trial.id)).toBe(0);
    expect(await pendingIdempotencyCount()).toBe(0);
  });

  it('F24: paid Subscription mutation failure — conversion_commercial_update → ACTIVE; no CONVERTED', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    setSalesTrialsFailureInjection('conversion_commercial_update');
    await expect(
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        convertBody(trial),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearSalesTrialsFailureInjection();

    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('ACTIVE');
    expect(row.status).not.toBe('CONVERTED');
    expect(await conversionCount(trial.id)).toBe(0);
    expect(await outboxCount(trial.id)).toBe(0);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CONVERTED, trial.id)).toBe(
      0,
    );
  });

  it('F25: conversion event failure — conversion_outbox_write → ACTIVE; outbox=0; conversion=0', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    setSalesTrialsFailureInjection('conversion_outbox_write');
    await expect(
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        convertBody(trial),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearSalesTrialsFailureInjection();

    expect(
      (await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } })).status,
    ).toBe('ACTIVE');
    expect(await conversionCount(trial.id)).toBe(0);
    expect(await outboxCount(trial.id)).toBe(0);
    expect(await pendingIdempotencyCount()).toBe(0);
  });

  it('F26: after conversion commit before response — throws after durable convert; replay → CONVERTED once', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const key = randomUUID();
    const body = convertBody(trial);
    setSalesTrialsFailureInjection('after_conversion_commit_before_response');
    await expect(
      stack.conversion.convert(actor.claims, stack.perms, trial.id, body, key),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearSalesTrialsFailureInjection();

    expect(
      (await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } })).status,
    ).toBe('CONVERTED');
    expect(await conversionCount(trial.id)).toBe(1);
    expect(await outboxCount(trial.id)).toBe(1);

    const replay = await stack.conversion.convert(actor.claims, stack.perms, trial.id, body, key);
    expect(replay.status).toBe('CONVERTED');
    expect(replay.replayed).toBe(true);
    expect(await conversionCount(trial.id)).toBe(1);
    expect(await outboxCount(trial.id)).toBe(1);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CONVERTED, trial.id)).toBe(
      1,
    );
  });

  it('F27: post-commit conversion replay — successful convert then replay → no duplicate effects', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const key = randomUUID();
    const body = convertBody(trial);
    const first = await stack.conversion.convert(actor.claims, stack.perms, trial.id, body, key);
    expect(first.status).toBe('CONVERTED');
    expect(first.replayed).toBe(false);

    const second = await stack.conversion.convert(actor.claims, stack.perms, trial.id, body, key);
    expect(second.conversion.id).toBe(first.conversion.id);
    expect(second.replayed).toBe(true);
    expect(await conversionCount(trial.id)).toBe(1);
    expect(await outboxCount(trial.id)).toBe(1);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CONVERTED, trial.id)).toBe(
      1,
    );
  });

  it('F28: service recreation/cache loss — convert on stack1; stack2 replay → same conversion', async () => {
    const { actor, trial } = await seedActiveTrial();
    const key = randomUUID();
    const body = convertBody(trial);
    const stack1 = createSalesTrialsStack(prisma);
    const first = await stack1.conversion.convert(actor.claims, stack1.perms, trial.id, body, key);

    const stack2 = createSalesTrialsStack(prisma);
    const replay = await stack2.conversion.convert(actor.claims, stack2.perms, trial.id, body, key);
    expect(replay.conversion.id).toBe(first.conversion.id);
    expect(replay.replayed).toBe(true);
    expect(await conversionCount(trial.id)).toBe(1);
    expect(await outboxCount(trial.id)).toBe(1);
  });

  it('F29: multi-instance conversion replay — two stacks same key concurrent → conversion=1', async () => {
    const { actor, trial } = await seedActiveTrial();
    const key = randomUUID();
    const body = convertBody(trial);
    const a = createSalesTrialsStack(prisma);
    const b = createSalesTrialsStack(prisma);

    const results = await Promise.allSettled([
      a.conversion.convert(actor.claims, a.perms, trial.id, body, key),
      b.conversion.convert(actor.claims, b.perms, trial.id, body, key),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    expect(await conversionCount(trial.id)).toBe(1);
    expect(await outboxCount(trial.id)).toBe(1);
    expect(
      (await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } })).status,
    ).toBe('CONVERTED');
  });

  it('F30: runtime-entitlement refresh failure — eer_invalidation on create activation; clear + new EER from SoR', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    setSalesTrialsFailureInjection('eer_invalidation');
    await expect(
      stack.trials.create(
        actor.claims,
        stack.perms,
        createInput({ organizationName: 'F30 EER Refresh' }),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearSalesTrialsFailureInjection();

    // Create activation failed before ACTIVE — no false ACTIVE / LEGACY success.
    expect(await prisma.platformSalesTrial.count({ where: { status: 'ACTIVE' } })).toBe(0);
    expect(await pendingIdempotencyCount()).toBe(0);

    // After clear, a fresh create succeeds; new EER instance reflects authoritative SNAPSHOT SoR.
    const stack2 = createSalesTrialsStack(prisma);
    const trial = await stack2.trials.create(
      actor.claims,
      stack2.perms,
      createInput({ organizationName: 'F30 Recovery Clinic' }),
      randomUUID(),
    );
    expect(trial.status).toBe('ACTIVE');
    const tenantId = (
      await prisma.platformTenant.findUniqueOrThrow({ where: { id: trial.platformTenantId! } })
    ).tenantId;
    const stack3 = createSalesTrialsStack(prisma);
    const bundle = await stack3.eer.resolveEffectiveEntitlements(tenantId);
    expect(bundle.source).toBe('SNAPSHOT');
    expect(bundle.source).not.toBe('LEGACY');
    expect(bundle.modules).toEqual(expect.arrayContaining(keys.moduleKeys.slice(0, 3)));
    const allow = await stack3.eer.canUseModule(tenantId, keys.moduleKeys[0]);
    expect(allow.allowed).toBe(true);
  });
});
