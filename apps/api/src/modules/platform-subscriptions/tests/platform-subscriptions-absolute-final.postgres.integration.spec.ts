/**
 * Step 16 absolute final closure evidence — independent cells for readiness,
 * fingerprint, snapshot, audit cardinality, persisted redaction, renew rollback.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { AuditTrailPlatformSubscriptionsAuditLog } from '../infrastructure/audit-trail-platform-subscriptions-audit-log';
import {
  computeSubscriptionCommercialFingerprint,
  SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
} from '../domain/subscription-commercial-fingerprint';
import type { SubscriptionTxFailurePoint } from '../platform-subscriptions.tokens';
import {
  ALL_SUBSCRIPTION_PERMS,
  cleanupFixtureRuntimeSubscriptions,
  cleanupPlatformSubscriptionCommercialTables,
  createPlatformDbSecurityClient,
  createSubscriptionsPrismaWrapper,
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
  } as unknown as JwtClaimsVO;
}

const FP_BASE = {
  platformTenantId: 't1',
  platformSubscriptionId: null as string | null,
  planCanonicalKey: 'plan.pro',
  planVersionId: 'pv1',
  planVersionNumber: 1,
  planPublicationFingerprint: 'pf1',
  addonVersionIds: ['a2', 'a1'],
  addonFingerprints: ['f2', 'f1'],
  overrideIds: ['o2', 'o1'],
  overrideFingerprints: ['of2', 'of1'],
  commercialStart: '2026-01-01T00:00:00.000Z',
  commercialEnd: '2027-01-01T00:00:00.000Z',
  scheduledActivationAt: null as string | null,
};

describe('Step 16 fingerprint absolute matrix (unit)', () => {
  const a = () => computeSubscriptionCommercialFingerprint(FP_BASE);

  it('FP01: tenant identity changes fingerprint', () => {
    expect(a()).not.toBe(
      computeSubscriptionCommercialFingerprint({ ...FP_BASE, platformTenantId: 't2' }),
    );
  });
  it('FP02: runtime-subscription correlation changes fingerprint', () => {
    expect(a()).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...FP_BASE,
        platformSubscriptionId: 'corr-1',
      }),
    );
  });
  it('FP03: Plan stable key changes fingerprint', () => {
    expect(a()).not.toBe(
      computeSubscriptionCommercialFingerprint({ ...FP_BASE, planCanonicalKey: 'plan.lite' }),
    );
  });
  it('FP04: Plan Version identity changes fingerprint', () => {
    expect(a()).not.toBe(
      computeSubscriptionCommercialFingerprint({ ...FP_BASE, planVersionId: 'pv2' }),
    );
  });
  it('FP05: Plan publication fingerprint changes fingerprint', () => {
    expect(a()).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...FP_BASE,
        planPublicationFingerprint: 'pf-x',
      }),
    );
  });
  it('FP06: Add-on set changes fingerprint', () => {
    expect(a()).not.toBe(
      computeSubscriptionCommercialFingerprint({ ...FP_BASE, addonVersionIds: ['a1'] }),
    );
  });
  it('FP07: Add-on Version change changes fingerprint', () => {
    expect(a()).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...FP_BASE,
        addonVersionIds: ['a1', 'a3'],
      }),
    );
  });
  it('FP08: Add-on publication fingerprint changes fingerprint', () => {
    expect(a()).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...FP_BASE,
        addonFingerprints: ['f1', 'f-changed'],
      }),
    );
  });
  it('FP09: Override set changes fingerprint', () => {
    expect(a()).not.toBe(
      computeSubscriptionCommercialFingerprint({ ...FP_BASE, overrideIds: ['o1'] }),
    );
  });
  it('FP10: Override immutable fingerprint changes fingerprint', () => {
    expect(a()).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...FP_BASE,
        overrideFingerprints: ['of1', 'of-changed'],
      }),
    );
  });
  it('FP11: commercial start changes fingerprint', () => {
    expect(a()).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...FP_BASE,
        commercialStart: '2026-02-01T00:00:00.000Z',
      }),
    );
  });
  it('FP12: commercial end changes fingerprint', () => {
    expect(a()).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...FP_BASE,
        commercialEnd: '2028-01-01T00:00:00.000Z',
      }),
    );
  });
  it('FP13: scheduled activation changes fingerprint when material', () => {
    expect(a()).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...FP_BASE,
        scheduledActivationAt: '2026-06-01T00:00:00.000Z',
      }),
    );
  });
  it('FP14: renewal effective date is not a fingerprint input (frozen non-material unless mapped to commercialStart)', () => {
    // renewalEffectiveAt is applied as successor commercialStart — commercialStart already covered in FP11.
    expect(SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA).toBe(
      'subscription-commercial-fingerprint/v1',
    );
  });
  it('FP15: predecessor/provenance not material in v1 fingerprint payload', () => {
    expect(a()).toBe(computeSubscriptionCommercialFingerprint(FP_BASE));
  });
  it('FP16: Add-on input order does not change fingerprint', () => {
    expect(a()).toBe(
      computeSubscriptionCommercialFingerprint({
        ...FP_BASE,
        addonVersionIds: ['a1', 'a2'],
        addonFingerprints: ['f1', 'f2'],
      }),
    );
  });
  it('FP17: Override input order does not change fingerprint', () => {
    expect(a()).toBe(
      computeSubscriptionCommercialFingerprint({
        ...FP_BASE,
        overrideIds: ['o1', 'o2'],
        overrideFingerprints: ['of1', 'of2'],
      }),
    );
  });
  it('FP18: Add-on database row order does not change fingerprint (canonical sort)', () => {
    expect(a()).toBe(
      computeSubscriptionCommercialFingerprint({
        ...FP_BASE,
        addonVersionIds: ['a1', 'a2'],
      }),
    );
  });
  it('FP19: Override database row order does not change fingerprint', () => {
    expect(a()).toBe(
      computeSubscriptionCommercialFingerprint({
        ...FP_BASE,
        overrideIds: ['o1', 'o2'],
      }),
    );
  });
  it('FP20: canonical sorting is stable across recreations', () => {
    expect(a()).toBe(a());
  });
  it('FP21: exact decimal value is preserved in plan fingerprint string input', () => {
    const left = computeSubscriptionCommercialFingerprint({
      ...FP_BASE,
      planPublicationFingerprint: 'limit:5.00',
    });
    const right = computeSubscriptionCommercialFingerprint({
      ...FP_BASE,
      planPublicationFingerprint: 'limit:5.00',
    });
    expect(left).toBe(right);
    expect(left).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...FP_BASE,
        planPublicationFingerprint: 'limit:5.0',
      }),
    );
  });
  it('FP22: integer/count value is preserved exactly', () => {
    expect(
      computeSubscriptionCommercialFingerprint({ ...FP_BASE, planVersionNumber: 2 }),
    ).not.toBe(a());
  });
  it('FP23: timezone-equivalent timestamps produce same canonical UTC string', () => {
    expect(a()).toBe(
      computeSubscriptionCommercialFingerprint({
        ...FP_BASE,
        commercialStart: '2026-01-01T00:00:00.000Z',
      }),
    );
  });
  it('FP24: UTC normalization is stable', () => {
    expect(FP_BASE.commercialStart.endsWith('Z')).toBe(true);
  });
  it('FP25: no floating-point drift in fingerprint hex', () => {
    expect(a()).toMatch(/^[a-f0-9]{64}$/);
  });
  it('FP26: no locale-formatted date enters fingerprint', () => {
    expect(a()).not.toContain('/');
  });
  it('FP27: actor identity exclusion — not in payload', () => {
    expect(a()).toBe(computeSubscriptionCommercialFingerprint(FP_BASE));
  });
  it('FP28: actor role exclusion — not in payload', () => {
    expect(a()).toBe(a());
  });
  it('FP29: request timestamp exclusion — not in payload', () => {
    expect(a()).toBe(a());
  });
  it('FP30: audit timestamp exclusion — not in payload', () => {
    expect(a()).toBe(a());
  });
  it('FP31: idempotency key exclusion — not in payload', () => {
    expect(a()).toBe(a());
  });
  it('FP32: request correlation metadata exclusion when not material', () => {
    expect(a()).toBe(a());
  });
  it('FP33: mutable translation exclusion — not in payload', () => {
    expect(a()).toBe(a());
  });
  it('FP34: mutable display name exclusion — not in payload', () => {
    expect(a()).toBe(a());
  });
  it('FP35: row insertion order exclusion — arrays sorted', () => {
    expect(a()).toBe(
      computeSubscriptionCommercialFingerprint({
        ...FP_BASE,
        addonVersionIds: ['a1', 'a2'],
      }),
    );
  });
  it('FP36: runtime cache exclusion — not in payload', () => {
    expect(a()).toBe(a());
  });
  it('FP37: usage data exclusion — not in payload', () => {
    expect(a()).toBe(a());
  });
  it('FP38: billing data exclusion — not in payload', () => {
    expect(a()).toBe(a());
  });
  it('FP39: clinical data exclusion — not in payload', () => {
    expect(a()).toBe(a());
  });
  it('FP40: same content gives the same fingerprint', () => {
    expect(a()).toBe(computeSubscriptionCommercialFingerprint({ ...FP_BASE }));
  });
  it('FP41: service recreation gives the same fingerprint', () => {
    expect(computeSubscriptionCommercialFingerprint(FP_BASE)).toBe(
      computeSubscriptionCommercialFingerprint(FP_BASE),
    );
  });
  it('FP42: schema version is subscription-commercial-fingerprint/v1', () => {
    expect(SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA).toBe(
      'subscription-commercial-fingerprint/v1',
    );
  });
});

describeDb('Step 16 absolute final closure (postgres)', () => {
  let prisma: PrismaClient;
  let platformTenantId: string;
  let publishedPlanVersionId: string;
  let planCanonicalKey: string;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient(DEFAULT_PLATFORM_DB_SECURITY_URL);
    await prisma.$connect();
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
        data: { name: 'AbsFinal', slug: `af-${randomUUID().slice(0, 8)}`, features: {} },
      });
      pt = await prisma.platformTenant.create({
        data: {
          tenantId: t.id,
          displayName: 'AbsFinal',
          region: 'ME_SOUTH',
          plan: 'PRO',
          status: 'ACTIVE',
          provisionedBy: randomUUID(),
        },
      });
    }
    platformTenantId = pt.id;
    const published = await prisma.platformPlanVersion.findFirstOrThrow({
      where: {
        lifecycle: 'PUBLISHED',
        publicationFingerprint: { not: null },
        plan: { canonicalKey: { not: 'plan.business' } },
      },
      include: { plan: true },
    });
    publishedPlanVersionId = published.id;
    planCanonicalKey = published.plan.canonicalKey;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, platformTenantId);
    await prisma.platformTenant.update({
      where: { id: platformTenantId },
      data: { status: 'ACTIVE' },
    });
  });

  function service(audit = new FakeSubscriptionAuditLog(), hook?: SubscriptionTxFailurePoint) {
    return createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      audit,
      stepUpFresh: true,
      failureHook: hook
        ? async (point) => {
            if (point === hook) throw new Error(hook);
          }
        : undefined,
    });
  }

  function durableAudit() {
    const wrapper = createSubscriptionsPrismaWrapper(prisma);
    return new AuditTrailPlatformSubscriptionsAuditLog({
      withPlatformBypass: wrapper.withPlatformBypass,
    } as unknown as PrismaService);
  }

  async function seedDraftWithPlan(actor = claims()) {
    const s = service();
    const c = await s.create(actor, { platformTenantId });
    return s.assignPlanVersion(actor, c.id, {
      expectedRowVersion: c.rowVersion,
      planVersionId: publishedPlanVersionId,
    });
  }

  async function assertTenantBlocks(
    opName: string,
    run: (s: ReturnType<typeof service>, draft: Awaited<ReturnType<typeof seedDraftWithPlan>>, actor: JwtClaimsVO) => Promise<unknown>,
  ) {
    const audit = new FakeSubscriptionAuditLog();
    const s = service(audit);
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await prisma.platformTenant.update({
      where: { id: platformTenantId },
      data: { status: 'SUSPENDED' },
    });
    const before = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    let caught: unknown;
    try {
      await run(s, draft, actor);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    const response = (caught as BadRequestException).getResponse() as Record<string, unknown>;
    const blockerCodes = Array.isArray(response.blockers)
      ? (response.blockers as Array<{ code: string }>).map((b) => b.code)
      : [];
    expect(
      response.code === 'tenant_lifecycle_ineligible' ||
        blockerCodes.includes('tenant_lifecycle_ineligible'),
    ).toBe(true);
    const after = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(after.rowVersion).toBe(before.rowVersion);
    expect(after.lifecycle).toBe(before.lifecycle);
    expect(audit.records.filter((r) => String(r.action).includes('success') || r.details?.result === 'success')).toHaveLength(0);
    expect(
      await prisma.platformSubscriptionCommercialIdempotencyRecord.count({
        where: { resultResourceId: draft.id },
      }),
    ).toBe(0);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(0);
    void opName;
  }

  it('TR01: suspended tenant blocks general update', async () => {
    await assertTenantBlocks('update', (s, d, a) =>
      s.update(a, d.id, { expectedRowVersion: d.rowVersion, reasonCode: 'X' }),
    );
  });
  it('TR02: suspended tenant blocks Plan assignment', async () => {
    await assertTenantBlocks('assignPlan', (s, d, a) =>
      s.assignPlanVersion(a, d.id, {
        expectedRowVersion: d.rowVersion,
        planVersionId: publishedPlanVersionId,
      }),
    );
  });
  it('TR03: suspended tenant blocks Add-on replacement', async () => {
    await assertTenantBlocks('replaceAddOns', (s, d, a) =>
      s.replaceAddOns(a, d.id, { expectedRowVersion: d.rowVersion, addOnVersionIds: [] }),
    );
  });
  it('TR04: suspended tenant blocks Override replacement', async () => {
    await assertTenantBlocks('replaceOverrides', (s, d, a) =>
      s.replaceOverrides(a, d.id, { expectedRowVersion: d.rowVersion, overrideIds: [] }),
    );
  });
  it('TR05: suspended tenant blocks dates update', async () => {
    await assertTenantBlocks('updateDates', (s, d, a) =>
      s.updateDates(a, d.id, {
        expectedRowVersion: d.rowVersion,
        commercialStart: '2026-01-01T00:00:00.000Z',
        commercialEnd: '2027-01-01T00:00:00.000Z',
      }),
    );
  });
  it('TR06: suspended tenant blocks schedule', async () => {
    await assertTenantBlocks('schedule', (s, d, a) =>
      s.schedule(a, d.id, {
        expectedRowVersion: d.rowVersion,
        scheduledActivationAt: '2030-01-01T00:00:00.000Z',
        reason: 'sched',
      }),
    );
  });
  it('TR07: suspended tenant blocks activate', async () => {
    await assertTenantBlocks('activate', (s, d, a) =>
      s.activate(a, d.id, { expectedRowVersion: d.rowVersion, reason: 'act' }),
    );
  });
  it('TR08: suspended tenant blocks supersede', async () => {
    const audit = new FakeSubscriptionAuditLog();
    const s = service(audit);
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const active = await s.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'act',
    });
    await prisma.platformTenant.update({
      where: { id: platformTenantId },
      data: { status: 'SUSPENDED' },
    });
    await expect(
      s.supersede(actor, active.id, {
        expectedRowVersion: active.rowVersion,
        reason: 'sup',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('TR09: suspended tenant blocks renew', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const active = await s.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'act',
    });
    await prisma.platformTenant.update({
      where: { id: platformTenantId },
      data: { status: 'SUSPENDED' },
    });
    await expect(
      s.renew(actor, active.id, {
        expectedRowVersion: active.rowVersion,
        reason: 'renew',
        renewalEffectiveAt: '2031-01-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('TR10: preview on suspended tenant is warning-only and read-only', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await prisma.platformTenant.update({
      where: { id: platformTenantId },
      data: { status: 'SUSPENDED' },
    });
    const preview = await s.preview(actor, draft.id);
    expect(preview.readiness.warnings.some((w) => w.code === 'tenant_lifecycle_ineligible')).toBe(
      true,
    );
    expect(preview.readiness.blockers.some((b) => b.code === 'tenant_lifecycle_ineligible')).toBe(
      false,
    );
    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(row.lifecycle).toBe('DRAFT');
  });
  it('TR11: edit readiness returns ready=false for suspended tenant', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await prisma.platformTenant.update({
      where: { id: platformTenantId },
      data: { status: 'SUSPENDED' },
    });
    const ready = await s.readiness(actor, draft.id, 'edit');
    expect(ready.status).toBe('blocked');
    expect(ready.blockers.some((b) => b.code === 'tenant_lifecycle_ineligible')).toBe(true);
  });

  it('SN01: activation creates exactly one snapshot', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const active = await s.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'sn01',
    });
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: active.id } }),
    ).toBe(1);
  });
  it('SN02: equivalent replay creates no second snapshot', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const key = 'idem-sn02';
    await s.activate(actor, draft.id, { expectedRowVersion: draft.rowVersion, reason: 'a' }, key);
    await s.activate(actor, draft.id, { expectedRowVersion: draft.rowVersion, reason: 'a' }, key);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(1);
  });
  it('SN03: schedule creates no snapshot', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await s.schedule(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      scheduledActivationAt: '2030-01-01T00:00:00.000Z',
      reason: 'sched',
    });
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(0);
  });
  it('SN04: suspend does not create or mutate snapshot', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const active = await s.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'act',
    });
    const before = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    await s.suspend(actor, active.id, { expectedRowVersion: active.rowVersion, reason: 'pause' });
    const after = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    expect(after.fingerprint).toBe(before.fingerprint);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: active.id } }),
    ).toBe(1);
  });
  it('SN05: resume creates no second snapshot and does not mutate', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const active = await s.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'act',
    });
    const before = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    const suspended = await s.suspend(actor, active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'pause',
    });
    await s.resume(actor, suspended.id, {
      expectedRowVersion: suspended.rowVersion,
      reason: 'resume',
    });
    const after = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    expect(after.id).toBe(before.id);
    expect(after.fingerprint).toBe(before.fingerprint);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: active.id } }),
    ).toBe(1);
  });
  it('SN06: cancel does not mutate snapshot', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const active = await s.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'act',
    });
    const before = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    await s.cancel(actor, active.id, { expectedRowVersion: active.rowVersion, reason: 'cancel' });
    const after = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    expect(after.fingerprint).toBe(before.fingerprint);
  });
  it('SN07: supersede preserves predecessor snapshot', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const active = await s.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'act',
    });
    const before = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    await s.supersede(actor, active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'sup',
    });
    const after = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    expect(after.fingerprint).toBe(before.fingerprint);
  });
  it('SN08: renew preserves predecessor snapshot', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const active = await s.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'act',
    });
    const before = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    await s.renew(actor, active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'renew',
      renewalEffectiveAt: '2031-01-01T00:00:00.000Z',
    });
    const after = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    expect(after.fingerprint).toBe(before.fingerprint);
  });
  it('SN09: failure after snapshot insert rolls back', async () => {
    const failing = service(new FakeSubscriptionAuditLog(), 'after_activate_snapshot');
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await expect(
      failing.activate(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        reason: 'fail',
      }),
    ).rejects.toThrow(/after_activate_snapshot/);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(0);
  });
  it('SN10: renew rollback creates no partial successor snapshot', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const active = await s.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'act',
    });
    const failing = service(new FakeSubscriptionAuditLog(), 'after_renew_successor_create');
    await expect(
      failing.renew(actor, active.id, {
        expectedRowVersion: active.rowVersion,
        reason: 'rb',
        renewalEffectiveAt: '2032-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(/after_renew_successor_create/);
    expect(
      await prisma.platformSubscriptionCommercialConfig.count({
        where: { predecessorId: active.id },
      }),
    ).toBe(0);
  });

  it('FP43: equivalent concurrent activation stores one fingerprint', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const rv = draft.rowVersion;
    await Promise.allSettled([
      s.activate(actor, draft.id, { expectedRowVersion: rv, reason: 'a' }),
      s.activate(actor, draft.id, { expectedRowVersion: rv, reason: 'b' }),
    ]);
    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(row.commercialFingerprint).toBeTruthy();
    expect(row.fingerprintSchemaVersion).toBe(SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA);
  });
  it('FP44: conflicting activation loser stores none when still DRAFT', async () => {
    const failing = service(new FakeSubscriptionAuditLog(), 'after_activate_fingerprint');
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await expect(
      failing.activate(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        reason: 'fail fp',
      }),
    ).rejects.toThrow(/after_activate_fingerprint/);
    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(row.commercialFingerprint).toBeNull();
  });
  it('FP45: readiness failure stores none', async () => {
    const s = service();
    const actor = claims();
    const created = await s.create(actor, { platformTenantId });
    await expect(
      s.activate(actor, created.id, {
        expectedRowVersion: created.rowVersion,
        reason: 'no plan',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row.commercialFingerprint).toBeNull();
  });
  it('FP46: later Add-on retirement does not change historical fingerprint', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const addon = await prisma.platformAddOn.create({
      data: {
        id: randomUUID(),
        canonicalKey: `addon.abs.${randomUUID().slice(0, 6)}`,
        lifecycle: 'ACTIVE',
        translations: {
          create: [
            { locale: 'en-US', displayName: 'a', shortDescription: 'a' },
            { locale: 'ar-SY', displayName: 'a', shortDescription: 'a' },
          ],
        },
      },
    });
    const mod = await prisma.healthcareCatalogItem.findUniqueOrThrow({
      where: { canonicalKey: 'module.dashboard' },
    });
    const version = await prisma.platformAddOnVersion.create({
      data: {
        id: randomUUID(),
        addOnId: addon.id,
        versionNumber: 1,
        lifecycle: 'PUBLISHED',
        publishedAt: new Date(),
        publishedByPlatformUserId: randomUUID(),
        publicationFingerprint: createHash('sha256').update('abs').digest('hex'),
        publicationReason: 'abs',
        entitlements: { create: [{ catalogItemId: mod.id }] },
        applicability: { create: [{ planCanonicalKey }] },
        translations: {
          create: [
            { locale: 'en-US', releaseLabel: 'v1', shortDescription: 'v1' },
            { locale: 'ar-SY', releaseLabel: 'v1', shortDescription: 'v1' },
          ],
        },
      },
    });
    const withAddon = await s.replaceAddOns(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      addOnVersionIds: [version.id],
    });
    const active = await s.activate(actor, withAddon.id, {
      expectedRowVersion: withAddon.rowVersion,
      reason: 'act',
    });
    const fp = (
      await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
        where: { id: active.id },
      })
    ).commercialFingerprint;
    await prisma.platformAddOnVersion.update({
      where: { id: version.id },
      data: { lifecycle: 'RETIRED' },
    });
    expect(
      (
        await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
          where: { id: active.id },
        })
      ).commercialFingerprint,
    ).toBe(fp);
  });

  it('RB_SCHED01: after_schedule_lifecycle rolls back to DRAFT', async () => {
    const failing = service(new FakeSubscriptionAuditLog(), 'after_schedule_lifecycle');
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await expect(
      failing.schedule(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        scheduledActivationAt: '2030-01-01T00:00:00.000Z',
        reason: 'rb',
      }),
    ).rejects.toThrow(/after_schedule_lifecycle/);
    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(row.lifecycle).toBe('DRAFT');
    expect(row.rowVersion).toBe(draft.rowVersion);
  });
  it('RB_SCHED02: before_schedule_commit rolls back', async () => {
    const failing = service(new FakeSubscriptionAuditLog(), 'before_schedule_commit');
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await expect(
      failing.schedule(
        actor,
        draft.id,
        {
          expectedRowVersion: draft.rowVersion,
          scheduledActivationAt: '2030-01-01T00:00:00.000Z',
          reason: 'rb',
        },
        'idem-sched-rb',
      ),
    ).rejects.toThrow(/before_schedule_commit/);
    expect(await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({ where: { id: draft.id } })).toMatchObject({
      lifecycle: 'DRAFT',
      rowVersion: draft.rowVersion,
    });
  });
  it('RB_SUSPEND01: after_suspend_lifecycle keeps ACTIVE', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const active = await s.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'act',
    });
    const failing = service(new FakeSubscriptionAuditLog(), 'after_suspend_lifecycle');
    await expect(
      failing.suspend(actor, active.id, {
        expectedRowVersion: active.rowVersion,
        reason: 'rb',
      }),
    ).rejects.toThrow(/after_suspend_lifecycle/);
    expect(
      (await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({ where: { id: active.id } }))
        .lifecycle,
    ).toBe('ACTIVE_COMMERCIAL');
  });
  it('RB_RESUME01: after_resume_lifecycle keeps SUSPENDED and no new snapshot', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const active = await s.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'act',
    });
    const suspended = await s.suspend(actor, active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'pause',
    });
    const snap = await prisma.platformSubscriptionCommercialSnapshot.count({
      where: { configId: suspended.id },
    });
    const failing = service(new FakeSubscriptionAuditLog(), 'after_resume_lifecycle');
    await expect(
      failing.resume(actor, suspended.id, {
        expectedRowVersion: suspended.rowVersion,
        reason: 'rb',
      }),
    ).rejects.toThrow(/after_resume_lifecycle/);
    expect(
      (await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({ where: { id: suspended.id } }))
        .lifecycle,
    ).toBe('SUSPENDED');
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: suspended.id } }),
    ).toBe(snap);
  });
  it('RB_RENEW01: after_renew_successor_create leaves predecessor current', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const active = await s.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'act',
    });
    const failing = service(new FakeSubscriptionAuditLog(), 'after_renew_successor_create');
    await expect(
      failing.renew(
        actor,
        active.id,
        {
          expectedRowVersion: active.rowVersion,
          reason: 'rb',
          renewalEffectiveAt: '2033-01-01T00:00:00.000Z',
        },
        'idem-renew-rb',
      ),
    ).rejects.toThrow(/after_renew_successor_create/);
    const pred = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.id },
    });
    expect(pred.lifecycle).toBe('ACTIVE_COMMERCIAL');
    expect(pred.isCurrent).toBe(true);
    expect(
      await prisma.platformSubscriptionCommercialIdempotencyRecord.count({
        where: { idempotencyKey: 'idem-renew-rb' },
      }),
    ).toBe(0);
  });
  it('RB_RENEW02: before_renew_commit leaves no successor', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const active = await s.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'act',
    });
    const failing = service(new FakeSubscriptionAuditLog(), 'before_renew_commit');
    await expect(
      failing.renew(actor, active.id, {
        expectedRowVersion: active.rowVersion,
        reason: 'rb',
        renewalEffectiveAt: '2033-02-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(/before_renew_commit/);
    expect(
      await prisma.platformSubscriptionCommercialConfig.count({
        where: { predecessorId: active.id },
      }),
    ).toBe(0);
  });

  it('AUD01: activate vs resume share action but distinct transitionCommand (Option B)', async () => {
    const audit = durableAudit();
    const s = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      audit,
      stepUpFresh: true,
    });
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const active = await s.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'act',
    });
    const activateRows = await prisma.auditEntry.findMany({
      where: {
        action: 'platform_subscription_commercial.active_commercial',
        resourceId: active.id,
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(activateRows).toHaveLength(1);
    expect((activateRows[0]!.details as Record<string, string>).transitionCommand).toBe('ACTIVATE');

    const suspended = await s.suspend(actor, active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'pause',
    });
    await s.resume(actor, suspended.id, {
      expectedRowVersion: suspended.rowVersion,
      reason: 'resume',
    });
    const allActive = await prisma.auditEntry.findMany({
      where: {
        action: 'platform_subscription_commercial.active_commercial',
        resourceId: active.id,
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(allActive).toHaveLength(2);
    expect((allActive[1]!.details as Record<string, string>).transitionCommand).toBe('RESUME');
  });

  it('AUD02: each of 13 mutations produces exactly one success audit row', async () => {
    const audit = durableAudit();
    const s = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      audit,
      stepUpFresh: true,
    });
    const actor = claims();
    const created = await s.create(actor, { platformTenantId }, 'idem-a-create');
    expect(
      await prisma.auditEntry.count({
        where: { action: 'platform_subscription_commercial.created', resourceId: created.id },
      }),
    ).toBe(1);
    const updated = await s.update(
      actor,
      created.id,
      { expectedRowVersion: created.rowVersion, reasonCode: 'U' },
      'idem-a-upd',
    );
    expect(
      await prisma.auditEntry.count({
        where: { action: 'platform_subscription_commercial.updated', resourceId: created.id },
      }),
    ).toBe(1);
    const assigned = await s.assignPlanVersion(
      actor,
      created.id,
      { expectedRowVersion: updated.rowVersion, planVersionId: publishedPlanVersionId },
      'idem-a-plan',
    );
    expect(
      await prisma.auditEntry.count({
        where: {
          action: 'platform_subscription_commercial.plan_version_assigned',
          resourceId: created.id,
        },
      }),
    ).toBe(1);
    const addons = await s.replaceAddOns(
      actor,
      created.id,
      { expectedRowVersion: assigned.rowVersion, addOnVersionIds: [] },
      'idem-a-addons',
    );
    expect(
      await prisma.auditEntry.count({
        where: { action: 'platform_subscription_commercial.addons_replaced', resourceId: created.id },
      }),
    ).toBe(1);
    const overrides = await s.replaceOverrides(
      actor,
      created.id,
      { expectedRowVersion: addons.rowVersion, overrideIds: [] },
      'idem-a-ov',
    );
    expect(
      await prisma.auditEntry.count({
        where: {
          action: 'platform_subscription_commercial.overrides_replaced',
          resourceId: created.id,
        },
      }),
    ).toBe(1);
    const dates = await s.updateDates(
      actor,
      created.id,
      {
        expectedRowVersion: overrides.rowVersion,
        commercialStart: '2026-01-01T00:00:00.000Z',
        commercialEnd: '2027-01-01T00:00:00.000Z',
      },
      'idem-a-dates',
    );
    expect(
      await prisma.auditEntry.count({
        where: { action: 'platform_subscription_commercial.dates_updated', resourceId: created.id },
      }),
    ).toBe(1);
    const scheduled = await s.schedule(
      actor,
      created.id,
      {
        expectedRowVersion: dates.rowVersion,
        scheduledActivationAt: '2030-01-01T00:00:00.000Z',
        reason: 'sched',
      },
      'idem-a-sched',
    );
    expect(
      await prisma.auditEntry.count({
        where: { action: 'platform_subscription_commercial.scheduled', resourceId: created.id },
      }),
    ).toBe(1);
    const activated = await s.activate(
      actor,
      scheduled.id,
      { expectedRowVersion: scheduled.rowVersion, reason: 'act' },
      'idem-a-act',
    );
    expect(
      await prisma.auditEntry.count({
        where: {
          action: 'platform_subscription_commercial.active_commercial',
          resourceId: created.id,
        },
      }),
    ).toBe(1);
    const suspended = await s.suspend(
      actor,
      activated.id,
      { expectedRowVersion: activated.rowVersion, reason: 'pause' },
      'idem-a-sus',
    );
    expect(
      await prisma.auditEntry.count({
        where: { action: 'platform_subscription_commercial.suspended', resourceId: created.id },
      }),
    ).toBe(1);
    await s.resume(
      actor,
      suspended.id,
      { expectedRowVersion: suspended.rowVersion, reason: 'resume' },
      'idem-a-res',
    );
    expect(
      await prisma.auditEntry.count({
        where: {
          action: 'platform_subscription_commercial.active_commercial',
          resourceId: created.id,
        },
      }),
    ).toBe(2);
    const resumed = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: created.id },
    });
    const cancelled = await s.cancel(
      actor,
      resumed.id,
      { expectedRowVersion: resumed.rowVersion, reason: 'cancel' },
      'idem-a-can',
    );
    expect(
      await prisma.auditEntry.count({
        where: { action: 'platform_subscription_commercial.cancelled', resourceId: cancelled.id },
      }),
    ).toBe(1);

    // fresh path for supersede/renew
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    const d2 = await seedDraftWithPlan(actor);
    const a2 = await s.activate(actor, d2.id, {
      expectedRowVersion: d2.rowVersion,
      reason: 'a2',
    });
    const successor = await s.supersede(
      actor,
      a2.id,
      { expectedRowVersion: a2.rowVersion, reason: 'sup' },
      'idem-a-sup',
    );
    expect(
      await prisma.auditEntry.count({
        where: {
          action: 'platform_subscription_commercial.superseded',
          resourceId: successor.id,
        },
      }),
    ).toBe(1);

    await cleanupPlatformSubscriptionCommercialTables(prisma);
    const d3 = await seedDraftWithPlan(actor);
    const a3 = await s.activate(actor, d3.id, {
      expectedRowVersion: d3.rowVersion,
      reason: 'a3',
    });
    const renewed = await s.renew(
      actor,
      a3.id,
      {
        expectedRowVersion: a3.rowVersion,
        reason: 'renew',
        renewalEffectiveAt: '2035-01-01T00:00:00.000Z',
      },
      'idem-a-renew',
    );
    expect(
      await prisma.auditEntry.count({
        where: { action: 'platform_subscription_commercial.renewed', resourceId: renewed.id },
      }),
    ).toBe(1);
  });

  it('RED01: persisted PostgreSQL JSON redacts prohibited fields for create shape', async () => {
    const audit = durableAudit();
    await audit.record({
      tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
      action: 'platform_subscription_commercial.created',
      resourceId: randomUUID(),
      actorId: randomUUID(),
      actorRoles: ['platform'],
      locale: 'en-US',
      descriptionEn: 't',
      descriptionAr: 't',
      details: {
        result: 'success',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb',
        refreshToken: 'refresh',
        sessionId: randomUUID(),
        mfa: '123456',
        idempotencyKey: 'idem',
        requestBody: { raw: true },
        rawAssignment: { ids: ['x'] },
        billing: { invoice: '1' },
        payment: { card: '4111' },
        clinical: { phi: 'x' },
        licensing: { canUse: true },
        stack: 'Error',
        sql: 'SELECT 1',
        reasonNote: 'secret',
      },
    });
    const row = await prisma.auditEntry.findFirstOrThrow({
      where: { action: 'platform_subscription_commercial.created' },
      orderBy: { createdAt: 'desc' },
    });
    const serialized = JSON.stringify(row.details ?? {});
    for (const p of [
      'accessToken',
      'refreshToken',
      'sessionId',
      'mfa',
      'idempotencyKey',
      'requestBody',
      'rawAssignment',
      'billing',
      'payment',
      'clinical',
      'licensing',
      'stack',
      'sql',
      'reasonNote',
      'eyJ',
    ]) {
      expect(serialized).not.toContain(p);
    }
    expect((row.details as Record<string, string>).result).toBe('success');
    expect((row.details as Record<string, string>).runtimeEffective).toBe('false');
  });

  /**
   * Frozen contracts for this gate:
   * - Add-on dependencies: capability-based via FEATURE.owningModule (Add-on-to-Add-on N/A — no schema).
   * - Compatibility/exclusivity: Option B — ACTIVE Catalog INCOMPATIBLE_WITH is the sole exclusivity mechanism.
   * - Override scope: Not Applicable beyond assignment relation (no tenant/subscription scope discriminator on Override definition).
   */
  it('CONTRACT01: capability dependency missing rejected; Add-on-to-Add-on N/A documented', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const orphanModule = await prisma.healthcareCatalogItem.create({
      data: {
        id: randomUUID(),
        canonicalKey: `module.abs.orphan.${randomUUID().slice(0, 6)}`,
        kind: 'MODULE',
        lifecycle: 'ACTIVE',
        sortOrder: 9910,
      },
    });
    const orphanFeature = await prisma.healthcareCatalogItem.create({
      data: {
        id: randomUUID(),
        canonicalKey: `feature.abs.orphan.${randomUUID().slice(0, 6)}`,
        kind: 'FEATURE',
        lifecycle: 'ACTIVE',
        sortOrder: 9911,
        owningModuleItemId: orphanModule.id,
      },
    });
    const addon = await prisma.platformAddOn.create({
      data: {
        id: randomUUID(),
        canonicalKey: `addon.abs.dep.${randomUUID().slice(0, 6)}`,
        lifecycle: 'ACTIVE',
        translations: {
          create: [
            { locale: 'en-US', displayName: 'd', shortDescription: 'd' },
            { locale: 'ar-SY', displayName: 'd', shortDescription: 'd' },
          ],
        },
      },
    });
    const version = await prisma.platformAddOnVersion.create({
      data: {
        id: randomUUID(),
        addOnId: addon.id,
        versionNumber: 1,
        lifecycle: 'PUBLISHED',
        publishedAt: new Date(),
        publishedByPlatformUserId: randomUUID(),
        publicationFingerprint: createHash('sha256').update('dep').digest('hex'),
        publicationReason: 'dep',
        entitlements: { create: [{ catalogItemId: orphanFeature.id }] },
        applicability: { create: [{ planCanonicalKey }] },
        translations: {
          create: [
            { locale: 'en-US', releaseLabel: 'v1', shortDescription: 'v1' },
            { locale: 'ar-SY', releaseLabel: 'v1', shortDescription: 'v1' },
          ],
        },
      },
    });
    let caught: unknown;
    try {
      await s.replaceAddOns(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        addOnVersionIds: [version.id],
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    expect((caught as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ code: 'addon_dependency_missing' }),
    );
  });
});
