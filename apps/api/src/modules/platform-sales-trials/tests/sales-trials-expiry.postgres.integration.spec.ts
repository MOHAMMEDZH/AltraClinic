/**
 * Flexible Step 25 — expiry enforcement X01–X12 and U25-01–U25-08.
 *
 * Runtime denial is proven through the Step 18 EER (module/feature/limit resolution),
 * never through UI state. Contract: docs/TRIAL_CREATION_AND_CUSTOMER_CONVERSION.md §10
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
import { SALES_TRIAL_AUDIT_ACTIONS } from '../platform-sales-trials.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;
const DAY_MS = 86_400_000;

describeDb('Step 25 Trial expiry X01–X12 + U25 limits (PostgreSQL)', () => {
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
      limits: keys.limitKeys.slice(0, 2).map((canonicalKey) => ({ canonicalKey, valueText: '7' })),
      trialDefaultEnabled: true,
      trialDefaultDays: 14,
    });
    trialPlanVersionId = pv.planVersionId;
  });

  async function manager() {
    const roleKeys = [SALES_MANAGER_ROLE];
    const user = await createPlatformUserFixture(prisma, {
      email: `trial-exp-${randomUUID()}@test.local`,
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
        organizationName: 'Expiry Clinic',
        facilityTypeKey: keys.facilityTypeKey,
        trialPlanVersionId,
        selectedModuleKeys: keys.moduleKeys.slice(0, 3),
        selectedSpecialtyKeys: keys.specialtyKeys.slice(0, 2),
        ...overrides,
      } as never,
      randomUUID(),
    );
    const tenantId = (
      await prisma.platformTenant.findUniqueOrThrow({ where: { id: trial.platformTenantId! } })
    ).tenantId;
    return { actor, stack, trial, tenantId };
  }

  /** A stack whose UTC clock is past the Trial window. */
  function futureStack(days = 30) {
    return createSalesTrialsStack(prisma, { clock: () => new Date(Date.now() + days * DAY_MS) });
  }

  it('X01: due Trials are claimed by the indexed processor and transition to EXPIRED', async () => {
    const { trial } = await seedActiveTrial({ durationDays: 1 });
    const run = await futureStack().expiry.processDueTrials(10);
    expect(run.scanned).toBe(1);
    expect(run.expired).toBe(1);
    expect(run.trialIds).toEqual([trial.id]);
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('EXPIRED');
    expect(row.expiredAt).toBeTruthy();
  });

  it('X02: Trials whose window has not elapsed are not scanned', async () => {
    await seedActiveTrial({ durationDays: 30 });
    const run = await createSalesTrialsStack(prisma).expiry.processDueTrials(10);
    expect(run.scanned).toBe(0);
    expect(run.expired).toBe(0);
  });

  it('X03: expiry is exclusive — now === expiresAt is already expired', async () => {
    const { trial } = await seedActiveTrial({ durationDays: 1 });
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    const atBoundary = createSalesTrialsStack(prisma, {
      clock: () => new Date(row.expiresAt!.getTime()),
    });
    const run = await atBoundary.expiry.processDueTrials(10);
    expect(run.expired).toBe(1);
  });

  it('X04: expiry hands the tenant to the Step 19 deny path (PlatformTenant SUSPENDED)', async () => {
    const { trial } = await seedActiveTrial({ durationDays: 1 });
    await futureStack().expiry.processDueTrials(10);
    const platformTenant = await prisma.platformTenant.findUniqueOrThrow({
      where: { id: trial.platformTenantId! },
    });
    expect(platformTenant.status).toBe('SUSPENDED');
    expect(platformTenant.suspensionReason).toContain('sales_trial_expired');
  });

  it('X05: EER denies module access after expiry (runtime denial, not UI)', async () => {
    const { tenantId } = await seedActiveTrial({ durationDays: 1 });
    const stack = createSalesTrialsStack(prisma);
    const before = await stack.eer.canUseModule(tenantId, keys.moduleKeys[0]);
    expect(before.allowed).toBe(true);

    await futureStack().expiry.processDueTrials(10);
    const after = await stack.eer.canUseModule(tenantId, keys.moduleKeys[0]);
    expect(after.allowed).toBe(false);
    expect(after.code).toBe('platform_tenant_suspended');
  });

  it('X06: EER bundle resolves a deny code after expiry even with a warmed cache', async () => {
    const { tenantId } = await seedActiveTrial({ durationDays: 1 });
    const stack = createSalesTrialsStack(prisma);
    const warm = await stack.eer.resolveEffectiveEntitlements(tenantId);
    expect(warm.modules.length).toBeGreaterThan(0);

    // Same service instance (warm process-local cache) must not preserve allow.
    await futureStack().expiry.processDueTrials(10);
    const cold = await stack.eer.resolveEffectiveEntitlements(tenantId);
    expect(cold.code).toBe('platform_tenant_suspended');
    expect(cold.modules).toEqual([]);
  });

  it('X07: expiry audits exactly once per Trial', async () => {
    const { trial } = await seedActiveTrial({ durationDays: 1 });
    const stack = futureStack();
    await stack.expiry.processDueTrials(10);
    await stack.expiry.processDueTrials(10);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXPIRED, trial.id)).toBe(1);
  });

  it('X08: re-running the processor is replay-safe (no second transition)', async () => {
    const { trial } = await seedActiveTrial({ durationDays: 1 });
    const stack = futureStack();
    await stack.expiry.processDueTrials(10);
    const second = await stack.expiry.processDueTrials(10);
    expect(second.scanned).toBe(0);
    expect(second.expired).toBe(0);
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.rowVersion).toBe(trial.rowVersion + 1);
  });

  it('X09: a stale claim loses the OCC race without double-expiring', async () => {
    const { trial } = await seedActiveTrial({ durationDays: 1 });
    const stack = futureStack();
    await stack.expiry.processDueTrials(10);
    // Replaying the claim with the pre-transition rowVersion must be rejected.
    const outcome = await stack.expiry.expireTrialIfDue(trial.id);
    expect(outcome).toBe('skipped');
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXPIRED, trial.id)).toBe(1);
  });

  it('X10: trial-only grants receive the EXPIRE_ON_TRIAL_EXPIRY disposition', async () => {
    const { trial } = await seedActiveTrial({
      durationDays: 1,
      trialOnlyGrants: [
        { grantKey: 'addon.trial_boost', kind: 'ADD_ON', trialOnly: true },
        { grantKey: 'addon.permanent', kind: 'ADD_ON', trialOnly: false },
      ],
    });
    await futureStack().expiry.processDueTrials(10);
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    const grants = row.trialOnlyGrantsJson as Array<Record<string, unknown>>;
    const boost = grants.find((g) => g.grantKey === 'addon.trial_boost');
    const permanent = grants.find((g) => g.grantKey === 'addon.permanent');
    expect(boost?.expiredAt).toBeTruthy();
    expect(permanent?.expiredAt).toBeNull();
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
        expect.objectContaining({
          grantKey: 'addon.permanent',
          disposition: 'RETAIN_NOT_TRIAL_ONLY',
        }),
      ]),
    );
  });

  it('X11: expiry does not delete tenant data', async () => {
    const { trial, tenantId } = await seedActiveTrial({ durationDays: 1 });
    await futureStack().expiry.processDueTrials(10);
    expect(await prisma.tenant.count({ where: { id: tenantId } })).toBe(1);
    expect(await prisma.platformTenant.count({ where: { id: trial.platformTenantId! } })).toBe(1);
    expect(
      await prisma.platformSubscriptionCommercialConfig.count({
        where: { id: trial.commercialConfigId! },
      }),
    ).toBe(1);
  });

  it('X12: batch limit is honoured and ordering is by expiresAt then id', async () => {
    const first = await seedActiveTrial({ durationDays: 1 });
    const secondPv = await createPlanVersionFixture(prisma, {
      moduleKeys: keys.moduleKeys.slice(0, 2),
    });
    const second = await seedActiveTrial({
      durationDays: 3,
      trialPlanVersionId: secondPv.planVersionId,
    });
    const stack = futureStack();
    const run = await stack.expiry.processDueTrials(1);
    expect(run.scanned).toBe(1);
    expect(run.trialIds).toEqual([first.trial.id]);
    const remaining = await prisma.platformSalesTrial.findUniqueOrThrow({
      where: { id: second.trial.id },
    });
    expect(remaining.status).toBe('ACTIVE');
  });

  it('X13: lifecycle handoff failure leaves a durable EXPIRED row that reconciliation repairs', async () => {
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

  // ─── U25 usage/limit semantics via EER ────────────────────────────────────

  it('U25-01: configured Trial limits resolve as CONFIGURED with the exact typed value', async () => {
    const { tenantId } = await seedActiveTrial();
    const stack = createSalesTrialsStack(prisma);
    const limit = await stack.eer.getLimit(tenantId, keys.limitKeys[0]);
    expect(limit.state).toBe('CONFIGURED');
    expect(limit.state === 'CONFIGURED' && limit.value).toBe('7');
  });

  it('U25-02: a limit with no Plan Version row is UNCONFIGURED (missing is never Unlimited)', async () => {
    const { tenantId } = await seedActiveTrial();
    const stack = createSalesTrialsStack(prisma);
    const limit = await stack.eer.getLimit(tenantId, keys.limitKeys[3] ?? keys.limitKeys[2]);
    expect(limit.state).toBe('UNCONFIGURED');
  });

  it('U25-03: an explicitly unlimited Trial limit resolves as UNLIMITED', async () => {
    const unlimitedPv = await createPlanVersionFixture(prisma, {
      moduleKeys: keys.moduleKeys.slice(0, 2),
      limits: [{ canonicalKey: keys.limitKeys[0], unlimited: true }],
    });
    const { tenantId } = await seedActiveTrial({ trialPlanVersionId: unlimitedPv.planVersionId });
    const stack = createSalesTrialsStack(prisma);
    const limit = await stack.eer.getLimit(tenantId, keys.limitKeys[0]);
    expect(limit.state).toBe('UNLIMITED');
  });

  it('U25-04: Trial limits come from the Step 16 snapshot (SNAPSHOT source, not LEGACY)', async () => {
    const { tenantId } = await seedActiveTrial();
    const stack = createSalesTrialsStack(prisma);
    const limit = await stack.eer.getLimit(tenantId, keys.limitKeys[0]);
    expect(limit.source).toBe('SNAPSHOT');
  });

  it('U25-05: after expiry every limit resolves UNCONFIGURED under the deny code', async () => {
    const { tenantId } = await seedActiveTrial({ durationDays: 1 });
    await futureStack().expiry.processDueTrials(10);
    const stack = createSalesTrialsStack(prisma);
    const limit = await stack.eer.getLimit(tenantId, keys.limitKeys[0]);
    expect(limit.state).toBe('UNCONFIGURED');
    expect(limit.code).toBe('platform_tenant_suspended');
  });

  it('U25-06: extension does not reset or widen resolved Trial limits', async () => {
    const { actor, stack, trial, tenantId } = await seedActiveTrial();
    const before = await stack.eer.getLimit(tenantId, keys.limitKeys[0]);
    await stack.trials.extend(
      actor.claims,
      stack.perms,
      trial.id,
      { extensionDays: 5, reason: 'limits unchanged', expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const after = await stack.eer.getLimit(tenantId, keys.limitKeys[0]);
    expect(after.state).toBe(before.state);
    expect(after.state === 'CONFIGURED' && after.value).toBe(
      before.state === 'CONFIGURED' ? before.value : null,
    );
    expect(after.fingerprint).toBe(before.fingerprint);
  });

  it('U25-07: specialties resolve from the Trial Plan Version definition only', async () => {
    const { tenantId } = await seedActiveTrial();
    const stack = createSalesTrialsStack(prisma);
    const granted = await stack.eer.canUseSpecialty(tenantId, keys.specialtyKeys[0]);
    expect(granted.allowed).toBe(true);
    const notGranted = await stack.eer.canUseSpecialty(tenantId, keys.specialtyKeys[3]);
    expect(notGranted.allowed).toBe(false);
  });

  it('U25-08: Trial governance rows never carry usage counters (U01 stays the meter authority)', async () => {
    const { trial } = await seedActiveTrial();
    const row = (await prisma.platformSalesTrial.findUniqueOrThrow({
      where: { id: trial.id },
    })) as unknown as Record<string, unknown>;
    for (const forbidden of ['usageCount', 'usageCounters', 'meteredUsage', 'consumedUnits']) {
      expect(row[forbidden]).toBeUndefined();
    }
  });
});
