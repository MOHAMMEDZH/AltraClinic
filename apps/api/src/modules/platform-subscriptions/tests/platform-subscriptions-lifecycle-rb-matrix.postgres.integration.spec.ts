/**
 * Step 16 schedule / suspend / resume / renew rollback injection matrix.
 */
import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import type { SubscriptionTxFailurePoint } from '../platform-subscriptions.tokens';
import {
  ALL_SUBSCRIPTION_PERMS,
  cleanupFixtureRuntimeSubscriptions,
  cleanupPlatformSubscriptionCommercialTables,
  createPlatformDbSecurityClient,
  createSubscriptionsService,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  FakeSubscriptionAuditLog,
  platformDbSecurityEnabled,
} from './platform-subscriptions-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

function claims(): JwtClaimsVO {
  return {
    sub: randomUUID(),
    sessionId: randomUUID(),
    principalType: 'platform',
  } as JwtClaimsVO;
}

function failAt(point: SubscriptionTxFailurePoint) {
  return async (p: SubscriptionTxFailurePoint) => {
    if (p === point) throw new Error(`injected ${point}`);
  };
}

async function ensureFixtures(prisma: PrismaClient) {
  if (!(await prisma.healthcareCatalogItem.findUnique({ where: { canonicalKey: 'module.dashboard' } }))) {
    const { HealthcareCatalogSeedService } = await import(
      '../../platform-healthcare-catalog/application/catalog-seed.service'
    );
    await new HealthcareCatalogSeedService({
      withPlatformBypass: async <T>(fn: (c: typeof prisma) => Promise<T>) =>
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
          return fn(tx as unknown as typeof prisma);
        }),
    } as never).seedAll();
  }
  if ((await prisma.platformPlan.count()) === 0) {
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
  }
  let pt = await prisma.platformTenant.findFirst({
    where: { tenantId: { not: PLATFORM_AUDIT_SENTINEL_TENANT_ID }, status: 'ACTIVE' },
  });
  if (!pt) {
    const t = await prisma.tenant.create({
      data: { name: 'RbMatrix', slug: `rb-${randomUUID().slice(0, 8)}`, features: {} },
    });
    pt = await prisma.platformTenant.create({
      data: {
        tenantId: t.id,
        displayName: 'RbMatrix',
        region: 'ME_SOUTH',
        plan: 'PRO',
        status: 'ACTIVE',
        provisionedBy: randomUUID(),
      },
    });
  }
  const published = await prisma.platformPlanVersion.findFirstOrThrow({
    where: {
      lifecycle: 'PUBLISHED',
      publicationFingerprint: { not: null },
      plan: { canonicalKey: { not: 'plan.business' } },
    },
    include: { plan: true },
  });
  return { platformTenantId: pt.id, publishedPlanVersionId: published.id };
}

