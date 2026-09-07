/**
 * Flexible Step 25 — narrow audit matrix evidence closure A11–A26.
 * Contract: docs/TRIAL_CREATION_AND_CUSTOMER_CONVERSION.md §8–§10, §14
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createSalesTrialsStack } from './sales-trials-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupSalesTrialTables,
  clearSalesTrialsFailureInjection,
  countTrialAudits,
  countTrialAuditsFor,
  createPlanVersionFixture,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  createRepProfile,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  deletePlanVersionFixtures,
  platformClaims,
  platformDbSecurityEnabled,
  resolveCatalogKeys,
  SALES_MANAGER_ROLE,
  SALES_REP_ROLE,
  setSalesTrialsFailureInjection,
  type TrialCatalogKeys,
} from './sales-trials-db.harness';
import {
  SALES_TRIAL_AUDIT_ACTIONS,
  SALES_TRIAL_AUDIT_CATEGORY,
  TRIAL_CONVERSION_OUTBOX_EVENT_TYPE,
} from '../platform-sales-trials.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;
const DAY_MS = 86_400_000;

describeDb('Step 25 Trial audit matrix A11–A26 (PostgreSQL)', () => {
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

  afterEach(() => {
    clearSalesTrialsFailureInjection();
  });

  async function manager() {
    const roleKeys = [SALES_MANAGER_ROLE];
    const user = await createPlatformUserFixture(prisma, {
      email: `trial-a11a26-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    return { user, claims: platformClaims(user.id, session.sessionId, roleKeys) };
  }

  function createInput(overrides: Record<string, unknown> = {}) {
    return {
      organizationName: 'Audit Matrix Clinic',
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

  function futureStack(days = 30) {
    return createSalesTrialsStack(prisma, { clock: () => new Date(Date.now() + days * DAY_MS) });
  }

  it('A11: owner/attribution set — CREATED audit includes ownerRepresentativeId; create replay CREATED delta +0', async () => {
    const actor = await manager();
    const repUser = await createPlatformUserFixture(prisma, {
      email: `trial-a11-rep-${randomUUID()}@test.local`,
      roleKeys: [SALES_REP_ROLE],
    });
    const rep = await createRepProfile(prisma, repUser.id);
    const stack = createSalesTrialsStack(prisma);
    const key = randomUUID();
    const before = await countTrialAudits(prisma, SALES_TRIAL_AUDIT_ACTIONS.CREATED);

    const trial = await stack.trials.create(
      actor.claims,
      stack.perms,
      createInput({ ownerRepresentativeId: rep.id }),
      key,
    );
    const afterFirst = await countTrialAudits(prisma, SALES_TRIAL_AUDIT_ACTIONS.CREATED);
    expect(afterFirst - before).toBe(1);

    const created = await prisma.auditEntry.findFirstOrThrow({
      where: { resourceId: trial.id, action: SALES_TRIAL_AUDIT_ACTIONS.CREATED },
    });
    const details = created.details as Record<string, unknown>;
    expect(details.ownerRepresentativeId).toBe(rep.id);
    expect(trial.attributionSnapshot).toMatchObject({
      ownerRepresentativeId: rep.id,
      salesAttributionId: rep.id,
    });

    await stack.trials.create(
      actor.claims,
      stack.perms,
      createInput({ ownerRepresentativeId: rep.id }),
      key,
    );
    expect(await countTrialAudits(prisma, SALES_TRIAL_AUDIT_ACTIONS.CREATED)).toBe(afterFirst);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CREATED, trial.id)).toBe(1);
  });

  it('A12: Trial activated — ACTIVE status + PROVISIONED audit delta=1; create replay PROVISIONED +0', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    const key = randomUUID();
    const before = await countTrialAudits(prisma, SALES_TRIAL_AUDIT_ACTIONS.PROVISIONED);

    const trial = await stack.trials.create(actor.claims, stack.perms, createInput(), key);
    expect(trial.status).toBe('ACTIVE');
    const afterFirst = await countTrialAudits(prisma, SALES_TRIAL_AUDIT_ACTIONS.PROVISIONED);
    expect(afterFirst - before).toBe(1);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.PROVISIONED, trial.id)).toBe(
      1,
    );

    await stack.trials.create(actor.claims, stack.perms, createInput(), key);
    expect(await countTrialAudits(prisma, SALES_TRIAL_AUDIT_ACTIONS.PROVISIONED)).toBe(afterFirst);
  });

  // Policy: architecture has no separate extension-request audit — only EXTENDED on success
  // (no request-vs-apply audit split). A13 is therefore N/A by design.
  it('A13: N/A — no separate extension-requested audit (policy: only EXTENDED on success)', async () => {
    expect(true).toBe(true);
  });

  it('A14: extension applied — EXTENDED delta=1 on first; replay same key +0; history count=1', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const key = randomUUID();
    const body = {
      extensionDays: 5,
      reason: 'A14 applied',
      expectedRowVersion: trial.rowVersion,
    };
    const before = await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXTENDED, trial.id);

    await stack.trials.extend(actor.claims, stack.perms, trial.id, body, key);
    const afterFirst = await countTrialAuditsFor(
      prisma,
      SALES_TRIAL_AUDIT_ACTIONS.EXTENDED,
      trial.id,
    );
    expect(afterFirst - before).toBe(1);

    await stack.trials.extend(actor.claims, stack.perms, trial.id, body, key);
    expect(
      await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXTENDED, trial.id),
    ).toBe(afterFirst);
    expect(
      await prisma.platformSalesTrialExtensionHistory.count({ where: { trialId: trial.id } }),
    ).toBe(1);
  });

  it('A15: extension denied — no permission → EXTENDED delta=0 (PASS: no false success audit)', async () => {
    const { actor, trial } = await seedActiveTrial();
    const limited = createSalesTrialsStack(prisma, { permissions: ['trial.view'] });
    const before = await countTrialAudits(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXTENDED);

    await expect(
      limited.trials.extend(
        actor.claims,
        limited.perms,
        trial.id,
        { extensionDays: 3, reason: 'A15 denied', expectedRowVersion: trial.rowVersion },
        randomUUID(),
      ),
    ).rejects.toBeTruthy();

    expect(await countTrialAudits(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXTENDED)).toBe(before);
  });

  it('A16: expiry processed — EXPIRED delta=1; second processDueTrials → +0', async () => {
    const { trial } = await seedActiveTrial({ durationDays: 1 });
    const stack = futureStack();
    const before = await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXPIRED, trial.id);

    await stack.expiry.processDueTrials(10);
    const afterFirst = await countTrialAuditsFor(
      prisma,
      SALES_TRIAL_AUDIT_ACTIONS.EXPIRED,
      trial.id,
    );
    expect(afterFirst - before).toBe(1);

    await stack.expiry.processDueTrials(10);
    expect(
      await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXPIRED, trial.id),
    ).toBe(afterFirst);
  });

  it('A17: trial-only grant expired — EXPIRED audit details include disposition; grant disposition applied', async () => {
    const { trial } = await seedActiveTrial({
      durationDays: 1,
      trialOnlyGrants: [{ grantKey: 'addon.trial_boost', kind: 'ADD_ON', trialOnly: true }],
    });
    const before = await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXPIRED, trial.id);

    await futureStack().expiry.processDueTrials(10);
    expect(
      await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXPIRED, trial.id),
    ).toBe(before + 1);

    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    const grants = row.trialOnlyGrantsJson as Array<Record<string, unknown>>;
    expect(grants.find((g) => g.grantKey === 'addon.trial_boost')?.expiredAt).toBeTruthy();

    const audit = await prisma.auditEntry.findFirstOrThrow({
      where: { action: SALES_TRIAL_AUDIT_ACTIONS.EXPIRED, resourceId: trial.id },
    });
    const dispositions = (audit.details as Record<string, unknown>)
      .grantDispositions as Array<Record<string, string>>;
    expect(dispositions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          grantKey: 'addon.trial_boost',
          disposition: 'EXPIRE_ON_TRIAL_EXPIRY',
        }),
      ]),
    );
  });

  it('A18: N/A policy — entitlement comparison preview is read-only (audit delta=0)', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const before = await countTrialAudits(prisma, SALES_TRIAL_AUDIT_ACTIONS.CREATED);
    const beforeAll = await prisma.auditEntry.count({
      where: { resourceId: trial.id, category: SALES_TRIAL_AUDIT_CATEGORY },
    });

    await stack.preview.preview(actor.claims, stack.perms, trial.id, paidPlanVersionId);

    expect(await countTrialAudits(prisma, SALES_TRIAL_AUDIT_ACTIONS.CREATED)).toBe(before);
    const afterAll = await prisma.auditEntry.count({
      where: { resourceId: trial.id, category: SALES_TRIAL_AUDIT_CATEGORY },
    });
    expect(afterAll - beforeAll).toBe(0);
  });

  // Policy: architecture has no separate conversion-requested audit — only CONVERTED on success.
  it('A19: N/A — no separate conversion-requested audit (policy: only CONVERTED on success)', async () => {
    expect(true).toBe(true);
  });

  it('A20: paid Plan Version selected — CONVERTED audit details contain targetPaidPlanVersionId', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const row = await prisma.auditEntry.findFirstOrThrow({
      where: { resourceId: trial.id, action: SALES_TRIAL_AUDIT_ACTIONS.CONVERTED },
    });
    const details = row.details as Record<string, unknown>;
    expect(details.targetPaidPlanVersionId).toBe(paidPlanVersionId);
  });

  it('A21: conversion succeeded — CONVERTED delta=1; status CONVERTED', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const before = await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CONVERTED, trial.id);

    const result = await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    expect(result.status).toBe('CONVERTED');
    expect(
      await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CONVERTED, trial.id),
    ).toBe(before + 1);
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('CONVERTED');
  });

  it('A22: conversion failed — conversion_commercial_update leaves ACTIVE; CONVERTED audit delta=0', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const before = await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CONVERTED, trial.id);

    setSalesTrialsFailureInjection('conversion_commercial_update');
    await expect(
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
        randomUUID(),
      ),
    ).rejects.toBeTruthy();
    clearSalesTrialsFailureInjection();

    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('ACTIVE');
    expect(
      await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CONVERTED, trial.id),
    ).toBe(before);
    expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(
      0,
    );
  });

  it('A23: conversion event emitted — outbox cardinality=1 (SoR); replay keeps outbox=1 and CONVERTED audit=1', async () => {
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
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CONVERTED, trial.id)).toBe(
      1,
    );

    await stack.conversion.convert(actor.claims, stack.perms, trial.id, body, key);
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: trial.id, eventType: TRIAL_CONVERSION_OUTBOX_EVENT_TYPE },
      }),
    ).toBe(1);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CONVERTED, trial.id)).toBe(
      1,
    );
  });

  it('A24: provisioning handoff — PROVISIONED details include platformTenantId + commercialConfigId; config exists', async () => {
    const { trial } = await seedActiveTrial();
    expect(trial.status).toBe('ACTIVE');
    expect(trial.platformTenantId).toBeTruthy();
    expect(trial.commercialConfigId).toBeTruthy();

    const provisioned = await prisma.auditEntry.findFirstOrThrow({
      where: { resourceId: trial.id, action: SALES_TRIAL_AUDIT_ACTIONS.PROVISIONED },
    });
    const details = provisioned.details as Record<string, unknown>;
    expect(details.platformTenantId).toBe(trial.platformTenantId);
    expect(details.commercialConfigId).toBe(trial.commercialConfigId);

    const config = await prisma.platformSubscriptionCommercialConfig.findUnique({
      where: { id: trial.commercialConfigId! },
    });
    expect(config).toBeTruthy();
  });

  it('A25: lifecycle handoff — convert → PlatformTenant ACTIVE + trialEndsAt null; expiry → SUSPENDED', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const platformTenant = await prisma.platformTenant.findUniqueOrThrow({
      where: { id: trial.platformTenantId! },
    });
    expect(platformTenant.status).toBe('ACTIVE');
    expect(platformTenant.trialEndsAt).toBeNull();

    // Independent expiry lifecycle handoff on a second Trial (not inferred from other cases).
    const { trial: expiryTrial } = await seedActiveTrial({ durationDays: 1 });
    const expiryStack = futureStack();
    await expiryStack.expiry.processDueTrials(10);
    const expiredTenant = await prisma.platformTenant.findUniqueOrThrow({
      where: { id: expiryTrial.platformTenantId! },
    });
    expect(expiredTenant.status).toBe('SUSPENDED');
    expect(expiredTenant.suspensionReason).toContain('sales_trial_expired');
  });

  it('A26: manual retry/recovery — after expiry_lifecycle_handoff failure, reconcileExpiredLifecycle recovers', async () => {
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
    expect(tenantAfterFailure.status).toBe('ACTIVE');

    const repaired = await stack.expiry.reconcileExpiredLifecycle(10);
    expect(repaired).toBe(1);
    const tenantAfterRepair = await prisma.platformTenant.findUniqueOrThrow({
      where: { id: trial.platformTenantId! },
    });
    expect(tenantAfterRepair.status).toBe('SUSPENDED');
  });
});
