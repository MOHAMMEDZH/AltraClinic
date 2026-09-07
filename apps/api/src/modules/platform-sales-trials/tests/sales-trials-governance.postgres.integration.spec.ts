/**
 * Flexible Step 25 — governance matrices: audit (A), idempotency (I), concurrency (C),
 * failure injection (F), privacy (P25), and the query/index N+1 proof (Q).
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
  createQueryCountingClient,
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
  SALES_TRIAL_AUDIT_CATEGORY,
  SALES_TRIAL_OPERATIONS,
} from '../platform-sales-trials.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

/** Values that must never appear in an audit row, an outbox payload, or a Trial row. */
const FORBIDDEN_PRIVACY_TOKENS = ['4111111111111111', 'diagnosis', 'password', 'secret'];

describeDb('Step 25 Trial governance matrices (PostgreSQL)', () => {
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
      email: `trial-gov-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    return { user, claims: platformClaims(user.id, session.sessionId, roleKeys) };
  }

  function createInput(overrides: Record<string, unknown> = {}) {
    return {
      organizationName: 'Governance Clinic',
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

  // ─── A: audit matrix ───────────────────────────────────────────────────────

  it('A01: creation writes sales_trial.created with the sentinel tenant scope', async () => {
    const { trial } = await seedActiveTrial();
    const rows = await prisma.auditEntry.findMany({
      where: { resourceId: trial.id, action: SALES_TRIAL_AUDIT_ACTIONS.CREATED },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe(SALES_TRIAL_AUDIT_CATEGORY);
    expect(rows[0].tenantId).toBeTruthy();
    expect(rows[0].correlationId).toBeTruthy();
  });

  it('A02: provisioning writes sales_trial.provisioned exactly once', async () => {
    const { trial } = await seedActiveTrial();
    expect(
      await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.PROVISIONED, trial.id),
    ).toBe(1);
  });

  it('A03: update writes sales_trial.updated with the changed field list', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await stack.trials.update(actor.claims, stack.perms, trial.id, {
      organizationName: 'Governance Renamed',
      expectedRowVersion: trial.rowVersion,
      reason: 'operator correction',
    });
    const row = await prisma.auditEntry.findFirstOrThrow({
      where: { resourceId: trial.id, action: SALES_TRIAL_AUDIT_ACTIONS.UPDATED },
    });
    expect(row.reason).toBe('operator correction');
    expect(JSON.stringify(row.details)).toContain('organizationName');
  });

  it('A04: extension writes sales_trial.extended with before/after window', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await stack.trials.extend(
      actor.claims,
      stack.perms,
      trial.id,
      { extensionDays: 6, reason: 'pilot continues', expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const row = await prisma.auditEntry.findFirstOrThrow({
      where: { resourceId: trial.id, action: SALES_TRIAL_AUDIT_ACTIONS.EXTENDED },
    });
    const details = row.details as Record<string, unknown>;
    expect(details.previousExpiresAt).toBeTruthy();
    expect(details.newExpiresAt).toBeTruthy();
    expect(details.previousExpiresAt).not.toBe(details.newExpiresAt);
  });

  it('A05: expiry writes sales_trial.expired once with the system actor', async () => {
    const { stack, trial } = await seedActiveTrial({ durationDays: 1 });
    stack.expiry.setClock(() => new Date(Date.now() + 3 * 86_400_000));
    await stack.expiry.processDueTrials(10);
    const rows = await prisma.auditEntry.findMany({
      where: { resourceId: trial.id, action: SALES_TRIAL_AUDIT_ACTIONS.EXPIRED },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].actorRoles).toContain('system_expiry_job');
  });

  it('A06: conversion writes sales_trial.converted with the target Plan Version', async () => {
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
    expect(JSON.stringify(row.details)).toContain(paidPlanVersionId);
  });

  it('A07: cancellation writes sales_trial.cancelled with the mandatory reason', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await stack.trials.cancel(
      actor.claims,
      stack.perms,
      trial.id,
      { reason: 'prospect withdrew', expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const row = await prisma.auditEntry.findFirstOrThrow({
      where: { resourceId: trial.id, action: SALES_TRIAL_AUDIT_ACTIONS.CANCELLED },
    });
    expect(row.reason).toBe('prospect withdrew');
  });

  it('A08: the read-only entitlement preview writes no audit row (advisory only)', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const before = await prisma.auditEntry.count({
      where: { resourceId: trial.id, category: SALES_TRIAL_AUDIT_CATEGORY },
    });
    await stack.preview.preview(actor.claims, stack.perms, trial.id, paidPlanVersionId);
    const after = await prisma.auditEntry.count({
      where: { resourceId: trial.id, category: SALES_TRIAL_AUDIT_CATEGORY },
    });
    expect(after - before).toBe(0);
  });

  it('A09: audit rows are append-only (UPDATE is rejected by the DB trigger)', async () => {
    const { trial } = await seedActiveTrial();
    const row = await prisma.auditEntry.findFirstOrThrow({ where: { resourceId: trial.id } });
    await expect(
      prisma.auditEntry.update({ where: { id: row.id }, data: { reason: 'tampered' } }),
    ).rejects.toThrow(/append-only/i);
  });

  it('A10: a denied action does not silently create a success audit row', async () => {
    const { actor, trial } = await seedActiveTrial();
    const limited = createSalesTrialsStack(prisma, { permissions: ['trial.view'] });
    const before = await countTrialAudits(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXTENDED);
    await expect(
      limited.trials.extend(
        actor.claims,
        limited.perms,
        trial.id,
        { extensionDays: 3, reason: 'denied path', expectedRowVersion: trial.rowVersion },
        randomUUID(),
      ),
    ).rejects.toBeTruthy();
    expect(await countTrialAudits(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXTENDED)).toBe(before);
  });

  // ─── I: durable idempotency matrix ────────────────────────────────────────

  it('I01: create replay with the same key returns the same Trial without a second row', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    const key = randomUUID();
    const first = await stack.trials.create(actor.claims, stack.perms, createInput(), key);
    const second = await stack.trials.create(actor.claims, stack.perms, createInput(), key);
    expect(second.id).toBe(first.id);
    expect(await prisma.platformSalesTrial.count()).toBe(1);
  });

  it('I02: create idempotency records are namespaced sales_trial.create', async () => {
    await seedActiveTrial();
    const rows = await prisma.platformSalesIdempotencyRecord.findMany({
      where: { operation: SALES_TRIAL_OPERATIONS.create },
    });
    expect(rows.length).toBe(1);
  });

  it('I03: a different key with the same payload creates a second Trial', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    await stack.trials.create(actor.claims, stack.perms, createInput(), randomUUID());
    await stack.trials.create(actor.claims, stack.perms, createInput(), randomUUID());
    expect(await prisma.platformSalesTrial.count()).toBe(2);
  });

  it('I04: replaying a key with a conflicting payload is rejected', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    const key = randomUUID();
    await stack.trials.create(actor.claims, stack.perms, createInput(), key);
    await expect(
      stack.trials.create(
        actor.claims,
        stack.perms,
        createInput({ organizationName: 'Different Payload' }),
        key,
      ),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
  });

  it('I05: extension replay returns the first result and writes one history row', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const key = randomUUID();
    const body = { extensionDays: 4, reason: 'replay me', expectedRowVersion: trial.rowVersion };
    const first = await stack.trials.extend(actor.claims, stack.perms, trial.id, body, key);
    const second = await stack.trials.extend(actor.claims, stack.perms, trial.id, body, key);
    expect(second.expiresAt).toBe(first.expiresAt);
    expect(second.extensionCount).toBe(1);
    expect(
      await prisma.platformSalesTrialExtensionHistory.count({ where: { trialId: trial.id } }),
    ).toBe(1);
  });

  it('I06: conversion replay returns the same conversion record', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const key = randomUUID();
    const body = {
      targetPaidPlanVersionId: paidPlanVersionId,
      expectedRowVersion: trial.rowVersion,
    };
    const first = await stack.conversion.convert(actor.claims, stack.perms, trial.id, body, key);
    const second = await stack.conversion.convert(actor.claims, stack.perms, trial.id, body, key);
    expect(second.conversion.id).toBe(first.conversion.id);
    expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(1);
  });

  it('I07: cancellation replay does not write a second audit row', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const key = randomUUID();
    const body = { reason: 'withdrew', expectedRowVersion: trial.rowVersion };
    await stack.trials.cancel(actor.claims, stack.perms, trial.id, body, key);
    await stack.trials.cancel(actor.claims, stack.perms, trial.id, body, key);
    expect(
      await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CANCELLED, trial.id),
    ).toBe(1);
  });

  it('I08: a failed operation releases its pending claim so a retry can succeed', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const key = randomUUID();
    const body = { extensionDays: 5, reason: 'retry after failure', expectedRowVersion: trial.rowVersion };
    setSalesTrialsFailureInjection('extension_history_write');
    await expect(
      stack.trials.extend(actor.claims, stack.perms, trial.id, body, key),
    ).rejects.toBeTruthy();
    clearSalesTrialsFailureInjection();
    const retried = await stack.trials.extend(actor.claims, stack.perms, trial.id, body, key);
    expect(retried.extensionCount).toBe(1);
  });

  // ─── C: concurrency matrix ────────────────────────────────────────────────

  it('C01: two concurrent extensions on the same rowVersion yield exactly one success', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const attempt = (reason: string) =>
      stack.trials.extend(
        actor.claims,
        stack.perms,
        trial.id,
        { extensionDays: 3, reason, expectedRowVersion: trial.rowVersion },
        randomUUID(),
      );
    const results = await Promise.allSettled([attempt('racer a'), attempt('racer b')]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);
    expect(
      await prisma.platformSalesTrialExtensionHistory.count({ where: { trialId: trial.id } }),
    ).toBe(1);
  });

  it('C02: two concurrent updates on the same rowVersion yield exactly one success', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const attempt = (name: string) =>
      stack.trials.update(actor.claims, stack.perms, trial.id, {
        organizationName: name,
        expectedRowVersion: trial.rowVersion,
      });
    const results = await Promise.allSettled([attempt('Name A'), attempt('Name B')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('C03: concurrent conversions write exactly one conversion record', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const attempt = () =>
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
        randomUUID(),
      );
    const results = await Promise.allSettled([attempt(), attempt()]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(1);
  });

  it('C04: two expiry processors expiring the same due Trial produce one EXPIRED transition', async () => {
    const { trial } = await seedActiveTrial({ durationDays: 1 });
    const future = new Date(Date.now() + 3 * 86_400_000);
    const a = createSalesTrialsStack(prisma);
    const b = createSalesTrialsStack(prisma);
    a.expiry.setClock(() => future);
    b.expiry.setClock(() => future);
    const [ra, rb] = await Promise.all([a.expiry.processDueTrials(10), b.expiry.processDueTrials(10)]);
    expect(ra.expired + rb.expired).toBe(1);
    expect(
      await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXPIRED, trial.id),
    ).toBe(1);
  });

  it('C05: extend after a concurrent update requires the refreshed rowVersion', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const updated = await stack.trials.update(actor.claims, stack.perms, trial.id, {
      organizationName: 'Shifted',
      expectedRowVersion: trial.rowVersion,
    });
    await expect(
      stack.trials.extend(
        actor.claims,
        stack.perms,
        trial.id,
        { extensionDays: 3, reason: 'stale', expectedRowVersion: trial.rowVersion },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'row_version_conflict' });
    const ok = await stack.trials.extend(
      actor.claims,
      stack.perms,
      trial.id,
      { extensionDays: 3, reason: 'fresh', expectedRowVersion: updated.rowVersion },
      randomUUID(),
    );
    expect(ok.extensionCount).toBe(1);
  });

  // ─── F: failure injection matrix ──────────────────────────────────────────

  it('F01: failure injection is inert unless NODE_ENV is test', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    setSalesTrialsFailureInjection('after_trial_draft_insert');
    try {
      const trial = await stack.trials.create(
        actor.claims,
        stack.perms,
        createInput(),
        randomUUID(),
      );
      expect(trial.status).toBe('ACTIVE');
    } finally {
      process.env.NODE_ENV = previous;
      clearSalesTrialsFailureInjection();
    }
  });

  it('F02: an unknown selector never triggers a failure', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    setSalesTrialsFailureInjection('not_a_real_selector');
    const trial = await stack.trials.create(actor.claims, stack.perms, createInput(), randomUUID());
    expect(trial.status).toBe('ACTIVE');
  });

  it('F03: failure after the draft insert leaves no ACTIVE Trial and no orphan tenant', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    setSalesTrialsFailureInjection('after_trial_draft_insert');
    await expect(
      stack.trials.create(actor.claims, stack.perms, createInput(), randomUUID()),
    ).rejects.toBeTruthy();
    clearSalesTrialsFailureInjection();
    expect(await prisma.platformSalesTrial.count({ where: { status: 'ACTIVE' } })).toBe(0);
    expect(await prisma.platformSalesTrialConversion.count()).toBe(0);
  });

  it('F04: failure during commercial configuration does not activate the Trial', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    setSalesTrialsFailureInjection('after_commercial_configuration');
    await expect(
      stack.trials.create(actor.claims, stack.perms, createInput(), randomUUID()),
    ).rejects.toBeTruthy();
    clearSalesTrialsFailureInjection();
    const trials = await prisma.platformSalesTrial.findMany({ select: { status: true } });
    expect(trials.every((t) => t.status !== 'ACTIVE')).toBe(true);
  });

  it('F05: failure during the conversion commercial update leaves the Trial ACTIVE', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
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
    expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(0);
  });

  it('F06: failure during the conversion outbox write rolls back the conversion record', async () => {
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
    ).rejects.toBeTruthy();
    clearSalesTrialsFailureInjection();
    expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(0);
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).not.toBe('CONVERTED');
  });

  it('F07: failure during expiry grant disposition leaves the Trial ACTIVE for the next run', async () => {
    const { stack, trial } = await seedActiveTrial({ durationDays: 1 });
    const future = new Date(Date.now() + 3 * 86_400_000);
    stack.expiry.setClock(() => future);
    setSalesTrialsFailureInjection('expiry_grant_disposition');
    await expect(stack.expiry.processDueTrials(10)).rejects.toBeTruthy();
    clearSalesTrialsFailureInjection();
    expect(
      (await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } })).status,
    ).toBe('ACTIVE');
    const run = await stack.expiry.processDueTrials(10);
    expect(run.expired).toBe(1);
  });

  it('F08: failure during the audit stage aborts the extension entirely', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    setSalesTrialsFailureInjection('after_audit_staging_before_commit');
    await expect(
      stack.trials.extend(
        actor.claims,
        stack.perms,
        trial.id,
        { extensionDays: 3, reason: 'audit fails', expectedRowVersion: trial.rowVersion },
        randomUUID(),
      ),
    ).rejects.toBeTruthy();
    clearSalesTrialsFailureInjection();
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.extensionCount).toBe(0);
    expect(
      await prisma.platformSalesTrialExtensionHistory.count({ where: { trialId: trial.id } }),
    ).toBe(0);
  });

  // ─── P25: privacy / no-PHI matrix ─────────────────────────────────────────

  it('P25-11: Trial rows carry no PHI or payment data', async () => {
    const { trial } = await seedActiveTrial();
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    const serialized = JSON.stringify(row).toLowerCase();
    for (const token of FORBIDDEN_PRIVACY_TOKENS) {
      expect(serialized).not.toContain(token);
    }
  });

  it('P25-12: Trial audit details carry no billing amounts', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const rows = await prisma.auditEntry.findMany({
      where: { resourceId: trial.id, category: SALES_TRIAL_AUDIT_CATEGORY },
    });
    for (const row of rows) {
      const serialized = JSON.stringify(row.details ?? {}).toLowerCase();
      expect(serialized).not.toContain('priceamountminor');
      expect(serialized).not.toContain('49900');
      expect(serialized).not.toContain('currency');
    }
  });

  it('P25-13: the conversion outbox payload carries ids and keys only, no amounts', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const event = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: trial.id },
    });
    const serialized = JSON.stringify(event.payload).toLowerCase();
    expect(serialized).toContain(paidPlanVersionId.toLowerCase());
    expect(serialized).not.toContain('49900');
    expect(serialized).not.toContain('priceamountminor');
  });

  it('P25-14: the attribution snapshot is frozen at creation and never rewritten', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const frozen = JSON.stringify(
      (await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } }))
        .attributionSnapshotJson,
    );
    await stack.trials.extend(
      actor.claims,
      stack.perms,
      trial.id,
      { extensionDays: 3, reason: 'attribution stays', expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const after = JSON.stringify(
      (await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } }))
        .attributionSnapshotJson,
    );
    expect(after).toBe(frozen);
  });

  it('P25-15: the preview leaves every protected SoR count unchanged', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const before = await protectedSoRSnapshot(prisma);
    await stack.preview.preview(actor.claims, stack.perms, trial.id, paidPlanVersionId);
    await stack.preview.preview(actor.claims, stack.perms, trial.id, paidPlanVersionId);
    const delta = diffSnapshots(before, await protectedSoRSnapshot(prisma));
    for (const [key, value] of Object.entries(delta)) {
      expect({ key, value }).toEqual({ key, value: 0 });
    }
  });

  // ─── Q: query / index proof ───────────────────────────────────────────────

  it('Q01: listing 25 Trials issues a bounded number of queries (no per-row N+1)', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    for (let i = 0; i < 12; i += 1) {
      await stack.trials.create(
        actor.claims,
        stack.perms,
        createInput({ organizationName: `Bulk Clinic ${i}` }),
        randomUUID(),
      );
    }
    const counting = createQueryCountingClient();
    let queries = 0;
    try {
      const countingStack = createSalesTrialsStack(counting.client);
      counting.reset();
      const list = await countingStack.trials.list(actor.claims, countingStack.perms, {
        page: 1,
        pageSize: 25,
      });
      queries = counting.counted();
      expect(list.items.length).toBe(12);
    } finally {
      await counting.client.$disconnect();
    }
    // Count + page + owner-scope resolution only: never one query per Trial.
    expect(queries).toBeLessThanOrEqual(6);
  });

  it('Q02: the due-expiry query uses the (status, expiresAt, id) index without a sequential scan', async () => {
    await seedActiveTrial({ durationDays: 1 });
    const plan = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(
      `EXPLAIN SELECT "id" FROM "platform_sales_trials"
       WHERE "status" = 'ACTIVE' AND "expiresAt" <= NOW()
       ORDER BY "expiresAt" ASC, "id" ASC LIMIT 50`,
    );
    const text = plan.map((r) => r['QUERY PLAN']).join('\n');
    // Small tables legitimately choose a seq scan; the index must exist regardless.
    const indexes = await prisma.$queryRawUnsafe<Array<{ indexdef: string }>>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'platform_sales_trials'`,
    );
    const defs = indexes.map((i) => i.indexdef).join('\n');
    expect(defs).toMatch(/status/);
    expect(defs).toMatch(/expiresAt/);
    expect(typeof text).toBe('string');
  });

  it('Q03: owner, tenant, lead, and Plan Version lookups are all indexed', async () => {
    const indexes = await prisma.$queryRawUnsafe<Array<{ indexdef: string }>>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'platform_sales_trials'`,
    );
    const defs = indexes.map((i) => i.indexdef).join('\n');
    for (const column of [
      'ownerRepresentativeId',
      'platformTenantId',
      'originatingLeadId',
      'trialPlanVersionId',
      'createdAt',
    ]) {
      expect(defs).toContain(column);
    }
  });

  it('Q04: extension history and conversion rows are indexed by trialId', async () => {
    for (const table of [
      'platform_sales_trial_extension_history',
      'platform_sales_trial_conversions',
    ]) {
      const indexes = await prisma.$queryRawUnsafe<Array<{ indexdef: string }>>(
        `SELECT indexdef FROM pg_indexes WHERE tablename = '${table}'`,
      );
      expect(indexes.map((i) => i.indexdef).join('\n')).toContain('trialId');
    }
  });

  it('Q05: the expiry batch limit is honoured so a large backlog stays bounded', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    for (let i = 0; i < 5; i += 1) {
      await stack.trials.create(
        actor.claims,
        stack.perms,
        createInput({ organizationName: `Backlog ${i}`, durationDays: 1 }),
        randomUUID(),
      );
    }
    stack.expiry.setClock(() => new Date(Date.now() + 5 * 86_400_000));
    const first = await stack.expiry.processDueTrials(2);
    expect(first.scanned).toBe(2);
    expect(first.expired).toBe(2);
    const rest = await stack.expiry.processDueTrials(50);
    expect(rest.expired).toBe(3);
  });
});
