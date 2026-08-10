/**
 * Step 16 PostgreSQL smoke + core commercial assignment gate.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupPlatformSubscriptionCommercialTables,
  cleanupFixtureRuntimeSubscriptions,
  createPlatformDbSecurityClient,
  createSubscriptionsService,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  ALL_SUBSCRIPTION_PERMS,
  platformDbSecurityEnabled,
} from './platform-subscriptions-db.harness';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

function claims(sub: string): JwtClaimsVO {
  return {
    sub,
    sessionId: randomUUID(),
    principalType: 'platform',
    aud: 'platform',
    iss: 'booking-platform',
    roles: [],
  } as unknown as JwtClaimsVO;
}

async function ensureCatalogPlansAndTenant(prisma: PrismaClient): Promise<{
  platformTenantId: string;
  publishedPlanVersionId: string;
  draftPlanVersionId: string;
}> {
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
        name: 'Step16 Fixture Tenant',
        slug: `step16-fixture-${randomUUID().slice(0, 8)}`,
        features: {},
      },
    });
    platformTenant = await prisma.platformTenant.create({
      data: {
        tenantId: tenant.id,
        displayName: 'Step16 Fixture Tenant',
        region: 'ME_SOUTH',
        plan: 'PRO',
        status: 'ACTIVE',
        provisionedBy: randomUUID(),
      },
    });
  }

  const published = await prisma.platformPlanVersion.findFirst({
    where: { lifecycle: 'PUBLISHED', publicationFingerprint: { not: null } },
    include: { plan: true },
  });
  if (!published || published.plan.canonicalKey === 'plan.business') {
    throw new Error('Published Plan Version fixture required.');
  }

  let draft = await prisma.platformPlanVersion.findFirst({ where: { lifecycle: 'DRAFT' } });
  if (!draft) {
    draft = await prisma.platformPlanVersion.create({
      data: {
        planId: published.planId,
        versionNumber: 999,
        lifecycle: 'DRAFT',
      },
    });
  }

  return {
    platformTenantId: platformTenant.id,
    publishedPlanVersionId: published.id,
    draftPlanVersionId: draft.id,
  };
}

describeDb('Step 16 subscription commercial postgres gate', () => {
  let prisma: PrismaClient;
  let service: ReturnType<typeof createSubscriptionsService>;
  let fixtures: Awaited<ReturnType<typeof ensureCatalogPlansAndTenant>>;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    await prisma.$connect();
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    fixtures = await ensureCatalogPlansAndTenant(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
    });
  });

  it('creates draft, assigns published plan version, activates with snapshot, no runtime plan mutation', async () => {
    const actor = claims(randomUUID());
    const tenant = await prisma.platformTenant.findUniqueOrThrow({
      where: { id: fixtures.platformTenantId },
    });
    const planBefore = tenant.plan;

    const created = await service.create(
      actor,
      { platformTenantId: fixtures.platformTenantId },
      'idem-sub-create-1',
    );
    expect(created.lifecycle).toBe('DRAFT');
    expect(created.runtimeEffective).toBe(false);
    expect(created.isCurrent).toBe(true);

    const replay = await service.create(
      actor,
      { platformTenantId: fixtures.platformTenantId },
      'idem-sub-create-1',
    );
    expect(replay.id).toBe(created.id);

    const assigned = await service.assignPlanVersion(
      actor,
      created.id,
      {
        expectedRowVersion: created.rowVersion,
        planVersionId: fixtures.publishedPlanVersionId,
      },
      'idem-sub-plan-1',
    );
    expect(assigned.planVersionId).toBe(fixtures.publishedPlanVersionId);

    const activated = await service.activate(
      actor,
      created.id,
      { expectedRowVersion: assigned.rowVersion, reason: 'activate commercial config' },
      'idem-sub-act-1',
    );
    expect(activated.lifecycle).toBe('ACTIVE_COMMERCIAL');
    expect(activated.commercialFingerprint).toBeTruthy();
    expect(activated.hasSnapshot).toBe(true);
    expect(activated.runtimeEffective).toBe(false);
    expect(activated.isCurrent).toBe(true);

    const snapshots = await prisma.platformSubscriptionCommercialSnapshot.count({
      where: { configId: created.id },
    });
    expect(snapshots).toBe(1);

    const tenantAfter = await prisma.platformTenant.findUniqueOrThrow({
      where: { id: fixtures.platformTenantId },
    });
    expect(tenantAfter.plan).toBe(planBefore);

    const readiness = await service.readiness(actor, created.id);
    expect(readiness.runtimeEffective).toBe(false);
  });

  it('rejects draft plan version assignment and sentinel tenant', async () => {
    const actor = claims(randomUUID());
    const created = await service.create(actor, {
      platformTenantId: fixtures.platformTenantId,
    });
    await expect(
      service.assignPlanVersion(actor, created.id, {
        expectedRowVersion: created.rowVersion,
        planVersionId: fixtures.draftPlanVersionId,
      }),
    ).rejects.toThrow(/Published/i);

    const sentinelPt = await prisma.platformTenant.findFirst({
      where: { tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
    });
    if (sentinelPt) {
      await expect(
        service.create(actor, { platformTenantId: sentinelPt.id }),
      ).rejects.toThrow(/sentinel/i);
    }
  });

  it('correlation fail-closed when multiple runtime subscriptions without explicit id', async () => {
    const actor = claims(randomUUID());
    const runtimeA = await prisma.platformSubscription.create({
      data: {
        platformTenantId: fixtures.platformTenantId,
        plan: 'PRO',
        status: 'ACTIVE',
        pricePerMonth: 49,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 86_400_000),
      },
    });
    const runtimeB = await prisma.platformSubscription.create({
      data: {
        platformTenantId: fixtures.platformTenantId,
        plan: 'LITE',
        status: 'ACTIVE',
        pricePerMonth: 29,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 86_400_000),
      },
    });

    await expect(
      service.create(actor, { platformTenantId: fixtures.platformTenantId }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'correlation_ambiguous' }),
    });

    const correlated = await service.create(actor, {
      platformTenantId: fixtures.platformTenantId,
      platformSubscriptionId: runtimeA.id,
    });
    expect(correlated.platformSubscriptionId).toBe(runtimeA.id);

    const readiness = await service.readiness(actor, correlated.id);
    expect(readiness.blockers.some((b) => b.code === 'correlation_ambiguous')).toBe(false);

    await service.cancel(actor, correlated.id, {
      expectedRowVersion: correlated.rowVersion,
      reason: 'clear for second correlation',
    });

    const correlatedB = await service.create(actor, {
      platformTenantId: fixtures.platformTenantId,
      platformSubscriptionId: runtimeB.id,
    });
    expect(correlatedB.platformSubscriptionId).toBe(runtimeB.id);
  });

  it('isCurrent: cancel clears current; supersede transfers to successor draft', async () => {
    const actor = claims(randomUUID());
    const draft = await service.create(actor, { platformTenantId: fixtures.platformTenantId });
    const assigned = await service.assignPlanVersion(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      planVersionId: fixtures.publishedPlanVersionId,
    });
    const active = await service.activate(actor, assigned.id, {
      expectedRowVersion: assigned.rowVersion,
      reason: 'isCurrent test',
    });
    expect(active.isCurrent).toBe(true);

    const cancelled = await service.cancel(actor, active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'clear current',
    });
    expect(cancelled.isCurrent).toBe(false);
    expect(cancelled.lifecycle).toBe('CANCELLED');

    await cleanupPlatformSubscriptionCommercialTables(prisma);
    const draft2 = await service.create(actor, { platformTenantId: fixtures.platformTenantId });
    const assigned2 = await service.assignPlanVersion(actor, draft2.id, {
      expectedRowVersion: draft2.rowVersion,
      planVersionId: fixtures.publishedPlanVersionId,
    });
    const active2 = await service.activate(actor, assigned2.id, {
      expectedRowVersion: assigned2.rowVersion,
      reason: 'supersede isCurrent',
    });
    const successor = await service.supersede(actor, active2.id, {
      expectedRowVersion: active2.rowVersion,
      reason: 'transfer current',
    });
    expect(successor.isCurrent).toBe(true);
    expect(successor.lifecycle).toBe('DRAFT');
    const pred = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active2.id },
    });
    expect(pred.isCurrent).toBe(false);
    expect(pred.lifecycle).toBe('SUPERSEDED');
  });

  it('renew idempotency uses subscription.renew operation distinct from supersede', async () => {
    const actor = claims(randomUUID());
    const draft = await service.create(actor, { platformTenantId: fixtures.platformTenantId });
    const assigned = await service.assignPlanVersion(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      planVersionId: fixtures.publishedPlanVersionId,
    });
    const active = await service.activate(actor, assigned.id, {
      expectedRowVersion: assigned.rowVersion,
      reason: 'renew idempotency prep',
    });

    const first = await service.renew(
      actor,
      active.id,
      { expectedRowVersion: active.rowVersion, reason: 'renew once', renewalEffectiveAt: '2028-01-01T00:00:00.000Z' },
      'idem-renew-only',
    );
    const replay = await service.renew(
      actor,
      active.id,
      { expectedRowVersion: active.rowVersion, reason: 'renew once', renewalEffectiveAt: '2028-01-01T00:00:00.000Z' },
      'idem-renew-only',
    );
    expect(replay.id).toBe(first.id);

    const renewRow = await prisma.platformSubscriptionCommercialIdempotencyRecord.findFirstOrThrow({
      where: { idempotencyKey: 'idem-renew-only', operation: 'subscription.renew' },
    });
    expect(renewRow.status).toBe('completed');
    expect(
      await prisma.platformSubscriptionCommercialIdempotencyRecord.count({
        where: { idempotencyKey: 'idem-renew-only', operation: 'subscription.supersede' },
      }),
    ).toBe(0);
    const successorRow = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(successorRow.reasonCode).toBe('RENEW');
  });
});
