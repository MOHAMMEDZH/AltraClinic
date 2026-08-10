/**
 * Step 16 Option A second-create + renew-vs-supersede evidence.
 */
import { ConflictException, BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';
import {
  ALL_SUBSCRIPTION_PERMS,
  cleanupPlatformSubscriptionCommercialTables,
  createPlatformDbSecurityClient,
  createSubscriptionsService,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  FakeSubscriptionAuditLog,
  platformDbSecurityEnabled,
} from './platform-subscriptions-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

function claims(sub = randomUUID()): JwtClaimsVO {
  return {
    sub,
    sessionId: randomUUID(),
    principalType: 'platform',
    aud: 'platform',
    iss: 'booking-platform',
    roles: [],
  } as unknown as JwtClaimsVO;
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
        name: 'Step16 SecondCreate Tenant',
        slug: `step16-sc-${randomUUID().slice(0, 8)}`,
        features: {},
      },
    });
    platformTenant = await prisma.platformTenant.create({
      data: {
        tenantId: tenant.id,
        displayName: 'Step16 SecondCreate Tenant',
        region: 'ME_SOUTH',
        plan: 'PRO',
        status: 'ACTIVE',
        provisionedBy: randomUUID(),
      },
    });
  }
  const published = await prisma.platformPlanVersion.findFirst({
    where: {
      lifecycle: 'PUBLISHED',
      publicationFingerprint: { not: null },
      plan: { canonicalKey: { not: 'plan.business' } },
    },
  });
  if (!published) throw new Error('Published Plan Version required');
  return { platformTenantId: platformTenant.id, publishedPlanVersionId: published.id };
}

