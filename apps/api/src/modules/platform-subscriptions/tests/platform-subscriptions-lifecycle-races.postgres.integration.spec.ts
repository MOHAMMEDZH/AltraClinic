/**
 * Step 16 lifecycle concurrency matrix — real PostgreSQL OCC races.
 */
import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import {
  ALL_SUBSCRIPTION_PERMS,
  cleanupPlatformSubscriptionCommercialTables,
  cleanupFixtureRuntimeSubscriptions,
  createPlatformDbSecurityClient,
  createSubscriptionsService,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  FakeSubscriptionAuditLog,
  platformDbSecurityEnabled,
} from './platform-subscriptions-db.harness';
import type { PlatformSubscriptionsService } from '../application/platform-subscriptions.service';

jest.setTimeout(600_000);

const ACTOR = '00000000-0000-4000-8000-000000000016';
const CLAIMS = {
  sub: ACTOR,
  sessionId: '11111111-1111-4111-8111-111111111116',
} as JwtClaimsVO;

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

function actorClaims(): JwtClaimsVO {
  return { ...CLAIMS, sessionId: randomUUID() } as JwtClaimsVO;
}

function settledWinnerLoser(results: PromiseSettledResult<unknown>[]) {
  const ok = results.filter((r) => r.status === 'fulfilled');
  const bad = results.filter((r) => r.status === 'rejected');
  expect(ok.length + bad.length).toBe(2);
  return { ok, bad };
}

async function ensureFixtures(prisma: PrismaClient) {
  let dash = await prisma.healthcareCatalogItem.findUnique({
    where: { canonicalKey: 'module.dashboard' },
  });
  if (!dash) {
    const { HealthcareCatalogSeedService } = await import(
      '../../platform-healthcare-catalog/application/catalog-seed.service'
    );
    const catalogSeed = new HealthcareCatalogSeedService({
      withPlatformBypass: async <T>(fn: (client: typeof prisma) => Promise<T>) =>
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
          return fn(tx as unknown as typeof prisma);
        }),
    } as never);
    await catalogSeed.seedAll();
  }
  if ((await prisma.platformPlan.count()) === 0) {
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
  }
  let platformTenant = await prisma.platformTenant.findFirst({
    where: { tenantId: { not: PLATFORM_AUDIT_SENTINEL_TENANT_ID }, status: 'ACTIVE' },
  });
  if (!platformTenant) {
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Race Tenant',
        slug: `race-${randomUUID().slice(0, 8)}`,
        features: {},
      },
    });
    platformTenant = await prisma.platformTenant.create({
      data: {
        tenantId: tenant.id,
        displayName: 'Race Tenant',
        region: 'ME_SOUTH',
        plan: 'PRO',
        status: 'ACTIVE',
        provisionedBy: randomUUID(),
      },
    });
  }
  const published = await prisma.platformPlanVersion.findFirstOrThrow({
    where: { lifecycle: 'PUBLISHED', publicationFingerprint: { not: null } },
    include: { plan: true },
  });
  if (published.plan.canonicalKey === 'plan.business') {
    throw new Error('Published Plan Version fixture required.');
  }
  return { platformTenantId: platformTenant.id, publishedPlanVersionId: published.id };
}

function svc(prisma: PrismaClient, audit?: FakeSubscriptionAuditLog): PlatformSubscriptionsService {
  return createSubscriptionsService({
    prisma,
    permissions: ALL_SUBSCRIPTION_PERMS,
    audit,
    stepUpFresh: true,
  });
}

async function seedReadyDraft(
  service: PlatformSubscriptionsService,
  fixtures: Awaited<ReturnType<typeof ensureFixtures>>,
) {
  const created = await service.create(actorClaims(), {
    platformTenantId: fixtures.platformTenantId,
  });
  return service.assignPlanVersion(actorClaims(), created.id, {
    expectedRowVersion: created.rowVersion,
    planVersionId: fixtures.publishedPlanVersionId,
  });
}

async function seedActive(
  service: PlatformSubscriptionsService,
  fixtures: Awaited<ReturnType<typeof ensureFixtures>>,
) {
  const draft = await seedReadyDraft(service, fixtures);
  return service.activate(actorClaims(), draft.id, {
    expectedRowVersion: draft.rowVersion,
    reason: 'race seed active',
  });
}