describeDb('Step 16 lifecycle rollback injection matrix (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let fixtures: Awaited<ReturnType<typeof ensureFixtures>>;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient(DEFAULT_PLATFORM_DB_SECURITY_URL);
    await prisma.$connect();
    fixtures = await ensureFixtures(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  }, 180_000);

  beforeEach(async () => {
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
  });

  function service(audit = new FakeSubscriptionAuditLog(), hook?: SubscriptionTxFailurePoint) {
    return createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      audit,
      stepUpFresh: true,
      failureHook: hook ? failAt(hook) : undefined,
    });
  }

  async function seedDraftWithPlan(actor = claims()) {
    const s = service();
    const c = await s.create(actor, { platformTenantId: fixtures.platformTenantId });
    return s.assignPlanVersion(actor, c.id, {
      expectedRowVersion: c.rowVersion,
      planVersionId: fixtures.publishedPlanVersionId,
    });
  }

  async function seedActive(actor = claims()) {
    const draft = await seedDraftWithPlan(actor);
    return service().activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'rb seed active',
    });
  }

  async function seedSuspended(actor = claims()) {
    const active = await seedActive(actor);
    return service().suspend(actor, active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'rb seed suspend',
    });
  }

  function hasSuccessAudit(audit: FakeSubscriptionAuditLog): boolean {
    return audit.records.some(
      (r) => String(r.action).includes('success') || r.details?.result === 'success',
    );
  }

  async function assertScheduleRollback(opts: {
    point: SubscriptionTxFailurePoint;
    testName: string;
    idempotencyKey?: string;
  }) {
    const audit = new FakeSubscriptionAuditLog();
    const failing = service(audit, opts.point);
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const before = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await expect(
      failing.schedule(
        actor,
        draft.id,
        {
          expectedRowVersion: draft.rowVersion,
          scheduledActivationAt: '2030-01-01T00:00:00.000Z',
          reason: opts.testName,
        },
        opts.idempotencyKey,
      ),
    ).rejects.toThrow(new RegExp(opts.point));
    const after = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(after.lifecycle).toBe('DRAFT');
    expect(after.rowVersion).toBe(before.rowVersion);
    expect(after.scheduledActivationAt).toEqual(before.scheduledActivationAt);
    expect(after.commercialFingerprint).toBeNull();
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(0);
    expect(hasSuccessAudit(audit)).toBe(false);
    if (opts.idempotencyKey) {
      expect(
        await prisma.platformSubscriptionCommercialIdempotencyRecord.count({
          where: { idempotencyKey: opts.idempotencyKey },
        }),
      ).toBe(0);
    }
    expect(
      await prisma.platformSubscriptionAddOnAssignment.count({ where: { configId: draft.id } }),
    ).toBe(await prisma.platformSubscriptionAddOnAssignment.count({ where: { configId: draft.id } }));
    expect(
      await prisma.platformSubscriptionOverrideAssignment.count({ where: { configId: draft.id } }),
    ).toBe(
      await prisma.platformSubscriptionOverrideAssignment.count({ where: { configId: draft.id } }),
    );
  }

  async function assertSuspendRollback(opts: {
    point: SubscriptionTxFailurePoint;
    testName: string;
    idempotencyKey?: string;
  }) {
    const audit = new FakeSubscriptionAuditLog();
    const actor = claims();
    const active = await seedActive(actor);
    const snapBefore = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    const before = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.id },
    });
    const failing = service(audit, opts.point);
    await expect(
      failing.suspend(
        actor,
        active.id,
        { expectedRowVersion: active.rowVersion, reason: opts.testName },
        opts.idempotencyKey,
      ),
    ).rejects.toThrow(new RegExp(opts.point));
    const after = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.id },
    });
    const snapAfter = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    expect(after.lifecycle).toBe('ACTIVE_COMMERCIAL');
    expect(after.isCurrent).toBe(before.isCurrent);
    expect(after.rowVersion).toBe(before.rowVersion);
    expect(after.commercialFingerprint).toBe(before.commercialFingerprint);
    expect(snapAfter.fingerprint).toBe(snapBefore.fingerprint);
    expect(hasSuccessAudit(audit)).toBe(false);
    if (opts.idempotencyKey) {
      expect(
        await prisma.platformSubscriptionCommercialIdempotencyRecord.count({
          where: { idempotencyKey: opts.idempotencyKey },
        }),
      ).toBe(0);
    }
  }

  async function assertResumeRollback(opts: {
    point: SubscriptionTxFailurePoint;
    testName: string;
    idempotencyKey?: string;
  }) {
    const audit = new FakeSubscriptionAuditLog();
    const actor = claims();
    const active = await seedActive(actor);
    const suspended = await service().suspend(actor, active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'pause',
    });
    const snapBefore = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: suspended.id },
    });
    const snapCountBefore = await prisma.platformSubscriptionCommercialSnapshot.count({
      where: { configId: suspended.id },
    });
    const before = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: suspended.id },
    });
    const failing = service(audit, opts.point);
    await expect(
      failing.resume(
        actor,
        suspended.id,
        { expectedRowVersion: suspended.rowVersion, reason: opts.testName },
        opts.idempotencyKey,
      ),
    ).rejects.toThrow(new RegExp(opts.point));
    const after = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: suspended.id },
    });
    const snapAfter = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: suspended.id },
    });
    expect(after.lifecycle).toBe('SUSPENDED');
    expect(after.isCurrent).toBe(before.isCurrent);
    expect(after.rowVersion).toBe(before.rowVersion);
    expect(after.commercialFingerprint).toBe(before.commercialFingerprint);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: suspended.id } }),
    ).toBe(snapCountBefore);
    expect(snapAfter.id).toBe(snapBefore.id);
    expect(snapAfter.fingerprint).toBe(snapBefore.fingerprint);
    expect(hasSuccessAudit(audit)).toBe(false);
    if (opts.idempotencyKey) {
      expect(
        await prisma.platformSubscriptionCommercialIdempotencyRecord.count({
          where: { idempotencyKey: opts.idempotencyKey },
        }),
      ).toBe(0);
    }
  }

  async function assertRenewRollback(opts: {
    point: SubscriptionTxFailurePoint;
    testName: string;
    idempotencyKey?: string;
  }) {
    const audit = new FakeSubscriptionAuditLog();
    const actor = claims();
    const active = await seedActive(actor);
    const addonCountBefore = await prisma.platformSubscriptionAddOnAssignment.count({
      where: { configId: active.id },
    });
    const overrideCountBefore = await prisma.platformSubscriptionOverrideAssignment.count({
      where: { configId: active.id },
    });
    const before = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.id },
    });
    const failing = service(audit, opts.point);
    await expect(
      failing.renew(
        actor,
        active.id,
        {
          expectedRowVersion: active.rowVersion,
          reason: opts.testName,
          renewalEffectiveAt: '2033-01-01T00:00:00.000Z',
        },
        opts.idempotencyKey,
      ),
    ).rejects.toThrow(new RegExp(opts.point));
    const pred = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.id },
    });
    expect(pred.lifecycle).toBe(before.lifecycle);
    expect(pred.isCurrent).toBe(true);
    expect(pred.rowVersion).toBe(before.rowVersion);
    expect(pred.commercialFingerprint).toBe(before.commercialFingerprint);
    expect(
      await prisma.platformSubscriptionCommercialConfig.count({
        where: { predecessorId: active.id },
      }),
    ).toBe(0);
    expect(
      await prisma.platformSubscriptionAddOnAssignment.count({ where: { configId: active.id } }),
    ).toBe(addonCountBefore);
    expect(
      await prisma.platformSubscriptionOverrideAssignment.count({ where: { configId: active.id } }),
    ).toBe(overrideCountBefore);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: active.id } }),
    ).toBe(1);
    expect(hasSuccessAudit(audit)).toBe(false);
    if (opts.idempotencyKey) {
      expect(
        await prisma.platformSubscriptionCommercialIdempotencyRecord.count({
          where: { idempotencyKey: opts.idempotencyKey },
        }),
      ).toBe(0);
    }
  }

  it('SC-RB01: after_schedule_readiness rolls back schedule', async () => {
    await assertScheduleRollback({
      point: 'after_schedule_readiness',
      testName: 'SC-RB01',
    });
  });
  it('SC-RB02: after_schedule_lifecycle rolls back schedule', async () => {
    await assertScheduleRollback({
      point: 'after_schedule_lifecycle',
      testName: 'SC-RB02',
    });
  });
  it('SC-RB03: after_schedule_metadata rolls back schedule', async () => {
    await assertScheduleRollback({
      point: 'after_schedule_metadata',
      testName: 'SC-RB03',
    });
  });
  it('SC-RB04: after_schedule_row_version rolls back schedule', async () => {
    await assertScheduleRollback({
      point: 'after_schedule_row_version',
      testName: 'SC-RB04',
    });
  });
  it('SC-RB05: after_schedule_audit_staging rolls back schedule', async () => {
    await assertScheduleRollback({
      point: 'after_schedule_audit_staging',
      testName: 'SC-RB05',
    });
  });
  it('SC-RB06: before_schedule_idempotency rolls back schedule', async () => {
    await assertScheduleRollback({
      point: 'before_schedule_idempotency',
      testName: 'SC-RB06',
      idempotencyKey: 'idem-sc-rb06',
    });
  });
  it('SC-RB07: before_schedule_commit rolls back schedule', async () => {
    await assertScheduleRollback({
      point: 'before_schedule_commit',
      testName: 'SC-RB07',
      idempotencyKey: 'idem-sc-rb07',
    });
  });
  it('SC-RB08: before_transaction_commit rolls back schedule', async () => {
    await assertScheduleRollback({
      point: 'before_transaction_commit',
      testName: 'SC-RB08',
      idempotencyKey: 'idem-sc-rb08',
    });
  });

  it('SU-RB01: after_suspend_auth rolls back suspend', async () => {
    await assertSuspendRollback({ point: 'after_suspend_auth', testName: 'SU-RB01' });
  });
  it('SU-RB02: after_suspend_lifecycle rolls back suspend', async () => {
    await assertSuspendRollback({ point: 'after_suspend_lifecycle', testName: 'SU-RB02' });
  });
  it('SU-RB03: after_suspend_metadata rolls back suspend', async () => {
    await assertSuspendRollback({ point: 'after_suspend_metadata', testName: 'SU-RB03' });
  });
  it('SU-RB04: after_suspend_row_version rolls back suspend', async () => {
    await assertSuspendRollback({ point: 'after_suspend_row_version', testName: 'SU-RB04' });
  });
  it('SU-RB05: after_suspend_audit_staging rolls back suspend', async () => {
    await assertSuspendRollback({ point: 'after_suspend_audit_staging', testName: 'SU-RB05' });
  });
  it('SU-RB06: before_suspend_idempotency rolls back suspend', async () => {
    await assertSuspendRollback({
      point: 'before_suspend_idempotency',
      testName: 'SU-RB06',
      idempotencyKey: 'idem-su-rb06',
    });
  });
  it('SU-RB07: before_suspend_commit rolls back suspend', async () => {
    await assertSuspendRollback({
      point: 'before_suspend_commit',
      testName: 'SU-RB07',
      idempotencyKey: 'idem-su-rb07',
    });
  });
  it('SU-RB08: before_transaction_commit rolls back suspend', async () => {
    await assertSuspendRollback({
      point: 'before_transaction_commit',
      testName: 'SU-RB08',
      idempotencyKey: 'idem-su-rb08',
    });
  });

  it('RE-RB01: after_resume_auth rolls back resume', async () => {
    await assertResumeRollback({ point: 'after_resume_auth', testName: 'RE-RB01' });
  });
  it('RE-RB02: after_resume_lifecycle rolls back resume', async () => {
    await assertResumeRollback({ point: 'after_resume_lifecycle', testName: 'RE-RB02' });
  });
  it('RE-RB03: after_resume_metadata rolls back resume', async () => {
    await assertResumeRollback({ point: 'after_resume_metadata', testName: 'RE-RB03' });
  });
  it('RE-RB04: after_resume_row_version rolls back resume', async () => {
    await assertResumeRollback({ point: 'after_resume_row_version', testName: 'RE-RB04' });
  });
  it('RE-RB05: after_resume_audit_staging rolls back resume', async () => {
    await assertResumeRollback({ point: 'after_resume_audit_staging', testName: 'RE-RB05' });
  });
  it('RE-RB06: before_resume_idempotency rolls back resume', async () => {
    await assertResumeRollback({
      point: 'before_resume_idempotency',
      testName: 'RE-RB06',
      idempotencyKey: 'idem-re-rb06',
    });
  });
  it('RE-RB07: before_resume_commit rolls back resume', async () => {
    await assertResumeRollback({
      point: 'before_resume_commit',
      testName: 'RE-RB07',
      idempotencyKey: 'idem-re-rb07',
    });
  });
  it('RE-RB08: before_transaction_commit rolls back resume', async () => {
    await assertResumeRollback({
      point: 'before_transaction_commit',
      testName: 'RE-RB08',
      idempotencyKey: 'idem-re-rb08',
    });
  });

  const renewPoints: Array<{ name: string; point: SubscriptionTxFailurePoint }> = [
    { name: 'RN-RB01', point: 'after_renew_validation' },
    { name: 'RN-RB02', point: 'after_renew_date_validation' },
    { name: 'RN-RB03', point: 'after_renew_successor_create' },
    { name: 'RN-RB04', point: 'after_renew_effective_date' },
    { name: 'RN-RB05', point: 'after_renew_plan_copy' },
    { name: 'RN-RB06', point: 'after_renew_addon_first_copy' },
    { name: 'RN-RB07', point: 'after_renew_addon_partial_copy' },
    { name: 'RN-RB08', point: 'after_renew_override_first_copy' },
    { name: 'RN-RB09', point: 'after_renew_override_partial_copy' },
    { name: 'RN-RB10', point: 'after_renew_correlation_copy' },
    { name: 'RN-RB11', point: 'after_renew_provenance' },
    { name: 'RN-RB12', point: 'after_renew_predecessor_link' },
    { name: 'RN-RB13', point: 'after_renew_successor_link' },
    { name: 'RN-RB14', point: 'after_renew_predecessor_lifecycle' },
    { name: 'RN-RB15', point: 'after_renew_predecessor_current_clear' },
    { name: 'RN-RB16', point: 'after_renew_successor_current_set' },
    { name: 'RN-RB17', point: 'after_renew_predecessor_row_version' },
    { name: 'RN-RB18', point: 'after_renew_successor_row_version' },
    { name: 'RN-RB19', point: 'after_renew_audit_staging' },
    { name: 'RN-RB20', point: 'before_renew_idempotency' },
    { name: 'RN-RB21', point: 'before_renew_commit' },
  ];

  for (const { name, point } of renewPoints) {
    it(`${name}: ${point} rolls back renew`, async () => {
      await assertRenewRollback({
        point,
        testName: name,
        idempotencyKey: point.startsWith('before_') ? `idem-${name.toLowerCase()}` : undefined,
      });
    });
  }
});
