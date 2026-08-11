/**
 * Flexible Step 25 — Trial creation, visibility, and Plan Version gates.
 * Contract: docs/TRIAL_CREATION_AND_CUSTOMER_CONVERSION.md
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createSalesTrialsStack, MANAGER_TRIAL_PERMS, REP_TRIAL_PERMS } from './sales-trials-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupSalesTrialTables,
  clearSalesTrialsFailureInjection,
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
  type TrialCatalogKeys,
} from './sales-trials-db.harness';
import { SALES_TRIAL_AUDIT_ACTIONS } from '../platform-sales-trials.constants';
import {
  SalesTrialForbiddenError,
  SalesTrialNotFoundError,
  SalesTrialValidationError,
} from '../domain/sales-trial.errors';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 25 Trial creation / visibility / plan version gates (PostgreSQL)', () => {
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
      limits: keys.limitKeys.slice(0, 2).map((canonicalKey) => ({ canonicalKey, valueText: '5' })),
      trialDefaultEnabled: true,
      trialDefaultDays: 21,
    });
    trialPlanVersionId = pv.planVersionId;
  });

  async function actor(roleKeys: string[]) {
    const user = await createPlatformUserFixture(prisma, {
      email: `trial-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    return { user, session, claims: platformClaims(user.id, session.sessionId, roleKeys) };
  }

  function createInput(overrides: Record<string, unknown> = {}) {
    return {
      organizationName: 'Trial Clinic',
      facilityTypeKey: keys.facilityTypeKey,
      trialPlanVersionId,
      selectedSpecialtyKeys: keys.specialtyKeys.slice(0, 2),
      selectedModuleKeys: keys.moduleKeys.slice(0, 3),
      ...overrides,
    } as never;
  }

  // ─── create ────────────────────────────────────────────────────────────────

  it('T01: create provisions tenant + commercial config and activates the Trial', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesTrialsStack(prisma);
    const trial = await stack.trials.create(
      manager.claims,
      stack.perms,
      createInput(),
      randomUUID(),
    );

    expect(trial.status).toBe('ACTIVE');
    expect(trial.platformTenantId).toBeTruthy();
    expect(trial.commercialConfigId).toBeTruthy();
    expect(trial.startsAt).toBeTruthy();
    expect(trial.expiresAt).toBeTruthy();

    const config = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: trial.commercialConfigId! },
    });
    expect(config.lifecycle).toBe('ACTIVE_COMMERCIAL');
    expect(config.planVersionId).toBe(trialPlanVersionId);
    const snapshots = await prisma.platformSubscriptionCommercialSnapshot.count({
      where: { configId: config.id },
    });
    expect(snapshots).toBe(1);
  });

  it('T02: duration defaults to the Plan Version trialDefaultDays when enabled', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesTrialsStack(prisma);
    const trial = await stack.trials.create(
      manager.claims,
      stack.perms,
      createInput(),
      randomUUID(),
    );
    const days =
      (new Date(trial.expiresAt!).getTime() - new Date(trial.startsAt!).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(21);
  });

  it('T03: explicit durationDays overrides the Plan Version default', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesTrialsStack(prisma);
    const trial = await stack.trials.create(
      manager.claims,
      stack.perms,
      createInput({ durationDays: 7 }),
      randomUUID(),
    );
    const days =
      (new Date(trial.expiresAt!).getTime() - new Date(trial.startsAt!).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(7);
  });

  it('T04: attribution snapshot is frozen at create', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const repUser = await actor([SALES_REP_ROLE]);
    const rep = await createRepProfile(prisma, repUser.user.id);
    const stack = createSalesTrialsStack(prisma);
    const trial = await stack.trials.create(
      manager.claims,
      stack.perms,
      createInput({ ownerRepresentativeId: rep.id }),
      randomUUID(),
    );
    expect(trial.attributionSnapshot).toMatchObject({
      ownerRepresentativeId: rep.id,
      salesAttributionId: rep.id,
      createdByPlatformUserId: manager.user.id,
    });
    expect(trial.attributionSnapshot?.frozenAt).toBeTruthy();
  });

  it('T05: create emits A01 created and A02 provisioned audits exactly once', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesTrialsStack(prisma);
    const trial = await stack.trials.create(
      manager.claims,
      stack.perms,
      createInput(),
      randomUUID(),
    );
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CREATED, trial.id)).toBe(1);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.PROVISIONED, trial.id)).toBe(
      1,
    );
  });

  it('T06: durable idempotency replays the same Trial for a repeated key', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesTrialsStack(prisma);
    const key = randomUUID();
    const first = await stack.trials.create(manager.claims, stack.perms, createInput(), key);
    const second = await stack.trials.create(manager.claims, stack.perms, createInput(), key);
    expect(second.id).toBe(first.id);
    expect(await prisma.platformSalesTrial.count()).toBe(1);
  });

  it('T07: same Idempotency-Key with a different payload is a 409 conflict', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesTrialsStack(prisma);
    const key = randomUUID();
    await stack.trials.create(manager.claims, stack.perms, createInput(), key);
    await expect(
      stack.trials.create(manager.claims, stack.perms, createInput({ durationDays: 3 }), key),
    ).rejects.toMatchObject({ code: 'idempotency_conflict', httpStatus: 409 });
  });

  it('T08: create without trial.create permission is forbidden', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesTrialsStack(prisma, { permissions: ['trial.view'] });
    await expect(
      stack.trials.create(manager.claims, stack.perms, createInput(), randomUUID()),
    ).rejects.toBeInstanceOf(SalesTrialForbiddenError);
  });

  // ─── Catalog authority gates ───────────────────────────────────────────────

  it('T09: unknown facility type key is rejected by Catalog validation', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesTrialsStack(prisma);
    await expect(
      stack.trials.create(
        manager.claims,
        stack.perms,
        createInput({ facilityTypeKey: 'facility_type.invented_by_trial' }),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'facility_type_unknown' });
  });

  it('T10: specialty key of the wrong Catalog kind is rejected', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesTrialsStack(prisma);
    await expect(
      stack.trials.create(
        manager.claims,
        stack.perms,
        createInput({ selectedSpecialtyKeys: [keys.moduleKeys[0]] }),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'specialty_kind_mismatch' });
  });

  it('T11: unknown module key is rejected', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesTrialsStack(prisma);
    await expect(
      stack.trials.create(
        manager.claims,
        stack.perms,
        createInput({ selectedModuleKeys: ['module.invented_by_trial'] }),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'module_unknown' });
  });

  it('T12: Catalog rows are never mutated by Trial creation', async () => {
    const before = await prisma.healthcareCatalogItem.count();
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesTrialsStack(prisma);
    await stack.trials.create(manager.claims, stack.perms, createInput(), randomUUID());
    expect(await prisma.healthcareCatalogItem.count()).toBe(before);
  });

  // ─── Plan Version gates (PV01–PV06 for activation) ─────────────────────────

  it('PV01: DRAFT Plan Version cannot activate a Trial', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const draft = await createPlanVersionFixture(prisma, { lifecycle: 'DRAFT' });
    const stack = createSalesTrialsStack(prisma);
    await expect(
      stack.trials.create(
        manager.claims,
        stack.perms,
        createInput({ trialPlanVersionId: draft.planVersionId }),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'plan_version_not_published' });
  });

  it('PV02: RETIRED Plan Version cannot activate a Trial', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const retired = await createPlanVersionFixture(prisma, {
      lifecycle: 'RETIRED',
      withFingerprint: true,
    });
    const stack = createSalesTrialsStack(prisma);
    await expect(
      stack.trials.create(
        manager.claims,
        stack.perms,
        createInput({ trialPlanVersionId: retired.planVersionId }),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'plan_version_retired' });
  });

  it('PV03: PUBLISHED Plan Version without a publication fingerprint is rejected', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const noFp = await createPlanVersionFixture(prisma, {
      lifecycle: 'PUBLISHED',
      withFingerprint: false,
    });
    const stack = createSalesTrialsStack(prisma);
    await expect(
      stack.trials.create(
        manager.claims,
        stack.perms,
        createInput({ trialPlanVersionId: noFp.planVersionId }),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'plan_fingerprint_missing' });
  });

  it('PV04: missing Plan Version id is rejected (no implicit latest published substitution)', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesTrialsStack(prisma);
    await expect(
      stack.trials.create(
        manager.claims,
        stack.perms,
        createInput({ trialPlanVersionId: randomUUID() }),
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'plan_version_missing' });
  });

  it('PV05: selected Plan Version is stored durably on the Trial', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesTrialsStack(prisma);
    const trial = await stack.trials.create(
      manager.claims,
      stack.perms,
      createInput(),
      randomUUID(),
    );
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.trialPlanVersionId).toBe(trialPlanVersionId);
  });

  it('PV06: duration falls back to the frozen 14-day default when the Plan Version has no trial default', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const noDefault = await createPlanVersionFixture(prisma, {
      moduleKeys: keys.moduleKeys.slice(0, 2),
      trialDefaultEnabled: false,
    });
    const stack = createSalesTrialsStack(prisma);
    const trial = await stack.trials.create(
      manager.claims,
      stack.perms,
      createInput({ trialPlanVersionId: noDefault.planVersionId }),
      randomUUID(),
    );
    const days =
      (new Date(trial.expiresAt!).getTime() - new Date(trial.startsAt!).getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(14);
  });

  // ─── visibility ───────────────────────────────────────────────────────────

  it('V01: manager scope lists every Trial regardless of owner', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const repUser = await actor([SALES_REP_ROLE]);
    const rep = await createRepProfile(prisma, repUser.user.id);
    const stack = createSalesTrialsStack(prisma);
    await stack.trials.create(
      manager.claims,
      stack.perms,
      createInput({ ownerRepresentativeId: rep.id }),
      randomUUID(),
    );
    const list = await stack.trials.list(manager.claims, stack.perms, { page: 1, pageSize: 25 });
    expect(list.total).toBe(1);
  });

  it('V02: representative scope lists only Trials it owns', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const repA = await actor([SALES_REP_ROLE]);
    const repB = await actor([SALES_REP_ROLE]);
    const profileA = await createRepProfile(prisma, repA.user.id);
    const profileB = await createRepProfile(prisma, repB.user.id);
    const mgr = createSalesTrialsStack(prisma);
    const owned = await mgr.trials.create(
      manager.claims,
      mgr.perms,
      createInput({ ownerRepresentativeId: profileA.id }),
      randomUUID(),
    );
    const otherPv = await createPlanVersionFixture(prisma, {
      moduleKeys: keys.moduleKeys.slice(0, 2),
    });
    await mgr.trials.create(
      manager.claims,
      mgr.perms,
      createInput({
        ownerRepresentativeId: profileB.id,
        trialPlanVersionId: otherPv.planVersionId,
      }),
      randomUUID(),
    );

    const repStack = createSalesTrialsStack(prisma, { permissions: REP_TRIAL_PERMS });
    const list = await repStack.trials.list(repA.claims, repStack.perms, { page: 1, pageSize: 25 });
    expect(list.total).toBe(1);
    expect(list.items[0].id).toBe(owned.id);
  });

  it('V03: representative detail read of another owner Trial is 404 (not 403 disclosure)', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const repA = await actor([SALES_REP_ROLE]);
    const repB = await actor([SALES_REP_ROLE]);
    await createRepProfile(prisma, repA.user.id);
    const profileB = await createRepProfile(prisma, repB.user.id);
    const mgr = createSalesTrialsStack(prisma);
    const trial = await mgr.trials.create(
      manager.claims,
      mgr.perms,
      createInput({ ownerRepresentativeId: profileB.id }),
      randomUUID(),
    );
    const repStack = createSalesTrialsStack(prisma, { permissions: REP_TRIAL_PERMS });
    await expect(
      repStack.trials.getById(repA.claims, repStack.perms, trial.id),
    ).rejects.toBeInstanceOf(SalesTrialNotFoundError);
  });

  it('V04: trial.view without a representative profile yields an empty scope', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const orphan = await actor([SALES_REP_ROLE]);
    const mgr = createSalesTrialsStack(prisma);
    await mgr.trials.create(manager.claims, mgr.perms, createInput(), randomUUID());
    const viewer = createSalesTrialsStack(prisma, { permissions: ['trial.view'] });
    const list = await viewer.trials.list(orphan.claims, viewer.perms, { page: 1, pageSize: 25 });
    expect(list.total).toBe(0);
  });

  it('V05: representative cannot assign another representative as owner', async () => {
    const repA = await actor([SALES_REP_ROLE]);
    const repB = await actor([SALES_REP_ROLE]);
    await createRepProfile(prisma, repA.user.id);
    const profileB = await createRepProfile(prisma, repB.user.id);
    const repStack = createSalesTrialsStack(prisma, { permissions: REP_TRIAL_PERMS });
    await expect(
      repStack.trials.create(
        repA.claims,
        repStack.perms,
        createInput({ ownerRepresentativeId: profileB.id }),
        randomUUID(),
      ),
    ).rejects.toBeInstanceOf(SalesTrialForbiddenError);
  });

  it('V06: unknown ownerRepresentativeId is rejected for manager scope', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesTrialsStack(prisma);
    await expect(
      stack.trials.create(
        manager.claims,
        stack.perms,
        createInput({ ownerRepresentativeId: randomUUID() }),
        randomUUID(),
      ),
    ).rejects.toBeInstanceOf(SalesTrialValidationError);
  });

  // ─── update ───────────────────────────────────────────────────────────────

  it('U01: config fields are frozen once the Trial is ACTIVE', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesTrialsStack(prisma);
    const trial = await stack.trials.create(
      manager.claims,
      stack.perms,
      createInput(),
      randomUUID(),
    );
    await expect(
      stack.trials.update(manager.claims, stack.perms, trial.id, {
        selectedModuleKeys: keys.moduleKeys.slice(0, 1),
        expectedRowVersion: trial.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'trial_config_frozen' });
  });

  it('U02: stale expectedRowVersion is an OCC conflict', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesTrialsStack(prisma);
    const trial = await stack.trials.create(
      manager.claims,
      stack.perms,
      createInput(),
      randomUUID(),
    );
    await expect(
      stack.trials.update(manager.claims, stack.perms, trial.id, {
        organizationName: 'Renamed',
        expectedRowVersion: trial.rowVersion - 1,
      }),
    ).rejects.toMatchObject({ code: 'row_version_conflict' });
  });

  it('U03: allowed field update bumps rowVersion and records an audit', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesTrialsStack(prisma);
    const trial = await stack.trials.create(
      manager.claims,
      stack.perms,
      createInput(),
      randomUUID(),
    );
    const updated = await stack.trials.update(manager.claims, stack.perms, trial.id, {
      organizationName: 'Renamed Clinic',
      expectedRowVersion: trial.rowVersion,
      reason: 'operator correction',
    });
    expect(updated.organizationName).toBe('Renamed Clinic');
    expect(updated.rowVersion).toBe(trial.rowVersion + 1);
    expect(await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.UPDATED, trial.id)).toBe(1);
  });

  it('U04: maxExtensions cannot drop below the recorded extensionCount', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesTrialsStack(prisma);
    const trial = await stack.trials.create(
      manager.claims,
      stack.perms,
      createInput(),
      randomUUID(),
    );
    const first = await stack.trials.extend(
      manager.claims,
      stack.perms,
      trial.id,
      { extensionDays: 3, reason: 'customer pilot', expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const second = await stack.trials.extend(
      manager.claims,
      stack.perms,
      trial.id,
      { extensionDays: 3, reason: 'customer pilot round two', expectedRowVersion: first.rowVersion },
      randomUUID(),
    );
    expect(second.extensionCount).toBe(2);
    await expect(
      stack.trials.update(manager.claims, stack.perms, trial.id, {
        maxExtensions: 1,
        expectedRowVersion: second.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'max_extensions_below_used' });
  });
});