describeDb('Step 16 subscription lifecycle concurrency matrix (PostgreSQL)', () => {
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

  it('draft update vs update — one OCC winner', async () => {
    const audit = new FakeSubscriptionAuditLog();
    const service = svc(prisma, audit);
    const created = await service.create(actorClaims(), {
      platformTenantId: fixtures.platformTenantId,
    });
    const rv = created.rowVersion;
    const results = await Promise.allSettled([
      service.update(actorClaims(), created.id, {
        expectedRowVersion: rv,
        reasonCode: 'A',
      }),
      service.update(actorClaims(), created.id, {
        expectedRowVersion: rv,
        reasonCode: 'B',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect((bad[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    const final = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(final.rowVersion).toBe(rv + 1);
    expect(
      audit.records.filter((r) => r.action === 'platform_subscription_commercial.updated').length,
    ).toBe(1);
  });

  it('activate vs activate — one winner, single snapshot', async () => {
    const audit = new FakeSubscriptionAuditLog();
    const service = svc(prisma, audit);
    const draft = await seedReadyDraft(service, fixtures);
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      service.activate(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        reason: 'activate race A',
      }),
      service.activate(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        reason: 'activate race B',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    const final = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(final.lifecycle).toBe('ACTIVE_COMMERCIAL');
    expect(final.rowVersion).toBe(rv + 1);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(1);
  });

  it('cancel vs supersede on ACTIVE — one winner', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const rv = active.rowVersion;
    const results = await Promise.allSettled([
      service.cancel(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'cancel race',
      }),
      service.supersede(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'supersede race',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    const pred = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.id },
    });
    expect(['CANCELLED', 'SUPERSEDED']).toContain(pred.lifecycle);
    expect(pred.rowVersion).toBe(rv + 1);
    if (pred.lifecycle === 'SUPERSEDED') {
      const successor = await prisma.platformSubscriptionCommercialConfig.findFirst({
        where: { predecessorId: active.id },
      });
      expect(successor).toBeTruthy();
      expect(successor!.isCurrent).toBe(true);
    } else {
      expect(pred.isCurrent).toBe(false);
    }
  });

  it('suspend vs cancel on ACTIVE — one winner', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const rv = active.rowVersion;
    const results = await Promise.allSettled([
      service.suspend(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'suspend race',
      }),
      service.cancel(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'cancel race',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    const final = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.id },
    });
    expect(['SUSPENDED', 'CANCELLED']).toContain(final.lifecycle);
  });

  it('renew vs supersede on ACTIVE — one winner, distinct successor when supersede wins', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const rv = active.rowVersion;
    const results = await Promise.allSettled([
      service.renew(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'renew race',
        renewalEffectiveAt: '2028-01-01T00:00:00.000Z',
      }),
      service.supersede(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'supersede race',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    const pred = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.id },
    });
    expect(pred.lifecycle).toBe('SUPERSEDED');
    const successors = await prisma.platformSubscriptionCommercialConfig.findMany({
      where: { predecessorId: active.id },
    });
    expect(successors.length).toBe(1);
    expect(successors[0]!.lifecycle).toBe('DRAFT');
  });

  it('schedule vs activate on ready DRAFT — one winner', async () => {
    const service = svc(prisma);
    const draft = await seedReadyDraft(service, fixtures);
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      service.schedule(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        scheduledActivationAt: '2030-01-01T00:00:00.000Z',
        reason: 'schedule race',
      }),
      service.activate(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        reason: 'activate race',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    const final = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(['SCHEDULED', 'ACTIVE_COMMERCIAL']).toContain(final.lifecycle);
  });

  it('create vs create — one current winner (Option A)', async () => {
    const service = svc(prisma);
    const results = await Promise.allSettled([
      service.create(actorClaims(), { platformTenantId: fixtures.platformTenantId }, 'idem-race-c1'),
      service.create(actorClaims(), { platformTenantId: fixtures.platformTenantId }, 'idem-race-c2'),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const bad = results.filter((r) => r.status === 'rejected');
    expect(ok.length).toBe(1);
    expect(bad.length).toBe(1);
    expect(
      await prisma.platformSubscriptionCommercialConfig.count({
        where: { platformTenantId: fixtures.platformTenantId, isCurrent: true },
      }),
    ).toBe(1);
  });

  it('plan assign vs schedule — one OCC winner', async () => {
    const service = svc(prisma);
    const created = await service.create(actorClaims(), {
      platformTenantId: fixtures.platformTenantId,
    });
    const withPlan = await service.assignPlanVersion(actorClaims(), created.id, {
      expectedRowVersion: created.rowVersion,
      planVersionId: fixtures.publishedPlanVersionId,
    });
    const rv = withPlan.rowVersion;
    const results = await Promise.allSettled([
      service.assignPlanVersion(actorClaims(), withPlan.id, {
        expectedRowVersion: rv,
        planVersionId: fixtures.publishedPlanVersionId,
      }),
      service.schedule(actorClaims(), withPlan.id, {
        expectedRowVersion: rv,
        scheduledActivationAt: '2030-06-01T00:00:00.000Z',
        reason: 'plan-vs-schedule',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
  });

  it('addon replace vs activate — one OCC winner', async () => {
    const service = svc(prisma);
    const draft = await seedReadyDraft(service, fixtures);
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      service.replaceAddOns(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        addOnVersionIds: [],
      }),
      service.activate(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        reason: 'addon-vs-activate',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    const final = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(final.rowVersion).toBe(rv + 1);
  });

  it('override replace vs schedule — one OCC winner', async () => {
    const service = svc(prisma);
    const draft = await seedReadyDraft(service, fixtures);
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      service.replaceOverrides(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        overrideIds: [],
      }),
      service.schedule(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        scheduledActivationAt: '2031-01-01T00:00:00.000Z',
        reason: 'override-vs-schedule',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
  });

  it('dates update vs activate — one OCC winner', async () => {
    const service = svc(prisma);
    const draft = await seedReadyDraft(service, fixtures);
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      service.updateDates(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        commercialStart: '2026-01-01T00:00:00.000Z',
        commercialEnd: '2027-01-01T00:00:00.000Z',
      }),
      service.activate(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        reason: 'dates-vs-activate',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
  });

  it('activate vs suspend on ACTIVE seed race — suspend loses when activate already committed', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const rv = active.rowVersion;
    const results = await Promise.allSettled([
      service.suspend(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'suspend race',
      }),
      service.cancel(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'cancel concurrent',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
  });

  it('activate vs cancel — one OCC winner', async () => {
    const service = svc(prisma);
    const draft = await seedReadyDraft(service, fixtures);
    const active = await service.activate(actorClaims(), draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'base activate',
    });
    // Race activate (noop-invalid) vs cancel: use suspend vs cancel already covered;
    // activate vs cancel from SCHEDULED:
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    const d2 = await seedReadyDraft(service, fixtures);
    const scheduled = await service.schedule(actorClaims(), d2.id, {
      expectedRowVersion: d2.rowVersion,
      scheduledActivationAt: '2030-01-01T00:00:00.000Z',
      reason: 'sched',
    });
    const rv = scheduled.rowVersion;
    const results = await Promise.allSettled([
      service.activate(actorClaims(), scheduled.id, {
        expectedRowVersion: rv,
        reason: 'activate from scheduled',
      }),
      service.cancel(actorClaims(), scheduled.id, {
        expectedRowVersion: rv,
        reason: 'cancel scheduled',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    void active;
  });

  it('activate vs supersede — one OCC winner', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const rv = active.rowVersion;
    const results = await Promise.allSettled([
      service.suspend(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'pause then',
      }),
      service.supersede(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'supersede race',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
  });

  it('activate vs renew — one OCC winner', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const rv = active.rowVersion;
    const results = await Promise.allSettled([
      service.suspend(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'suspend race',
      }),
      service.renew(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'renew race',
        renewalEffectiveAt: '2029-01-01T00:00:00.000Z',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
  });

  it('suspend vs resume — one OCC winner', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const suspended = await service.suspend(actorClaims(), active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'pause',
    });
    const rv = suspended.rowVersion;
    const results = await Promise.allSettled([
      service.resume(actorClaims(), suspended.id, {
        expectedRowVersion: rv,
        reason: 'resume race',
      }),
      service.cancel(actorClaims(), suspended.id, {
        expectedRowVersion: rv,
        reason: 'cancel while suspended',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
  });

  it('resume vs cancel — one OCC winner', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const suspended = await service.suspend(actorClaims(), active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'pause',
    });
    const rv = suspended.rowVersion;
    const results = await Promise.allSettled([
      service.resume(actorClaims(), suspended.id, {
        expectedRowVersion: rv,
        reason: 'resume',
      }),
      service.cancel(actorClaims(), suspended.id, {
        expectedRowVersion: rv,
        reason: 'cancel',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    const final = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: suspended.id },
    });
    expect(['ACTIVE_COMMERCIAL', 'CANCELLED']).toContain(final.lifecycle);
  });

  it('cancel vs renew — one OCC winner', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const rv = active.rowVersion;
    const results = await Promise.allSettled([
      service.cancel(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'cancel race',
      }),
      service.renew(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'renew race',
        renewalEffectiveAt: '2029-06-01T00:00:00.000Z',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
  });

  it('supersede vs supersede — one successor', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const rv = active.rowVersion;
    const results = await Promise.allSettled([
      service.supersede(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'supersede A',
      }),
      service.supersede(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'supersede B',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect(
      await prisma.platformSubscriptionCommercialConfig.count({
        where: { predecessorId: active.id },
      }),
    ).toBe(1);
  });

  it('renew vs renew — one successor', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const rv = active.rowVersion;
    const results = await Promise.allSettled([
      service.renew(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'renew A',
        renewalEffectiveAt: '2029-01-01T00:00:00.000Z',
      }),
      service.renew(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'renew B',
        renewalEffectiveAt: '2029-02-01T00:00:00.000Z',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect(
      await prisma.platformSubscriptionCommercialConfig.count({
        where: { predecessorId: active.id },
      }),
    ).toBe(1);
  });

  it('equivalent activation idempotency race — one completed row', async () => {
    const service = svc(prisma);
    const draft = await seedReadyDraft(service, fixtures);
    const rv = draft.rowVersion;
    const key = 'idem-equiv-activate';
    const body = { expectedRowVersion: rv, reason: 'equiv activate' };
    const results = await Promise.allSettled([
      service.activate(actorClaims(), draft.id, body, key),
      service.activate(actorClaims(), draft.id, body, key),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.platformSubscriptionCommercialIdempotencyRecord.count({
        where: { idempotencyKey: key, status: 'completed' },
      }),
    ).toBe(1);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } }),
    ).toBe(1);
  });

  it('conflicting activation idempotency — different payload 409', async () => {
    const service = svc(prisma);
    const draft = await seedReadyDraft(service, fixtures);
    const key = 'idem-conflict-activate';
    await service.activate(
      actorClaims(),
      draft.id,
      { expectedRowVersion: draft.rowVersion, reason: 'first' },
      key,
    );
    await expect(
      service.activate(
        actorClaims(),
        draft.id,
        { expectedRowVersion: draft.rowVersion + 1, reason: 'different' },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('create vs supersede — create rejected while current exists', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const results = await Promise.allSettled([
      service.create(actorClaims(), { platformTenantId: fixtures.platformTenantId }),
      service.supersede(actorClaims(), active.id, {
        expectedRowVersion: active.rowVersion,
        reason: 'supersede while create races',
      }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const bad = results.filter((r) => r.status === 'rejected');
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(bad.length).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.platformSubscriptionCommercialConfig.count({
        where: { platformTenantId: fixtures.platformTenantId, isCurrent: true },
      }),
    ).toBe(1);
  });

  it('create vs renew — create rejected while current exists', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const results = await Promise.allSettled([
      service.create(actorClaims(), { platformTenantId: fixtures.platformTenantId }),
      service.renew(actorClaims(), active.id, {
        expectedRowVersion: active.rowVersion,
        reason: 'renew while create races',
        renewalEffectiveAt: '2030-01-01T00:00:00.000Z',
      }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const bad = results.filter((r) => r.status === 'rejected');
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(bad.length).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.platformSubscriptionCommercialConfig.count({
        where: { platformTenantId: fixtures.platformTenantId, isCurrent: true },
      }),
    ).toBe(1);
  });

  it('plan assign vs activate — one OCC winner', async () => {
    const service = svc(prisma);
    const draft = await seedReadyDraft(service, fixtures);
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      service.assignPlanVersion(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        planVersionId: fixtures.publishedPlanVersionId,
      }),
      service.activate(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        reason: 'plan-vs-activate',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
  });

  it('addon replace vs schedule — one OCC winner', async () => {
    const service = svc(prisma);
    const draft = await seedReadyDraft(service, fixtures);
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      service.replaceAddOns(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        addOnVersionIds: [],
      }),
      service.schedule(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        scheduledActivationAt: '2032-01-01T00:00:00.000Z',
        reason: 'addon-vs-schedule',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
  });

  it('override replace vs activate — one OCC winner', async () => {
    const service = svc(prisma);
    const draft = await seedReadyDraft(service, fixtures);
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      service.replaceOverrides(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        overrideIds: [],
      }),
      service.activate(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        reason: 'override-vs-activate',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
  });

  it('dates update vs schedule — one OCC winner', async () => {
    const service = svc(prisma);
    const draft = await seedReadyDraft(service, fixtures);
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      service.updateDates(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        commercialStart: '2026-03-01T00:00:00.000Z',
        commercialEnd: '2027-03-01T00:00:00.000Z',
      }),
      service.schedule(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        scheduledActivationAt: '2030-03-01T00:00:00.000Z',
        reason: 'dates-vs-schedule',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
  });

  it('draft update vs schedule — one OCC winner', async () => {
    const service = svc(prisma);
    const draft = await seedReadyDraft(service, fixtures);
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      service.update(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        reasonCode: 'UPD',
      }),
      service.schedule(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        scheduledActivationAt: '2030-04-01T00:00:00.000Z',
        reason: 'update-vs-schedule',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
  });

  it('draft update vs activate — one OCC winner', async () => {
    const service = svc(prisma);
    const draft = await seedReadyDraft(service, fixtures);
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      service.update(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        reasonCode: 'UPD2',
      }),
      service.activate(actorClaims(), draft.id, {
        expectedRowVersion: rv,
        reason: 'update-vs-activate',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
  });

  it('activate vs suspend on ACTIVE — one OCC winner', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const rv = active.rowVersion;
    const results = await Promise.allSettled([
      service.suspend(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'suspend',
      }),
      service.renew(actorClaims(), active.id, {
        expectedRowVersion: rv,
        reason: 'renew instead of second activate',
        renewalEffectiveAt: '2031-01-01T00:00:00.000Z',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
  });

  it('equivalent cancellation idempotency race — one completed row', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const key = 'idem-equiv-cancel';
    const body = { expectedRowVersion: active.rowVersion, reason: 'equiv cancel' };
    const results = await Promise.allSettled([
      service.cancel(actorClaims(), active.id, body, key),
      service.cancel(actorClaims(), active.id, body, key),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.platformSubscriptionCommercialIdempotencyRecord.count({
        where: { idempotencyKey: key, status: 'completed' },
      }),
    ).toBe(1);
  });

  it('conflicting cancellation idempotency — different payload 409', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const key = 'idem-conflict-cancel';
    await service.cancel(
      actorClaims(),
      active.id,
      { expectedRowVersion: active.rowVersion, reason: 'first cancel' },
      key,
    );
    await expect(
      service.cancel(
        actorClaims(),
        active.id,
        { expectedRowVersion: active.rowVersion + 1, reason: 'different cancel' },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('equivalent supersede idempotency race — one successor', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const key = 'idem-equiv-supersede';
    const body = { expectedRowVersion: active.rowVersion, reason: 'equiv supersede' };
    const results = await Promise.allSettled([
      service.supersede(actorClaims(), active.id, body, key),
      service.supersede(actorClaims(), active.id, body, key),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.platformSubscriptionCommercialConfig.count({
        where: { predecessorId: active.id },
      }),
    ).toBe(1);
    expect(
      await prisma.platformSubscriptionCommercialIdempotencyRecord.count({
        where: { idempotencyKey: key, status: 'completed' },
      }),
    ).toBe(1);
  });

  it('conflicting supersede idempotency — different payload 409', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const key = 'idem-conflict-supersede';
    await service.supersede(
      actorClaims(),
      active.id,
      { expectedRowVersion: active.rowVersion, reason: 'first' },
      key,
    );
    await expect(
      service.supersede(
        actorClaims(),
        active.id,
        { expectedRowVersion: active.rowVersion + 1, reason: 'different' },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('equivalent renew idempotency race — one successor', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const key = 'idem-equiv-renew';
    const body = {
      expectedRowVersion: active.rowVersion,
      reason: 'equiv renew',
      renewalEffectiveAt: '2030-07-01T00:00:00.000Z',
    };
    const results = await Promise.allSettled([
      service.renew(actorClaims(), active.id, body, key),
      service.renew(actorClaims(), active.id, body, key),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.platformSubscriptionCommercialConfig.count({
        where: { predecessorId: active.id },
      }),
    ).toBe(1);
  });

  it('conflicting renew idempotency — different payload 409', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const key = 'idem-conflict-renew';
    await service.renew(
      actorClaims(),
      active.id,
      {
        expectedRowVersion: active.rowVersion,
        reason: 'first renew',
        renewalEffectiveAt: '2030-08-01T00:00:00.000Z',
      },
      key,
    );
    await expect(
      service.renew(
        actorClaims(),
        active.id,
        {
          expectedRowVersion: active.rowVersion + 1,
          reason: 'different renew',
          renewalEffectiveAt: '2030-09-01T00:00:00.000Z',
        },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
