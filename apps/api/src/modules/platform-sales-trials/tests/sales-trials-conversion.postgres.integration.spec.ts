/**
 * Flexible Step 25 — conversion PV01–PV10, dispositions, and the read-only preview.
 * Contract: docs/TRIAL_CREATION_AND_CUSTOMER_CONVERSION.md §11–§12
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createSalesTrialsStack, REP_TRIAL_PERMS } from './sales-trials-stack';
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
import { SalesTrialForbiddenError } from '../domain/sales-trial.errors';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;
const DAY_MS = 86_400_000;

describeDb('Step 25 Trial conversion + entitlement preview (PostgreSQL)', () => {
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
    const trialPv = await createPlanVersionFixture(prisma, {
      canonicalKeySuffix: `trial_${randomUUID().slice(0, 6)}`,
      moduleKeys: keys.moduleKeys.slice(0, 3),
      specialtyKeys: keys.specialtyKeys.slice(0, 2),
      limits: [{ canonicalKey: keys.limitKeys[0], valueText: '7' }],
      trialDefaultEnabled: true,
      trialDefaultDays: 14,
    });
    trialPlanVersionId = trialPv.planVersionId;
    const paidPv = await createPlanVersionFixture(prisma, {
      canonicalKeySuffix: `paid_${randomUUID().slice(0, 6)}`,
      paid: true,
      moduleKeys: keys.moduleKeys.slice(0, 2),
      specialtyKeys: keys.specialtyKeys.slice(0, 3),
      limits: [
        { canonicalKey: keys.limitKeys[0], valueText: '25' },
        { canonicalKey: keys.limitKeys[1], unlimited: true },
      ],
    });
    paidPlanVersionId = paidPv.planVersionId;
  });

  async function manager() {
    const roleKeys = [SALES_MANAGER_ROLE];
    const user = await createPlatformUserFixture(prisma, {
      email: `trial-conv-${randomUUID()}@test.local`,
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
        organizationName: 'Conversion Clinic',
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

  // ─── conversion Plan Version gates PV01–PV10 ──────────────────────────────

  it('PV07: conversion to a DRAFT Plan Version is denied', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const draft = await createPlanVersionFixture(prisma, { lifecycle: 'DRAFT', paid: true });
    await expect(
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        {
          targetPaidPlanVersionId: draft.planVersionId,
          expectedRowVersion: trial.rowVersion,
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'plan_version_not_published' });
  });

  it('PV08: conversion to a RETIRED Plan Version is denied', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const retired = await createPlanVersionFixture(prisma, {
      lifecycle: 'RETIRED',
      paid: true,
      withFingerprint: true,
    });
    await expect(
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        {
          targetPaidPlanVersionId: retired.planVersionId,
          expectedRowVersion: trial.rowVersion,
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'plan_version_retired' });
  });

  it('PV09: conversion target must be a paid Plan Version', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const unpriced = await createPlanVersionFixture(prisma, { paid: false });
    await expect(
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        {
          targetPaidPlanVersionId: unpriced.planVersionId,
          expectedRowVersion: trial.rowVersion,
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'plan_version_not_paid' });
  });

  it('PV10: a missing conversion target id is denied (no implicit latest published)', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await expect(
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        { targetPaidPlanVersionId: randomUUID(), expectedRowVersion: trial.rowVersion },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'plan_version_missing' });
  });

  // ─── conversion behaviour ─────────────────────────────────────────────────

  it('C25-01: conversion moves the commercial SoR to the paid Plan Version and marks the Trial CONVERTED', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const result = await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: trial.rowVersion,
        reason: 'customer signed',
      },
      randomUUID(),
    );
    expect(result.status).toBe('CONVERTED');
    expect(result.replayed).toBe(false);

    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('CONVERTED');
    const current = await prisma.platformSubscriptionCommercialConfig.findFirstOrThrow({
      where: { platformTenantId: trial.platformTenantId!, isCurrent: true },
    });
    expect(current.lifecycle).toBe('ACTIVE_COMMERCIAL');
    expect(current.planVersionId).toBe(paidPlanVersionId);
    expect(row.commercialConfigId).toBe(current.id);
  });

  it('C25-02: conversion writes exactly one durable conversion record', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const conversions = await prisma.platformSalesTrialConversion.findMany({
      where: { trialId: trial.id },
    });
    expect(conversions).toHaveLength(1);
    expect(conversions[0].targetPaidPlanVersionId).toBe(paidPlanVersionId);
    expect(conversions[0].actorPlatformUserId).toBe(actor.user.id);
  });

  it('C25-03: conversion emits one outbox event carrying governance identifiers only', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const events = await prisma.outboxEvent.findMany({
      where: { aggregateId: trial.id, eventType: TRIAL_CONVERSION_OUTBOX_EVENT_TYPE },
    });
    expect(events).toHaveLength(1);
    const payload = events[0].payload as Record<string, unknown>;
    expect(payload.trialId).toBe(trial.id);
    expect(payload.targetPaidPlanVersionId).toBe(paidPlanVersionId);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toMatch(/priceAmountMinor|passwordHash|patient/i);
  });

  it('C25-04: EER resolves the paid Plan Version after conversion', async () => {
    const { actor, stack, trial, tenantId } = await seedActiveTrial();
    await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const bundle = await createSalesTrialsStack(prisma).eer.resolveEffectiveEntitlements(tenantId);
    expect(bundle.source).toBe('SNAPSHOT');
    expect(bundle.specialties).toContain(keys.specialtyKeys[2]);
    const limit = await createSalesTrialsStack(prisma).eer.getLimit(tenantId, keys.limitKeys[0]);
    expect(limit.state).toBe('CONFIGURED');
    expect(limit.state === 'CONFIGURED' && limit.value).toBe('25');
  });

  it('C25-05: conversion retains the frozen attribution snapshot', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.attributionSnapshotJson).toEqual(trial.attributionSnapshot);
  });

  it('C25-06: conversion is idempotent on replay of the same key', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const key = randomUUID();
    const first = await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      key,
    );
    const replay = await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      key,
    );
    expect(replay.replayed).toBe(true);
    expect(replay.conversion.id).toBe(first.conversion.id);
    expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: trial.id, eventType: TRIAL_CONVERSION_OUTBOX_EVENT_TYPE },
      }),
    ).toBe(1);
  });

  it('C25-07: converting an already CONVERTED Trial returns the existing conversion', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const first = await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const again = await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    expect(again.replayed).toBe(true);
    expect(again.conversion.id).toBe(first.conversion.id);
  });

  it('C25-08: an EXPIRED Trial is not convertible', async () => {
    const { actor, trial } = await seedActiveTrial({ durationDays: 1 });
    const future = createSalesTrialsStack(prisma, {
      clock: () => new Date(Date.now() + 5 * DAY_MS),
    });
    await future.expiry.processDueTrials(10);
    const reloaded = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    const stack = createSalesTrialsStack(prisma);
    await expect(
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        {
          targetPaidPlanVersionId: paidPlanVersionId,
          expectedRowVersion: reloaded.rowVersion,
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'trial_status_not_convertible' });
  });

  it('C25-09: conversion without trial.convert permission is forbidden', async () => {
    const { actor, trial } = await seedActiveTrial();
    const repStack = createSalesTrialsStack(prisma, {
      permissions: [...REP_TRIAL_PERMS, 'sales-lead.assign'],
    });
    await expect(
      repStack.conversion.convert(
        actor.claims,
        repStack.perms,
        trial.id,
        { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
        randomUUID(),
      ),
    ).rejects.toBeInstanceOf(SalesTrialForbiddenError);
  });

  it('C25-10: stale expectedRowVersion is an OCC conflict', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await expect(
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion - 1 },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'row_version_conflict' });
  });

  it('C25-11: conversion audits exactly once and the tenant returns to paid ACTIVE', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CONVERTED, trial.id)).toBe(1);
    const platformTenant = await prisma.platformTenant.findUniqueOrThrow({
      where: { id: trial.platformTenantId! },
    });
    expect(platformTenant.status).toBe('ACTIVE');
    expect(platformTenant.trialEndsAt).toBeNull();
  });

  // ─── trial-only grant dispositions ────────────────────────────────────────

  it('D01: conversion fails safely when a trial-only grant has no disposition', async () => {
    const { actor, stack, trial } = await seedActiveTrial({
      trialOnlyGrants: [{ grantKey: 'addon.trial_boost', kind: 'ADD_ON', trialOnly: true }],
    });
    await expect(
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'disposition_required' });
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('ACTIVE');
  });

  it('D02: ambiguous dispositions for the same grant are rejected', async () => {
    const { actor, stack, trial } = await seedActiveTrial({
      trialOnlyGrants: [{ grantKey: 'addon.trial_boost', kind: 'ADD_ON', trialOnly: true }],
    });
    await expect(
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        {
          targetPaidPlanVersionId: paidPlanVersionId,
          expectedRowVersion: trial.rowVersion,
          dispositions: [
            { grantKey: 'addon.trial_boost', disposition: 'EXPIRE_ON_CONVERSION' },
            { grantKey: 'addon.trial_boost', disposition: 'RETAIN_NOT_TRIAL_ONLY' },
          ],
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'disposition_ambiguous' });
  });

  it('D03: MIGRATE_TO_PAID_EQUIVALENT requires an explicit paid equivalent key', async () => {
    const { actor, stack, trial } = await seedActiveTrial({
      trialOnlyGrants: [{ grantKey: 'addon.trial_boost', kind: 'ADD_ON', trialOnly: true }],
    });
    await expect(
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        {
          targetPaidPlanVersionId: paidPlanVersionId,
          expectedRowVersion: trial.rowVersion,
          dispositions: [
            { grantKey: 'addon.trial_boost', disposition: 'MIGRATE_TO_PAID_EQUIVALENT' },
          ],
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'disposition_paid_equivalent_required' });
  });

  it('D04: dispositions referencing unknown grants are rejected', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await expect(
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        {
          targetPaidPlanVersionId: paidPlanVersionId,
          expectedRowVersion: trial.rowVersion,
          dispositions: [{ grantKey: 'addon.never_granted', disposition: 'EXPIRE_ON_CONVERSION' }],
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'disposition_unknown_grant' });
  });

  it('D05: resolved dispositions are persisted and applied to the grant records', async () => {
    const { actor, stack, trial } = await seedActiveTrial({
      trialOnlyGrants: [
        { grantKey: 'addon.trial_boost', kind: 'ADD_ON', trialOnly: true },
        { grantKey: 'override.trial_discount', kind: 'OVERRIDE', trialOnly: true },
      ],
    });
    const result = await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: trial.rowVersion,
        dispositions: [
          { grantKey: 'addon.trial_boost', disposition: 'EXPIRE_ON_CONVERSION' },
          {
            grantKey: 'override.trial_discount',
            disposition: 'MIGRATE_TO_PAID_EQUIVALENT',
            paidEquivalentKey: 'override.paid_discount',
          },
        ],
      },
      randomUUID(),
    );
    expect(result.conversion.dispositions).toHaveLength(2);
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    const grants = row.trialOnlyGrantsJson as Array<Record<string, unknown>>;
    expect(grants.find((g) => g.grantKey === 'addon.trial_boost')?.expiredAt).toBeTruthy();
    expect(grants.find((g) => g.grantKey === 'override.trial_discount')).toMatchObject({
      disposition: 'MIGRATE_TO_PAID_EQUIVALENT',
      paidEquivalentKey: 'override.paid_discount',
      expiredAt: null,
    });
  });

  it('D06: a non-trial-only grant needs no disposition', async () => {
    const { actor, stack, trial } = await seedActiveTrial({
      trialOnlyGrants: [{ grantKey: 'addon.permanent', kind: 'ADD_ON', trialOnly: false }],
    });
    const result = await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    expect(result.status).toBe('CONVERTED');
  });

  // ─── read-only preview (protected SoR delta 0) ────────────────────────────

  it('P25-01: preview leaves every protected SoR delta at 0', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const before = await protectedSoRSnapshot(prisma);
    await stack.preview.preview(actor.claims, stack.perms, trial.id, paidPlanVersionId);
    const after = await protectedSoRSnapshot(prisma);
    const delta = diffSnapshots(before, after);
    for (const [key, value] of Object.entries(delta)) {
      expect({ key, value }).toEqual({ key, value: 0 });
    }
  });

  it('P25-02: repeated previews stay side-effect free', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const before = await protectedSoRSnapshot(prisma);
    for (let i = 0; i < 3; i++) {
      await stack.preview.preview(actor.claims, stack.perms, trial.id, paidPlanVersionId);
    }
    const after = await protectedSoRSnapshot(prisma);
    expect(diffSnapshots(before, after)).toEqual(
      Object.fromEntries(Object.keys(before).map((k) => [k, 0])),
    );
  });

  it('P25-03: preview classifies retained / added / removed entitlements', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const preview = await stack.preview.preview(
      actor.claims,
      stack.perms,
      trial.id,
      paidPlanVersionId,
    );
    expect(preview.retainedEntitlements).toContain(keys.moduleKeys[0]);
    expect(preview.removedEntitlements).toContain(keys.moduleKeys[2]);
    expect(preview.addedEntitlements).toContain(keys.specialtyKeys[2]);
  });

  it('P25-04: preview reports CHANGED limits with exact typed values', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const preview = await stack.preview.preview(
      actor.claims,
      stack.perms,
      trial.id,
      paidPlanVersionId,
    );
    const changed = preview.limits.find((l) => l.canonicalKey === keys.limitKeys[0]);
    expect(changed).toMatchObject({
      trialState: 'CONFIGURED',
      trialValue: '7',
      paidState: 'CONFIGURED',
      paidValue: '25',
      classification: 'CHANGED',
    });
  });

  it('P25-05: preview distinguishes UNCONFIGURED from UNLIMITED', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const preview = await stack.preview.preview(
      actor.claims,
      stack.perms,
      trial.id,
      paidPlanVersionId,
    );
    const added = preview.limits.find((l) => l.canonicalKey === keys.limitKeys[1]);
    expect(added).toMatchObject({
      trialState: 'UNCONFIGURED',
      paidState: 'UNLIMITED',
      classification: 'ADDED',
    });
    expect(preview.unconfiguredVsUnlimited).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalKey: keys.limitKeys[1],
          trialState: 'UNCONFIGURED',
          paidState: 'UNLIMITED',
        }),
      ]),
    );
  });

  it('P25-06: preview lists incompatibilities for selections the paid plan does not grant', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const preview = await stack.preview.preview(
      actor.claims,
      stack.perms,
      trial.id,
      paidPlanVersionId,
    );
    expect(preview.incompatibilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonCode: 'selected_module_not_in_paid_plan',
          subjectKey: keys.moduleKeys[2],
        }),
      ]),
    );
  });

  it('P25-07: preview separates trial-only grants that expire from those that migrate', async () => {
    const { actor, stack, trial } = await seedActiveTrial({
      trialOnlyGrants: [
        { grantKey: 'addon.trial_boost', kind: 'ADD_ON', trialOnly: true },
        { grantKey: keys.moduleKeys[0], kind: 'ADD_ON', trialOnly: true },
      ],
    });
    const preview = await stack.preview.preview(
      actor.claims,
      stack.perms,
      trial.id,
      paidPlanVersionId,
    );
    expect(preview.trialOnlyExpiring).toContain('addon.trial_boost');
    expect(preview.trialOnlyMigrating).toContain(keys.moduleKeys[0]);
    expect(preview.requiredDispositionGrantKeys).toEqual(
      expect.arrayContaining(['addon.trial_boost', keys.moduleKeys[0]]),
    );
  });

  it('P25-08: preview is not an entitlement or runtime license decision', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const preview = await stack.preview.preview(
      actor.claims,
      stack.perms,
      trial.id,
      paidPlanVersionId,
    );
    expect(preview.runtimeSource).toBe('STEP16_SNAPSHOT_STEP18_EER');
    expect(preview.disclaimer).toEqual({
      readOnly: true,
      doesNotMutateProtectedSoR: true,
      notEntitlementDecision: true,
      notRuntimeLicenseDecision: true,
    });
  });

  it('P25-09: preview requires trial.preview-entitlements', async () => {
    const { actor, trial } = await seedActiveTrial();
    const limited = createSalesTrialsStack(prisma, {
      permissions: ['trial.view', 'sales-lead.assign'],
    });
    await expect(
      limited.preview.preview(actor.claims, limited.perms, trial.id, paidPlanVersionId),
    ).rejects.toBeInstanceOf(SalesTrialForbiddenError);
  });

  it('P25-10: preview rejects an unpublished comparison target', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const draft = await createPlanVersionFixture(prisma, { lifecycle: 'DRAFT', paid: true });
    await expect(
      stack.preview.preview(actor.claims, stack.perms, trial.id, draft.planVersionId),
    ).rejects.toMatchObject({ code: 'plan_version_not_published' });
  });

  // ─── conversion failure atomicity ─────────────────────────────────────────

  it('F25-01: injected outbox failure rolls the conversion back entirely', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    setSalesTrialsFailureInjection('conversion_outbox_write');
    await expect(
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearSalesTrialsFailureInjection();
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('ACTIVE');
    expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(0);
    expect(await prisma.outboxEvent.count({ where: { aggregateId: trial.id } })).toBe(0);
    expect(
      await prisma.platformSalesIdempotencyRecord.count({ where: { status: 'pending' } }),
    ).toBe(0);
  });

  it('F25-02: a rolled-back conversion can be retried successfully', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    setSalesTrialsFailureInjection('conversion_outbox_write');
    await expect(
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    clearSalesTrialsFailureInjection();
    const reloaded = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    const retried = await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: reloaded.rowVersion,
      },
      randomUUID(),
    );
    expect(retried.status).toBe('CONVERTED');
  });
});
