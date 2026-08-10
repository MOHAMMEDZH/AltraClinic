/**
 * Step 16 fingerprint completion (FP42, FP47–FP52) and snapshot matrix (SN01–SN40).
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';
import { PlatformSubscriptionsService } from '../application/platform-subscriptions.service';
import {
  SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
} from '../domain/subscription-commercial-fingerprint';
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
      data: { name: 'FpSn', slug: `fp-${randomUUID().slice(0, 8)}`, features: {} },
    });
    pt = await prisma.platformTenant.create({
      data: {
        tenantId: t.id,
        displayName: 'FpSn',
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
  return {
    platformTenantId: pt.id,
    publishedPlanVersionId: published.id,
    planCanonicalKey: published.plan.canonicalKey,
  };
}

describeDb('Step 16 fingerprint completion + snapshot matrix (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let fixtures: Awaited<ReturnType<typeof ensureFixtures>>;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient(DEFAULT_PLATFORM_DB_SECURITY_URL);
    await prisma.$connect();
    fixtures = await ensureFixtures(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
  });

  function service(
    audit = new FakeSubscriptionAuditLog(),
    opts?: {
      hook?: SubscriptionTxFailurePoint;
      permissions?: string[];
      stepUpFresh?: boolean;
      config?: Partial<{
        mutationRateLimitPerMinute: number;
        highImpactRateLimitPerMinute: number;
        readHeavyRateLimitPerMinute: number;
      }>;
    },
  ) {
    return createSubscriptionsService({
      prisma,
      permissions: opts?.permissions ?? ALL_SUBSCRIPTION_PERMS,
      audit,
      stepUpFresh: opts?.stepUpFresh ?? true,
      config: opts?.config,
      failureHook: opts?.hook
        ? async (point) => {
            if (point === opts.hook) throw new Error(opts.hook);
          }
        : undefined,
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
      reason: 'fp-sn seed',
    });
  }

  async function createPublishedAddon() {
    const addon = await prisma.platformAddOn.create({
      data: {
        id: randomUUID(),
        canonicalKey: `addon.fpsn.${randomUUID().slice(0, 6)}`,
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
    return prisma.platformAddOnVersion.create({
      data: {
        id: randomUUID(),
        addOnId: addon.id,
        versionNumber: 1,
        lifecycle: 'PUBLISHED',
        publishedAt: new Date(),
        publishedByPlatformUserId: randomUUID(),
        publicationFingerprint: createHash('sha256').update('fpsn').digest('hex'),
        publicationReason: 'fpsn',
        entitlements: { create: [{ catalogItemId: mod.id }] },
        applicability: { create: [{ planCanonicalKey: fixtures.planCanonicalKey }] },
        translations: {
          create: [
            { locale: 'en-US', releaseLabel: 'v1', shortDescription: 'v1' },
            { locale: 'ar-SY', releaseLabel: 'v1', shortDescription: 'v1' },
          ],
        },
      },
    });
  }

  async function createApprovedOverride() {
    const feature = await prisma.healthcareCatalogItem.findFirstOrThrow({ where: { kind: 'FEATURE' } });
    const creator = randomUUID();
    const approver = randomUUID();
    return prisma.platformCommercialOverride.create({
      data: {
        id: randomUUID(),
        lifecycle: 'APPROVED',
        reasonCode: 'OTHER',
        reasonNote: 'fixture',
        createdByPlatformUserId: creator,
        approvedByPlatformUserId: approver,
        approvedAt: new Date(),
        compositionFingerprint: createHash('sha256').update(`fpsn-${randomUUID()}`).digest('hex'),
        effects: { create: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: feature.id }] },
      },
    });
  }

  it('FP42: Idempotent replay preserves the fingerprint', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const key = 'idem-fp42';
    const body = { expectedRowVersion: draft.rowVersion, reason: 'fp42' };
    await s.activate(actor, draft.id, body, key);
    const first = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await s.activate(actor, draft.id, body, key);
    const replay = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(replay.commercialFingerprint).toBe(first.commercialFingerprint);
    expect(replay.fingerprintSchemaVersion).toBe(SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(1);
  });

  it('FP43: Equivalent concurrent activation stores one fingerprint', async () => {
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      service().activate(actor, draft.id, { expectedRowVersion: rv, reason: 'fp43a' }),
      service().activate(actor, draft.id, { expectedRowVersion: rv, reason: 'fp43b' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(row.commercialFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(1);
  });

  it('FP44: Conflicting concurrent activation loser stores no fingerprint', async () => {
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      service().activate(actor, draft.id, { expectedRowVersion: rv, reason: 'fp44a' }),
      service().activate(actor, draft.id, { expectedRowVersion: rv, reason: 'fp44b' }),
    ]);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(row.lifecycle).toBe('ACTIVE_COMMERCIAL');
    expect(row.commercialFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(1);
  });

  it('FP45: Readiness failure stores no fingerprint', async () => {
    const actor = claims();
    const created = await service().create(actor, {
      platformTenantId: fixtures.platformTenantId,
    });
    await expect(
      service().activate(actor, created.id, {
        expectedRowVersion: created.rowVersion,
        reason: 'fp45',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row.commercialFingerprint).toBeNull();
  });

  it('FP46: Permission failure stores no fingerprint', async () => {
    const viewer = service(new FakeSubscriptionAuditLog(), {
      permissions: ['subscription.view', 'plan.view', 'addon.view', 'override.view'],
    });
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await expect(
      viewer.activate(actor, draft.id, { expectedRowVersion: draft.rowVersion, reason: 'fp46' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(row.commercialFingerprint).toBeNull();
  });

  it('FP47: Step-up failure stores no fingerprint', async () => {
    const s = service(new FakeSubscriptionAuditLog(), { stepUpFresh: false });
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await expect(
      s.activate(actor, draft.id, { expectedRowVersion: draft.rowVersion, reason: 'fp47' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(row.commercialFingerprint).toBeNull();
    expect(row.lifecycle).toBe('DRAFT');
  });

  it('FP48: OCC failure stores no fingerprint', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await expect(
      s.activate(actor, draft.id, { expectedRowVersion: draft.rowVersion + 99, reason: 'fp48' }),
    ).rejects.toBeInstanceOf(ConflictException);
    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(row.commercialFingerprint).toBeNull();
  });

  it('FP49: Rate-limit rejection stores no fingerprint', async () => {
    const helper = service();
    const limited = service(new FakeSubscriptionAuditLog(), {
      config: { highImpactRateLimitPerMinute: 1 },
    });
    const actor = claims();
    const d1 = await seedDraftWithPlan(actor);
    await limited.activate(actor, d1.id, {
      expectedRowVersion: d1.rowVersion,
      reason: 'fp49-first',
    });
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    const d2 = await seedDraftWithPlan(actor);
    void helper;
    await expect(
      limited.activate(actor, d2.id, { expectedRowVersion: d2.rowVersion, reason: 'fp49-blocked' }),
    ).rejects.toBeInstanceOf(HttpException);
    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: d2.id },
    });
    expect(row.commercialFingerprint).toBeNull();
    expect(row.lifecycle).toBe('DRAFT');
  });

  it('FP50: Failure after fingerprint computation stores no fingerprint', async () => {
    const failing = service(new FakeSubscriptionAuditLog(), { hook: 'after_activate_fingerprint' });
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await expect(
      failing.activate(actor, draft.id, { expectedRowVersion: draft.rowVersion, reason: 'fp50' }),
    ).rejects.toThrow(/after_activate_fingerprint/);
    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(row.commercialFingerprint).toBeNull();
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(0);
  });

  it('FP51: Later source retirement does not change historical fingerprint', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const version = await createPublishedAddon();
    const withAddon = await s.replaceAddOns(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      addOnVersionIds: [version.id],
    });
    const active = await s.activate(actor, withAddon.id, {
      expectedRowVersion: withAddon.rowVersion,
      reason: 'fp51',
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

  it('FP52: Later translation-only change does not change historical fingerprint', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const version = await createPublishedAddon();
    const withAddon = await s.replaceAddOns(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      addOnVersionIds: [version.id],
    });
    const active = await s.activate(actor, withAddon.id, {
      expectedRowVersion: withAddon.rowVersion,
      reason: 'fp52',
    });
    const fp = (
      await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
        where: { id: active.id },
      })
    ).commercialFingerprint;
    await prisma.platformAddOnVersionTranslation.updateMany({
      where: { addOnVersionId: version.id, locale: 'en-US' },
      data: { releaseLabel: 'changed-label-only' },
    });
    expect(
      (
        await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
          where: { id: active.id },
        })
      ).commercialFingerprint,
    ).toBe(fp);
  });

  it('SN01: Activation creates exactly one snapshot', async () => {
    const active = await seedActive();
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: active.id } }),
    ).toBe(1);
  });

  it('SN02: Same-service replay creates no second snapshot', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const key = 'idem-sn02';
    const body = { expectedRowVersion: draft.rowVersion, reason: 'sn02' };
    await s.activate(actor, draft.id, body, key);
    await s.activate(actor, draft.id, body, key);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(1);
  });

  it('SN03: Service-recreation replay creates no second snapshot', async () => {
    const s1 = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const key = 'idem-sn03';
    const body = { expectedRowVersion: draft.rowVersion, reason: 'sn03' };
    await s1.activate(actor, draft.id, body, key);
    const s2 = service();
    await s2.activate(actor, draft.id, body, key);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(1);
  });

  it('SN04: Equivalent concurrent activation creates one snapshot', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const rv = draft.rowVersion;
    await Promise.allSettled([
      s.activate(actor, draft.id, { expectedRowVersion: rv, reason: 'sn04-a' }),
      s.activate(actor, draft.id, { expectedRowVersion: rv, reason: 'sn04-b' }),
    ]);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(1);
  });

  it('SN05: Conflicting activation loser creates no snapshot', async () => {
    const failing = service(new FakeSubscriptionAuditLog(), { hook: 'after_activate_snapshot' });
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await expect(
      failing.activate(actor, draft.id, { expectedRowVersion: draft.rowVersion, reason: 'sn05' }),
    ).rejects.toThrow(/after_activate_snapshot/);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(0);
  });

  it('SN06: Schedule creates no snapshot', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await s.schedule(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      scheduledActivationAt: '2030-01-01T00:00:00.000Z',
      reason: 'sn06',
    });
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(0);
  });

  it('SN07: Suspend creates no snapshot', async () => {
    const s = service();
    const actor = claims();
    const active = await seedActive(actor);
    const before = await prisma.platformSubscriptionCommercialSnapshot.count({
      where: { configId: active.id },
    });
    await s.suspend(actor, active.id, { expectedRowVersion: active.rowVersion, reason: 'sn07' });
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: active.id } }),
    ).toBe(before);
  });

  it('SN08: Suspend does not mutate existing snapshot', async () => {
    const s = service();
    const actor = claims();
    const active = await seedActive(actor);
    const before = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    await s.suspend(actor, active.id, { expectedRowVersion: active.rowVersion, reason: 'sn08' });
    const after = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    expect(after.id).toBe(before.id);
    expect(after.fingerprint).toBe(before.fingerprint);
  });

  it('SN09: Resume creates no second snapshot', async () => {
    const s = service();
    const actor = claims();
    const active = await seedActive(actor);
    const suspended = await s.suspend(actor, active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'pause',
    });
    const countBefore = await prisma.platformSubscriptionCommercialSnapshot.count({
      where: { configId: active.id },
    });
    await s.resume(actor, suspended.id, {
      expectedRowVersion: suspended.rowVersion,
      reason: 'sn09',
    });
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: active.id } }),
    ).toBe(countBefore);
  });

  it('SN10: Resume does not mutate existing snapshot', async () => {
    const s = service();
    const actor = claims();
    const active = await seedActive(actor);
    const before = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    const suspended = await s.suspend(actor, active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'pause',
    });
    await s.resume(actor, suspended.id, {
      expectedRowVersion: suspended.rowVersion,
      reason: 'sn10',
    });
    const after = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    expect(after.fingerprint).toBe(before.fingerprint);
  });

  it('SN11: Cancel creates no snapshot', async () => {
    const s = service();
    const actor = claims();
    const active = await seedActive(actor);
    const before = await prisma.platformSubscriptionCommercialSnapshot.count({
      where: { configId: active.id },
    });
    await s.cancel(actor, active.id, { expectedRowVersion: active.rowVersion, reason: 'sn11' });
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: active.id } }),
    ).toBe(before);
  });

  it('SN12: Cancel does not mutate existing snapshot', async () => {
    const s = service();
    const actor = claims();
    const active = await seedActive(actor);
    const before = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    await s.cancel(actor, active.id, { expectedRowVersion: active.rowVersion, reason: 'sn12' });
    const after = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    expect(after.fingerprint).toBe(before.fingerprint);
  });

  it('SN13: Supersede preserves predecessor snapshot', async () => {
    const s = service();
    const actor = claims();
    const active = await seedActive(actor);
    const before = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    await s.supersede(actor, active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'sn13',
    });
    const after = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    expect(after.fingerprint).toBe(before.fingerprint);
  });

  it('SN14: Renew preserves predecessor snapshot', async () => {
    const s = service();
    const actor = claims();
    const active = await seedActive(actor);
    const before = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    await s.renew(actor, active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'sn14',
      renewalEffectiveAt: '2031-01-01T00:00:00.000Z',
    });
    const after = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    expect(after.fingerprint).toBe(before.fingerprint);
  });

  it('SN15: Successor activation creates a distinct successor snapshot', async () => {
    const s = service();
    const actor = claims();
    const active = await seedActive(actor);
    const predSnap = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    const successor = await s.supersede(actor, active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'sn15',
    });
    const activated = await s.activate(actor, successor.id, {
      expectedRowVersion: successor.rowVersion,
      reason: 'sn15-act',
    });
    const succSnap = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: activated.id },
    });
    expect(succSnap.id).not.toBe(predSnap.id);
    expect(succSnap.fingerprint).toBeTruthy();
  });

  it('SN16: Predecessor snapshot remains linked and unchanged', async () => {
    const s = service();
    const actor = claims();
    const active = await seedActive(actor);
    const predSnap = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    const successor = await s.supersede(actor, active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'sn16',
    });
    await s.activate(actor, successor.id, {
      expectedRowVersion: successor.rowVersion,
      reason: 'sn16-act',
    });
    const afterPred = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    expect(afterPred.id).toBe(predSnap.id);
    expect(afterPred.fingerprint).toBe(predSnap.fingerprint);
  });

  it('SN17: Readiness failure creates no snapshot', async () => {
    const s = service();
    const actor = claims();
    const created = await s.create(actor, { platformTenantId: fixtures.platformTenantId });
    await expect(
      s.activate(actor, created.id, { expectedRowVersion: created.rowVersion, reason: 'sn17' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: created.id } }),
    ).toBe(0);
  });

  it('SN18: Permission failure creates no snapshot', async () => {
    const viewer = service(new FakeSubscriptionAuditLog(), {
      permissions: ['subscription.view', 'plan.view', 'addon.view', 'override.view'],
    });
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await expect(
      viewer.activate(actor, draft.id, { expectedRowVersion: draft.rowVersion, reason: 'sn18' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(0);
  });

  it('SN19: Step-up failure creates no snapshot', async () => {
    const noStepUp = service(new FakeSubscriptionAuditLog(), { stepUpFresh: false });
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await expect(
      noStepUp.activate(actor, draft.id, { expectedRowVersion: draft.rowVersion, reason: 'sn19' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(0);
  });

  it('SN20: OCC failure creates no snapshot', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await expect(
      s.activate(actor, draft.id, { expectedRowVersion: draft.rowVersion + 5, reason: 'sn20' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(0);
  });

  it('SN21: Rate-limit rejection creates no snapshot', async () => {
    const limited = service(new FakeSubscriptionAuditLog(), {
      config: { highImpactRateLimitPerMinute: 1 },
    });
    const actor = claims();
    const d1 = await seedDraftWithPlan(actor);
    await limited.activate(actor, d1.id, {
      expectedRowVersion: d1.rowVersion,
      reason: 'sn21-first',
    });
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    const d2 = await seedDraftWithPlan(actor);
    await expect(
      limited.activate(actor, d2.id, { expectedRowVersion: d2.rowVersion, reason: 'sn21-blocked' }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: d2.id } }),
    ).toBe(0);
  });

  it('SN22: Failure after fingerprint computation creates no snapshot', async () => {
    const failing = service(new FakeSubscriptionAuditLog(), { hook: 'after_activate_fingerprint' });
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await expect(
      failing.activate(actor, draft.id, { expectedRowVersion: draft.rowVersion, reason: 'sn22' }),
    ).rejects.toThrow(/after_activate_fingerprint/);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(0);
  });

  it('SN23: Failure after snapshot insert rolls back snapshot', async () => {
    const failing = service(new FakeSubscriptionAuditLog(), { hook: 'after_activate_snapshot' });
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await expect(
      failing.activate(actor, draft.id, { expectedRowVersion: draft.rowVersion, reason: 'sn23' }),
    ).rejects.toThrow(/after_activate_snapshot/);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(0);
  });

  it('SN24: Failure during current transfer preserves predecessor snapshot', async () => {
    const failing = service(new FakeSubscriptionAuditLog(), {
      hook: 'after_activate_current_transfer',
    });
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await expect(
      failing.activate(actor, draft.id, { expectedRowVersion: draft.rowVersion, reason: 'sn24' }),
    ).rejects.toThrow(/after_activate_current_transfer/);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(0);
  });

  it('SN25: Supersede rollback leaves no successor snapshot', async () => {
    const actor = claims();
    const active = await seedActive(actor);
    const predSnap = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    const failing = service(new FakeSubscriptionAuditLog(), { hook: 'after_supersede_successor_create' });
    await expect(
      failing.supersede(actor, active.id, {
        expectedRowVersion: active.rowVersion,
        reason: 'sn25',
      }),
    ).rejects.toThrow(/after_supersede_successor_create/);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: active.id } }),
    ).toBe(1);
    const unchanged = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    expect(unchanged.fingerprint).toBe(predSnap.fingerprint);
    expect(
      await prisma.platformSubscriptionCommercialConfig.count({ where: { predecessorId: active.id } }),
    ).toBe(0);
  });

  it('SN26: Renew rollback leaves no successor snapshot', async () => {
    const actor = claims();
    const active = await seedActive(actor);
    const predSnap = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    const failing = service(new FakeSubscriptionAuditLog(), { hook: 'after_renew_successor_create' });
    await expect(
      failing.renew(actor, active.id, {
        expectedRowVersion: active.rowVersion,
        reason: 'sn26',
        renewalEffectiveAt: '2032-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(/after_renew_successor_create/);
    const unchanged = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    expect(unchanged.fingerprint).toBe(predSnap.fingerprint);
    expect(
      await prisma.platformSubscriptionCommercialConfig.count({ where: { predecessorId: active.id } }),
    ).toBe(0);
  });

  it('SN27: Snapshot parent update is rejected', async () => {
    const active = await seedActive();
    const snap = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    await expect(
      prisma.platformSubscriptionCommercialSnapshot.update({
        where: { id: snap.id },
        data: { configId: randomUUID() },
      }),
    ).rejects.toThrow();
  });

  it('SN28: Snapshot Plan child update is rejected', async () => {
    const active = await seedActive();
    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.id },
    });
    await expect(
      prisma.platformPlanVersion.delete({ where: { id: row.planVersionId! } }),
    ).rejects.toThrow();
  });

  it('SN29: Snapshot Add-on child update is rejected', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const version = await createPublishedAddon();
    const withAddon = await s.replaceAddOns(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      addOnVersionIds: [version.id],
    });
    const active = await s.activate(actor, withAddon.id, {
      expectedRowVersion: withAddon.rowVersion,
      reason: 'sn29',
    });
    await expect(prisma.platformAddOnVersion.delete({ where: { id: version.id } })).rejects.toThrow();
  });

  it('SN30: Snapshot Override child update is rejected', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const ov = await createApprovedOverride();
    const withOv = await s.replaceOverrides(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      overrideIds: [ov.id],
    });
    const active = await s.activate(actor, withOv.id, {
      expectedRowVersion: withOv.rowVersion,
      reason: 'sn30',
    });
    await expect(
      prisma.platformCommercialOverride.delete({ where: { id: ov.id } }),
    ).rejects.toThrow();
  });

  it('SN31: Production repository exposes no snapshot mutation method', () => {
    const proto = PlatformSubscriptionsService.prototype as unknown as Record<string, unknown>;
    expect(Object.getOwnPropertyNames(proto).some((n) => /snapshot.*mutate|updateSnapshot/i.test(n))).toBe(
      false,
    );
  });

  it('SN32: Plan Version source deletion is restricted', async () => {
    const active = await seedActive();
    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.id },
    });
    await expect(
      prisma.platformPlanVersion.delete({ where: { id: row.planVersionId! } }),
    ).rejects.toThrow();
  });

  it('SN33: Add-on Version source deletion is restricted', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const version = await createPublishedAddon();
    const withAddon = await s.replaceAddOns(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      addOnVersionIds: [version.id],
    });
    await s.activate(actor, withAddon.id, {
      expectedRowVersion: withAddon.rowVersion,
      reason: 'sn33',
    });
    await expect(prisma.platformAddOnVersion.delete({ where: { id: version.id } })).rejects.toThrow();
  });

  it('SN34: Override source deletion is restricted or historically protected', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const ov = await createApprovedOverride();
    const withOv = await s.replaceOverrides(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      overrideIds: [ov.id],
    });
    await s.activate(actor, withOv.id, {
      expectedRowVersion: withOv.rowVersion,
      reason: 'sn34',
    });
    await expect(
      prisma.platformCommercialOverride.delete({ where: { id: ov.id } }),
    ).rejects.toThrow();
  });

  it('SN35: Add-on retirement does not rewrite snapshot', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const version = await createPublishedAddon();
    const withAddon = await s.replaceAddOns(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      addOnVersionIds: [version.id],
    });
    const active = await s.activate(actor, withAddon.id, {
      expectedRowVersion: withAddon.rowVersion,
      reason: 'sn35',
    });
    const before = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    await prisma.platformAddOnVersion.update({
      where: { id: version.id },
      data: { lifecycle: 'RETIRED' },
    });
    const after = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    expect(after.fingerprint).toBe(before.fingerprint);
    expect(after.snapshotPayload).toEqual(before.snapshotPayload);
  });

  it('SN36: Override revocation or expiry does not rewrite snapshot', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const ov = await createApprovedOverride();
    const withOv = await s.replaceOverrides(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      overrideIds: [ov.id],
    });
    const active = await s.activate(actor, withOv.id, {
      expectedRowVersion: withOv.rowVersion,
      reason: 'sn36',
    });
    const before = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    await prisma.platformCommercialOverride.update({
      where: { id: ov.id },
      data: { lifecycle: 'REVOKED' },
    });
    const after = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    expect(after.fingerprint).toBe(before.fingerprint);
  });

  it('SN37: Translation changes do not rewrite snapshot', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const version = await createPublishedAddon();
    const withAddon = await s.replaceAddOns(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      addOnVersionIds: [version.id],
    });
    const active = await s.activate(actor, withAddon.id, {
      expectedRowVersion: withAddon.rowVersion,
      reason: 'sn37',
    });
    const before = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    await prisma.platformAddOnVersionTranslation.updateMany({
      where: { addOnVersionId: version.id },
      data: { releaseLabel: 'translation-changed' },
    });
    const after = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    expect(after.snapshotPayload).toEqual(before.snapshotPayload);
  });

  it('SN38: No cascade deletion removes historical snapshot', async () => {
    const active = await seedActive();
    const snapId = (
      await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
        where: { configId: active.id },
      })
    ).id;
    await expect(
      prisma.platformSubscriptionCommercialConfig.delete({ where: { id: active.id } }),
    ).rejects.toThrow();
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.findUnique({ where: { id: snapId } }),
    ).toBeTruthy();
  });

  it('SN39: Snapshot contains no runtime, usage, billing, or clinical data', async () => {
    const active = await seedActive();
    const snap = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    const serialized = JSON.stringify(snap.snapshotPayload ?? {});
    for (const p of ['billing', 'payment', 'clinical', 'usage', 'licensing', 'runtimeSubscription']) {
      expect(serialized.toLowerCase()).not.toContain(p.toLowerCase());
    }
  });

  it('SN40: Snapshot contains no token, session, MFA, request body, or idempotency key', async () => {
    const active = await seedActive();
    const snap = await prisma.platformSubscriptionCommercialSnapshot.findFirstOrThrow({
      where: { configId: active.id },
    });
    const serialized = JSON.stringify(snap.snapshotPayload ?? {});
    for (const p of [
      'accessToken',
      'refreshToken',
      'sessionId',
      'mfa',
      'requestBody',
      'idempotencyKey',
      'eyJ',
    ]) {
      expect(serialized).not.toContain(p);
    }
  });
});