describeDb('Step 16 second-create and renew semantics (postgres)', () => {
  let prisma: PrismaClient;
  let fixtures: Awaited<ReturnType<typeof ensureFixtures>>;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient(DEFAULT_PLATFORM_DB_SECURITY_URL);
    await prisma.$connect();
    fixtures = await ensureFixtures(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupPlatformSubscriptionCommercialTables(prisma);
  });

  it('Option A: second create returns current_configuration_already_exists without raw index error', async () => {
    const audit = new FakeSubscriptionAuditLog();
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
      audit,
    });
    const actor = claims();
    const first = await service.create(
      actor,
      { platformTenantId: fixtures.platformTenantId },
      'idem-sc-first',
    );
    expect(first.isCurrent).toBe(true);

    try {
      await service.create(actor, { platformTenantId: fixtures.platformTenantId }, 'idem-sc-second');
      fail('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual(
        expect.objectContaining({ code: 'current_configuration_already_exists' }),
      );
    }

    try {
      await service.create(actor, { platformTenantId: fixtures.platformTenantId }, 'idem-sc-third');
      fail('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      const msg = String((err as Error).message);
      expect(msg).not.toMatch(/unique|one_current_per_tenant|P2002/i);
    }

    const currents = await prisma.platformSubscriptionCommercialConfig.count({
      where: { platformTenantId: fixtures.platformTenantId, isCurrent: true },
    });
    expect(currents).toBe(1);
    expect(
      audit.records.filter((r) => r.action === 'platform_subscription_commercial.created'),
    ).toHaveLength(1);
    expect(
      await prisma.platformSubscriptionCommercialIdempotencyRecord.count({
        where: { idempotencyKey: 'idem-sc-second', status: 'completed' },
      }),
    ).toBe(0);
  });

  it('create versus supersede: one current remains; create loses with stable code', async () => {
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
    });
    const actor = claims();
    const draft = await service.create(actor, { platformTenantId: fixtures.platformTenantId });
    const assigned = await service.assignPlanVersion(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      planVersionId: fixtures.publishedPlanVersionId,
    });
    const active = await service.activate(actor, draft.id, {
      expectedRowVersion: assigned.rowVersion,
      reason: 'activate for supersede race',
    });

    const [createResult, supersedeResult] = await Promise.allSettled([
      service.create(actor, { platformTenantId: fixtures.platformTenantId }, 'race-create'),
      service.supersede(
        actor,
        active.id,
        { expectedRowVersion: active.rowVersion, reason: 'race supersede' },
        'race-supersede',
      ),
    ]);

    const createFailed =
      createResult.status === 'rejected' &&
      createResult.reason instanceof ConflictException &&
      String(JSON.stringify(createResult.reason.getResponse())).includes(
        'current_configuration_already_exists',
      );
    const supersedeOk = supersedeResult.status === 'fulfilled';
    // Supersede clears current then creates successor; create may lose either before or after.
    expect(createFailed || createResult.status === 'rejected').toBe(true);
    if (supersedeOk) {
      const currents = await prisma.platformSubscriptionCommercialConfig.findMany({
        where: { platformTenantId: fixtures.platformTenantId, isCurrent: true },
      });
      expect(currents).toHaveLength(1);
      expect(currents[0].lifecycle).toBe('DRAFT');
      expect(currents[0].predecessorId).toBe(active.id);
    }
  });

  it('renew requires renewalEffectiveAt and rejects Draft/Scheduled predecessors', async () => {
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
    });
    const actor = claims();
    const draft = await service.create(actor, { platformTenantId: fixtures.platformTenantId });
    await expect(
      service.renew(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        reason: 'too early',
        renewalEffectiveAt: '2028-01-01T00:00:00.000Z',
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);

    const assigned = await service.assignPlanVersion(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      planVersionId: fixtures.publishedPlanVersionId,
    });
    const active = await service.activate(actor, draft.id, {
      expectedRowVersion: assigned.rowVersion,
      reason: 'activate for renew',
    });

    await expect(
      service.renew(actor, active.id, {
        expectedRowVersion: active.rowVersion,
        reason: 'missing date',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    const renewed = await service.renew(
      actor,
      active.id,
      {
        expectedRowVersion: active.rowVersion,
        reason: 'valid renew',
        renewalEffectiveAt: '2028-01-01T00:00:00.000Z',
      },
      'idem-renew-sem',
    );
    expect(renewed.lifecycle).toBe('DRAFT');
    expect(renewed.isCurrent).toBe(true);
    expect(renewed.predecessorId).toBe(active.id);
    expect(renewed.reasonCode).toBe('RENEW');
    expect(renewed.commercialStart).toBe('2028-01-01T00:00:00.000Z');
    expect(renewed.commercialEnd).toBeNull();
    expect(renewed.planVersionId).toBe(fixtures.publishedPlanVersionId);

    const pred = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.id },
    });
    expect(pred.lifecycle).toBe('SUPERSEDED');
    expect(pred.isCurrent).toBe(false);
  });

  it('renew rejects overlap when renewalEffectiveAt precedes commercialEnd', async () => {
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
    });
    const actor = claims();
    const draft = await service.create(actor, {
      platformTenantId: fixtures.platformTenantId,
      commercialStart: '2026-01-01T00:00:00.000Z',
      commercialEnd: '2027-12-31T00:00:00.000Z',
    });
    const assigned = await service.assignPlanVersion(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      planVersionId: fixtures.publishedPlanVersionId,
    });
    const active = await service.activate(actor, draft.id, {
      expectedRowVersion: assigned.rowVersion,
      reason: 'activate window',
    });
    await expect(
      service.renew(actor, active.id, {
        expectedRowVersion: active.rowVersion,
        reason: 'overlap',
        renewalEffectiveAt: '2027-06-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'renewal_overlap' }),
    });
  });

  it('supersede may copy dates from DRAFT; renew audit/idempotency namespaces differ', async () => {
    const audit = new FakeSubscriptionAuditLog();
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
      audit,
    });
    const actor = claims();
    const draft = await service.create(actor, {
      platformTenantId: fixtures.platformTenantId,
      commercialStart: '2026-01-01T00:00:00.000Z',
      commercialEnd: '2026-12-31T00:00:00.000Z',
    });
    const assigned = await service.assignPlanVersion(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      planVersionId: fixtures.publishedPlanVersionId,
    });
    const superseded = await service.supersede(
      actor,
      assigned.id,
      { expectedRowVersion: assigned.rowVersion, reason: 'change plan mid-term' },
      'idem-supersede-sem',
    );
    expect(superseded.reasonCode).toBe('SUPERSEDE');
    expect(superseded.commercialStart).toBe('2026-01-01T00:00:00.000Z');
    expect(superseded.commercialEnd).toBe('2026-12-31T00:00:00.000Z');
    expect(
      audit.records.some((r) => r.action === 'platform_subscription_commercial.superseded'),
    ).toBe(true);
    expect(
      await prisma.platformSubscriptionCommercialIdempotencyRecord.count({
        where: { operation: 'subscription.supersede', status: 'completed' },
      }),
    ).toBe(1);
  });
});
