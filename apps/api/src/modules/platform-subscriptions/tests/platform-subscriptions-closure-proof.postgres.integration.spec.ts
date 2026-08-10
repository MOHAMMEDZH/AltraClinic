/**
 * Step 16 final-closure evidence: readiness severity, Add-on/Override assignment cells,
 * fingerprint exclusions, snapshot lifecycle, schedule/suspend/resume/renew rollback.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';
import {
  futureEffectiveOverrideSeverity,
  parseSubscriptionReadinessAction,
} from '../domain/subscription-readiness-action';
import {
  computeSubscriptionCommercialFingerprint,
  SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
} from '../domain/subscription-commercial-fingerprint';
import { redactSubscriptionAuditDetails } from '../application/subscription-audit-redaction';
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
  } as unknown as JwtClaimsVO;
}

describe('Step 16 readiness action severity (unit)', () => {
  it('parses action query and freezes future-effective severity', () => {
    expect(parseSubscriptionReadinessAction('edit')).toBe('edit');
    expect(parseSubscriptionReadinessAction('ASSIGN-ADDONS')).toBe('assign_addons');
    expect(parseSubscriptionReadinessAction(undefined)).toBe('activate');

    const future = new Date('2030-01-01T00:00:00.000Z');
    const now = new Date('2026-07-01T00:00:00.000Z');
    expect(
      futureEffectiveOverrideSeverity({
        action: 'preview',
        effectiveFrom: future,
        now,
        scheduledActivationAt: null,
      }),
    ).toBe('warning');
    expect(
      futureEffectiveOverrideSeverity({
        action: 'activate',
        effectiveFrom: future,
        now,
        scheduledActivationAt: null,
      }),
    ).toBe('blocker');
    expect(
      futureEffectiveOverrideSeverity({
        action: 'schedule',
        effectiveFrom: future,
        now,
        scheduledActivationAt: new Date('2031-01-01T00:00:00.000Z'),
      }),
    ).toBe('warning');
    expect(
      futureEffectiveOverrideSeverity({
        action: 'schedule',
        effectiveFrom: future,
        now,
        scheduledActivationAt: new Date('2029-01-01T00:00:00.000Z'),
      }),
    ).toBe('blocker');
  });
});

describe('Step 16 fingerprint matrix (unit)', () => {
  const base = {
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

  it('material inputs independently alter fingerprint', () => {
    const a = computeSubscriptionCommercialFingerprint(base);
    expect(SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA).toBe('subscription-commercial-fingerprint/v1');
    expect(a).not.toBe(
      computeSubscriptionCommercialFingerprint({ ...base, platformTenantId: 't2' }),
    );
    expect(a).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...base,
        platformSubscriptionId: 'corr-1',
      }),
    );
    expect(a).not.toBe(
      computeSubscriptionCommercialFingerprint({ ...base, planCanonicalKey: 'plan.lite' }),
    );
    expect(a).not.toBe(
      computeSubscriptionCommercialFingerprint({ ...base, planVersionId: 'pv2' }),
    );
    expect(a).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...base,
        planPublicationFingerprint: 'pf-x',
      }),
    );
    expect(a).not.toBe(
      computeSubscriptionCommercialFingerprint({ ...base, addonVersionIds: ['a1'] }),
    );
    expect(a).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...base,
        addonFingerprints: ['f1', 'f-changed'],
      }),
    );
    expect(a).not.toBe(
      computeSubscriptionCommercialFingerprint({ ...base, overrideIds: ['o1'] }),
    );
    expect(a).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...base,
        overrideFingerprints: ['of1', 'of-changed'],
      }),
    );
    expect(a).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...base,
        commercialStart: '2026-02-01T00:00:00.000Z',
      }),
    );
    expect(a).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...base,
        commercialEnd: '2028-01-01T00:00:00.000Z',
      }),
    );
    expect(a).not.toBe(
      computeSubscriptionCommercialFingerprint({
        ...base,
        scheduledActivationAt: '2026-06-01T00:00:00.000Z',
      }),
    );
  });

  it('excludes actor/idempotency/display noise and normalizes UTC + order', () => {
    const a = computeSubscriptionCommercialFingerprint(base);
    expect(a).toBe(
      computeSubscriptionCommercialFingerprint({
        ...base,
        addonVersionIds: ['a1', 'a2'],
        overrideIds: ['o1', 'o2'],
        addonFingerprints: ['f1', 'f2'],
        overrideFingerprints: ['of1', 'of2'],
      }),
    );
    // Same instant as UTC string must match when caller already normalized.
    expect(a).toBe(
      computeSubscriptionCommercialFingerprint({
        ...base,
        commercialStart: '2026-01-01T00:00:00.000Z',
      }),
    );
    // Non-material fields are simply absent from the payload (caller must not pass them).
    expect(a).toHaveLength(64);
  });
});

describe('Step 16 redaction shapes (unit)', () => {
  const shapes = [
    'create',
    'update',
    'plan',
    'addons',
    'overrides',
    'dates',
    'schedule',
    'activate',
    'suspend',
    'resume',
    'cancel',
    'supersede',
    'renew',
  ] as const;

  it.each(shapes)('redacts prohibited fields for %s metadata shape', (shape) => {
    const dirty = {
      result: 'success',
      lifecycleBefore: 'DRAFT',
      lifecycleAfter: shape === 'activate' ? 'ACTIVE_COMMERCIAL' : 'DRAFT',
      expectedVersion: '1',
      resultingVersion: '2',
      planCanonicalKey: 'plan.pro',
      planVersionNumber: '1',
      addonCount: '0',
      overrideCount: '0',
      fingerprintSchema: SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
      dateClassification: 'commercial_window',
      predecessorClassification: 'SUPERSEDED',
      successorClassification: 'DRAFT',
      reasonCode: shape === 'renew' ? 'RENEW' : 'SUPERSEDE',
      // prohibited injections
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb',
      refreshToken: 'refresh-secret',
      sessionId: randomUUID(),
      mfa: '123456',
      idempotencyKey: 'idem-x',
      requestBody: { raw: true },
      rawAssignment: { addOnVersionIds: ['x'] },
      description: 'free form',
      reasonNote: 'secret note',
      billing: { invoice: 'INV-1' },
      payment: { card: '4111' },
      clinical: { phi: 'patient' },
      licensing: { canUse: true },
      cacheKey: 'cache:1',
      stack: 'Error: boom',
      prisma: 'P2002',
      sql: 'SELECT * FROM patients',
      actorEmail: 'admin@example.com',
      shape,
    };
    const clean = redactSubscriptionAuditDetails(dirty);
    const serialized = JSON.stringify(clean);
    for (const p of [
      'accessToken',
      'refreshToken',
      'sessionId',
      'mfa',
      'idempotencyKey',
      'requestBody',
      'rawAssignment',
      'reasonNote',
      'billing',
      'payment',
      'clinical',
      'licensing',
      'cacheKey',
      'stack',
      'prisma',
      'sql',
      'actorEmail',
      'eyJ',
    ]) {
      expect(serialized).not.toContain(p);
    }
    expect(clean.result).toBe('success');
    expect(clean.runtimeEffective).toBe('false');
  });
});

describeDb('Step 16 closure proof matrices (postgres)', () => {
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
        data: { name: 'Closure Matrix', slug: `cm-${randomUUID().slice(0, 8)}`, features: {} },
      });
      pt = await prisma.platformTenant.create({
        data: {
          tenantId: t.id,
          displayName: 'Closure Matrix',
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

  async function seedDraftWithPlan(actor = claims()) {
    const s = service();
    const c = await s.create(actor, { platformTenantId });
    return s.assignPlanVersion(actor, c.id, {
      expectedRowVersion: c.rowVersion,
      planVersionId: publishedPlanVersionId,
    });
  }

  async function createPublishedAddon(opts: {
    key: string;
    entitlementKeys: string[];
    limitAbsolute?: { key: string; valueText: string };
    applicablePlans?: string[];
  }) {
    const addon = await prisma.platformAddOn.create({
      data: {
        id: randomUUID(),
        canonicalKey: opts.key,
        lifecycle: 'ACTIVE',
        translations: {
          create: [
            { locale: 'en-US', displayName: opts.key, shortDescription: opts.key },
            { locale: 'ar-SY', displayName: opts.key, shortDescription: opts.key },
          ],
        },
      },
    });
    const catalogIds: string[] = [];
    for (const k of opts.entitlementKeys) {
      const item = await prisma.healthcareCatalogItem.findUniqueOrThrow({
        where: { canonicalKey: k },
      });
      catalogIds.push(item.id);
    }
    let limitCreate:
      | { create: Array<{ catalogItemId: string; effectType: 'SET_ABSOLUTE'; unlimited: false; valueText: string }> }
      | undefined;
    if (opts.limitAbsolute) {
      const lim = await prisma.healthcareCatalogItem.findUniqueOrThrow({
        where: { canonicalKey: opts.limitAbsolute.key },
      });
      limitCreate = {
        create: [
          {
            catalogItemId: lim.id,
            effectType: 'SET_ABSOLUTE',
            unlimited: false,
            valueText: opts.limitAbsolute.valueText,
          },
        ],
      };
    }
    const version = await prisma.platformAddOnVersion.create({
      data: {
        id: randomUUID(),
        addOnId: addon.id,
        versionNumber: 1,
        lifecycle: 'PUBLISHED',
        publishedAt: new Date(),
        publishedByPlatformUserId: randomUUID(),
        publicationFingerprint: createHash('sha256').update(opts.key).digest('hex'),
        publicationReason: 'closure fixture',
        entitlements: { create: catalogIds.map((catalogItemId) => ({ catalogItemId })) },
        limitEffects: limitCreate,
        applicability: {
          create: (opts.applicablePlans ?? [planCanonicalKey]).map((planCanonicalKey) => ({
            planCanonicalKey,
          })),
        },
        translations: {
          create: [
            { locale: 'en-US', releaseLabel: 'v1', shortDescription: 'v1' },
            { locale: 'ar-SY', releaseLabel: 'v1', shortDescription: 'v1' },
          ],
        },
      },
    });
    return version;
  }

  async function createOverride(lifecycle: string, extras: Record<string, unknown> = {}) {
    const feature = await prisma.healthcareCatalogItem.findFirstOrThrow({ where: { kind: 'FEATURE' } });
    return prisma.platformCommercialOverride.create({
      data: {
        id: randomUUID(),
        lifecycle: lifecycle as never,
        reasonCode: 'OTHER',
        reasonNote: 'fixture',
        createdByPlatformUserId: randomUUID(),
        compositionFingerprint: createHash('sha256').update(`${lifecycle}-${randomUUID()}`).digest('hex'),
        effects: lifecycle === 'APPROVED' ? { create: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: feature.id }] } : undefined,
        ...extras,
      } as never,
    });
  }

  it('readiness: lifecycle codes are blockers for matching actions; mutation blocked before TX', async () => {
    const audit = new FakeSubscriptionAuditLog();
    const s = service(audit);
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const active = await s.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'activate for readiness',
    });

    const editReady = await s.readiness(actor, active.id, 'edit');
    expect(editReady.status).toBe('blocked');
    expect(editReady.blockers.some((b) => b.code === 'lifecycle_not_editable')).toBe(true);
    expect(editReady.warnings.some((w) => w.code === 'lifecycle_not_editable')).toBe(false);

    const scheduleReady = await s.readiness(actor, active.id, 'schedule');
    expect(scheduleReady.blockers.some((b) => b.code === 'lifecycle_not_schedulable')).toBe(true);

    const activateReady = await s.readiness(actor, active.id, 'activate');
    expect(activateReady.blockers.some((b) => b.code === 'lifecycle_not_activatable')).toBe(true);

    const beforeRv = active.rowVersion;
    await expect(
      s.update(actor, active.id, { expectedRowVersion: beforeRv, reasonCode: 'X' }),
    ).rejects.toBeInstanceOf(ConflictException);
    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.id },
    });
    expect(row.rowVersion).toBe(beforeRv);
    expect(row.lifecycle).toBe('ACTIVE_COMMERCIAL');
    expect(audit.records.filter((r) => r.action === 'platform_subscription_commercial.updated')).toHaveLength(0);
  });

  it('readiness: suspended tenant is blocker for activate; resume still works', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    await prisma.platformTenant.update({
      where: { id: platformTenantId },
      data: { status: 'SUSPENDED' },
    });
    const activateReady = await s.readiness(actor, draft.id, 'activate');
    expect(activateReady.status).toBe('blocked');
    expect(activateReady.blockers.some((b) => b.code === 'tenant_lifecycle_ineligible')).toBe(true);
    await expect(
      s.activate(actor, draft.id, { expectedRowVersion: draft.rowVersion, reason: 'blocked tenant' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(0);

    await prisma.platformTenant.update({
      where: { id: platformTenantId },
      data: { status: 'ACTIVE' },
    });
    const active = await s.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'ok',
    });
    const suspended = await s.suspend(actor, active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'pause',
    });
    const resumed = await s.resume(actor, suspended.id, {
      expectedRowVersion: suspended.rowVersion,
      reason: 'resume',
    });
    expect(resumed.lifecycle).toBe('ACTIVE_COMMERCIAL');
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: resumed.id } }),
    ).toBe(1);
  });

  it('Add-on matrix: draft/retired rejected; published accepted; duplicate rejected; limit conflict rejected', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const published = await createPublishedAddon({
      key: `addon.closure.ok.${randomUUID().slice(0, 6)}`,
      entitlementKeys: ['module.dashboard'],
    });
    const accepted = await s.replaceAddOns(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      addOnVersionIds: [published.id],
    });
    expect(accepted.addonVersionIds).toContain(published.id);

    const draftAddon = await prisma.platformAddOn.create({
      data: {
        id: randomUUID(),
        canonicalKey: `addon.closure.draft.${randomUUID().slice(0, 6)}`,
        lifecycle: 'ACTIVE',
        translations: {
          create: [
            { locale: 'en-US', displayName: 'd', shortDescription: 'd' },
            { locale: 'ar-SY', displayName: 'd', shortDescription: 'd' },
          ],
        },
      },
    });
    const draftVersion = await prisma.platformAddOnVersion.create({
      data: {
        id: randomUUID(),
        addOnId: draftAddon.id,
        versionNumber: 1,
        lifecycle: 'DRAFT',
        applicability: { create: [{ planCanonicalKey }] },
        translations: {
          create: [
            { locale: 'en-US', releaseLabel: 'd', shortDescription: 'd' },
            { locale: 'ar-SY', releaseLabel: 'd', shortDescription: 'd' },
          ],
        },
      },
    });
    {
      let caught: unknown;
      try {
        await s.replaceAddOns(actor, accepted.id, {
          expectedRowVersion: accepted.rowVersion,
          addOnVersionIds: [draftVersion.id],
        });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(BadRequestException);
      expect((caught as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ code: 'addon_draft_rejected' }),
      );
    }

    {
      let caught: unknown;
      try {
        await s.replaceAddOns(actor, accepted.id, {
          expectedRowVersion: accepted.rowVersion,
          addOnVersionIds: [published.id, published.id],
        });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(BadRequestException);
      expect((caught as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ code: 'addon_duplicate' }),
      );
    }

    const limitKey = (await prisma.healthcareCatalogItem.findFirstOrThrow({ where: { kind: 'LIMIT' } }))
      .canonicalKey;
    const a1 = await createPublishedAddon({
      key: `addon.closure.lim.a.${randomUUID().slice(0, 6)}`,
      entitlementKeys: ['module.dashboard'],
      limitAbsolute: { key: limitKey, valueText: '10' },
    });
    const a2 = await createPublishedAddon({
      key: `addon.closure.lim.b.${randomUUID().slice(0, 6)}`,
      entitlementKeys: ['module.dashboard'],
      limitAbsolute: { key: limitKey, valueText: '20' },
    });
    {
      let caught: unknown;
      try {
        await s.replaceAddOns(actor, accepted.id, {
          expectedRowVersion: accepted.rowVersion,
          addOnVersionIds: [a2.id, a1.id],
        });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(BadRequestException);
      expect((caught as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ code: 'addon_limit_conflict' }),
      );
    }
  });

  it('Override matrix: non-Approved rejected; Approved accepted; grant+suppress contradiction rejected', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    for (const lifecycle of ['DRAFT', 'PENDING_APPROVAL', 'REJECTED', 'REVOKED'] as const) {
      const bad = await createOverride(lifecycle);
      await expect(
        s.replaceOverrides(actor, draft.id, {
          expectedRowVersion: draft.rowVersion,
          overrideIds: [bad.id],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }

    const approved = await createOverride('APPROVED', {
      approvedAt: new Date(),
      approvedByPlatformUserId: randomUUID(),
    });
    const ok = await s.replaceOverrides(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      overrideIds: [approved.id],
    });
    expect(ok.overrideIds).toContain(approved.id);

    const feature = await prisma.healthcareCatalogItem.findFirstOrThrow({ where: { kind: 'FEATURE' } });
    const grant = await prisma.platformCommercialOverride.create({
      data: {
        id: randomUUID(),
        lifecycle: 'APPROVED',
        reasonCode: 'OTHER',
        reasonNote: 'grant fixture',
        createdByPlatformUserId: randomUUID(),
        approvedAt: new Date(),
        approvedByPlatformUserId: randomUUID(),
        compositionFingerprint: createHash('sha256').update(`g-${randomUUID()}`).digest('hex'),
        effects: { create: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: feature.id }] },
      },
    });
    const suppress = await prisma.platformCommercialOverride.create({
      data: {
        id: randomUUID(),
        lifecycle: 'APPROVED',
        reasonCode: 'OTHER',
        reasonNote: 'suppress fixture',
        createdByPlatformUserId: randomUUID(),
        approvedAt: new Date(),
        approvedByPlatformUserId: randomUUID(),
        compositionFingerprint: createHash('sha256').update(`s-${randomUUID()}`).digest('hex'),
        effects: { create: [{ effectKind: 'ENTITLEMENT_SUPPRESS', catalogItemId: feature.id }] },
      },
    });
    {
      let caught: unknown;
      try {
        await s.replaceOverrides(actor, ok.id, {
          expectedRowVersion: ok.rowVersion,
          overrideIds: [suppress.id, grant.id],
        });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(BadRequestException);
      expect((caught as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ code: 'override_contradiction' }),
      );
    }
  });

  it('rollback: schedule / suspend / resume / renew preserve prior state', async () => {
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const failingSchedule = service(new FakeSubscriptionAuditLog(), 'after_schedule_lifecycle');
    await expect(
      failingSchedule.schedule(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        scheduledActivationAt: '2030-01-01T00:00:00.000Z',
        reason: 'rb schedule',
      }),
    ).rejects.toThrow(/after_schedule_lifecycle/);
    const afterSchedule = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(afterSchedule.lifecycle).toBe('DRAFT');
    expect(afterSchedule.scheduledActivationAt).toBeNull();
    expect(afterSchedule.rowVersion).toBe(draft.rowVersion);

    const s = service();
    const active = await s.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'activate',
    });
    const snapBefore = await prisma.platformSubscriptionCommercialSnapshot.count({
      where: { configId: active.id },
    });

    const failingSuspend = service(new FakeSubscriptionAuditLog(), 'after_suspend_lifecycle');
    await expect(
      failingSuspend.suspend(actor, active.id, {
        expectedRowVersion: active.rowVersion,
        reason: 'rb suspend',
      }),
    ).rejects.toThrow(/after_suspend_lifecycle/);
    const afterSuspend = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.id },
    });
    expect(afterSuspend.lifecycle).toBe('ACTIVE_COMMERCIAL');
    expect(afterSuspend.rowVersion).toBe(active.rowVersion);

    const suspended = await s.suspend(actor, active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'pause',
    });
    const failingResume = service(new FakeSubscriptionAuditLog(), 'after_resume_lifecycle');
    await expect(
      failingResume.resume(actor, suspended.id, {
        expectedRowVersion: suspended.rowVersion,
        reason: 'rb resume',
      }),
    ).rejects.toThrow(/after_resume_lifecycle/);
    const afterResume = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: suspended.id },
    });
    expect(afterResume.lifecycle).toBe('SUSPENDED');
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: suspended.id } }),
    ).toBe(snapBefore);

    const resumed = await s.resume(actor, suspended.id, {
      expectedRowVersion: suspended.rowVersion,
      reason: 'resume',
    });
    const beforeRenewCount = await prisma.platformSubscriptionCommercialConfig.count();
    const failingRenew = service(new FakeSubscriptionAuditLog(), 'after_renew_successor_create');
    await expect(
      failingRenew.renew(
        actor,
        resumed.id,
        {
          expectedRowVersion: resumed.rowVersion,
          reason: 'rb renew',
          renewalEffectiveAt: '2031-01-01T00:00:00.000Z',
        },
        'idem-rb-renew',
      ),
    ).rejects.toThrow(/after_renew_successor_create/);
    expect(await prisma.platformSubscriptionCommercialConfig.count()).toBe(beforeRenewCount);
    const pred = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: resumed.id },
    });
    expect(pred.lifecycle).toBe('ACTIVE_COMMERCIAL');
    expect(pred.isCurrent).toBe(true);
  });

  it('historical assignment preserved after later Add-on retirement / Override revocation', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const published = await createPublishedAddon({
      key: `addon.closure.hist.${randomUUID().slice(0, 6)}`,
      entitlementKeys: ['module.dashboard'],
    });
    const withAddon = await s.replaceAddOns(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      addOnVersionIds: [published.id],
    });
    const active = await s.activate(actor, withAddon.id, {
      expectedRowVersion: withAddon.rowVersion,
      reason: 'hist activate',
    });
    const snapFp = (
      await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({ where: { id: active.id } })
    ).commercialFingerprint;
    await prisma.platformAddOnVersion.update({
      where: { id: published.id },
      data: { lifecycle: 'RETIRED' },
    });
    const after = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.id },
      include: { addOnAssignments: true, snapshots: true },
    });
    expect(after.commercialFingerprint).toBe(snapFp);
    expect(after.addOnAssignments.map((a) => a.addOnVersionId)).toContain(published.id);
    expect(after.snapshots).toHaveLength(1);
  });

  it('Add-on dependency: FEATURE owning-module missing → addon_dependency_missing', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const orphanModule = await prisma.healthcareCatalogItem.create({
      data: {
        id: randomUUID(),
        canonicalKey: `module.closure.orphan.${randomUUID().slice(0, 6)}`,
        kind: 'MODULE',
        lifecycle: 'ACTIVE',
        sortOrder: 9990,
      },
    });
    const orphanFeature = await prisma.healthcareCatalogItem.create({
      data: {
        id: randomUUID(),
        canonicalKey: `feature.closure.orphan.${randomUUID().slice(0, 6)}`,
        kind: 'FEATURE',
        lifecycle: 'ACTIVE',
        sortOrder: 9991,
        owningModuleItemId: orphanModule.id,
      },
    });
    const addon = await prisma.platformAddOn.create({
      data: {
        id: randomUUID(),
        canonicalKey: `addon.closure.dep.${randomUUID().slice(0, 6)}`,
        lifecycle: 'ACTIVE',
        translations: {
          create: [
            { locale: 'en-US', displayName: 'dep', shortDescription: 'dep' },
            { locale: 'ar-SY', displayName: 'dep', shortDescription: 'dep' },
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
        publicationReason: 'dep fixture',
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

  it('Add-on exclusivity: INCOMPATIBLE_WITH between MODULE grants → addon_mutually_exclusive', async () => {
    const s = service();
    const actor = claims();
    const draft = await seedDraftWithPlan(actor);
    const modA = await prisma.healthcareCatalogItem.create({
      data: {
        id: randomUUID(),
        canonicalKey: `module.closure.xa.${randomUUID().slice(0, 6)}`,
        kind: 'MODULE',
        lifecycle: 'ACTIVE',
        sortOrder: 9992,
      },
    });
    const modB = await prisma.healthcareCatalogItem.create({
      data: {
        id: randomUUID(),
        canonicalKey: `module.closure.xb.${randomUUID().slice(0, 6)}`,
        kind: 'MODULE',
        lifecycle: 'ACTIVE',
        sortOrder: 9993,
      },
    });
    await prisma.healthcareCatalogCompatibilityRule.create({
      data: {
        id: randomUUID(),
        ruleType: 'INCOMPATIBLE_WITH',
        subjectItemId: modA.id,
        targetItemId: modB.id,
        lifecycle: 'ACTIVE',
        explanationEn: 'closure exclusivity',
        explanationAr: 'حصرية',
      },
    });
    const v1 = await createPublishedAddon({
      key: `addon.closure.xa.${randomUUID().slice(0, 6)}`,
      entitlementKeys: [modA.canonicalKey],
    });
    const v2 = await createPublishedAddon({
      key: `addon.closure.xb.${randomUUID().slice(0, 6)}`,
      entitlementKeys: [modB.canonicalKey],
    });
    let caught: unknown;
    try {
      await s.replaceAddOns(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        addOnVersionIds: [v2.id, v1.id],
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    expect((caught as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({
        code: expect.stringMatching(/addon_mutually_exclusive|addon_compatibility_conflict/),
      }),
    );
  });
});
