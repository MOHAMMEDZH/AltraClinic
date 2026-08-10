/**
 * Step 16 final-gate PostgreSQL evidence — idempotency matrix, rate limits, renew ≠ supersede.
 */
import {
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import type { PlatformSubscriptionsService } from '../application/platform-subscriptions.service';
import type { SubscriptionIdempotencyOperation } from '../application/subscription-idempotency.service';
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

const ACTOR = '00000000-0000-4000-8000-000000000016';
const CLAIMS = {
  sub: ACTOR,
  sessionId: '11111111-1111-4111-8111-111111111116',
} as JwtClaimsVO;

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

function actorClaims(): JwtClaimsVO {
  return { ...CLAIMS, sessionId: randomUUID() } as JwtClaimsVO;
}

type Fixtures = {
  platformTenantId: string;
  publishedPlanVersionId: string;
};

async function ensureFixtures(prisma: PrismaClient): Promise<Fixtures> {
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
        name: 'Final Gate Tenant',
        slug: `final-gate-${randomUUID().slice(0, 8)}`,
        features: {},
      },
    });
    platformTenant = await prisma.platformTenant.create({
      data: {
        tenantId: tenant.id,
        displayName: 'Final Gate Tenant',
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

async function completedIdemCount(
  prisma: PrismaClient,
  key: string,
  operation?: SubscriptionIdempotencyOperation,
): Promise<number> {
  return prisma.platformSubscriptionCommercialIdempotencyRecord.count({
    where: {
      idempotencyKey: key,
      status: 'completed',
      ...(operation ? { operation } : {}),
    },
  });
}

function svc(
  prisma: PrismaClient,
  audit?: FakeSubscriptionAuditLog,
  config?: Partial<{
    mutationRateLimitPerMinute: number;
    highImpactRateLimitPerMinute: number;
    readHeavyRateLimitPerMinute: number;
  }>,
): PlatformSubscriptionsService {
  return createSubscriptionsService({
    prisma,
    permissions: ALL_SUBSCRIPTION_PERMS,
    audit,
    stepUpFresh: true,
    config,
  });
}

async function seedReadyDraft(
  service: PlatformSubscriptionsService,
  fixtures: Fixtures,
  actor = actorClaims(),
) {
  const created = await service.create(actor, { platformTenantId: fixtures.platformTenantId });
  return service.assignPlanVersion(actor, created.id, {
    expectedRowVersion: created.rowVersion,
    planVersionId: fixtures.publishedPlanVersionId,
  });
}

async function seedActive(
  service: PlatformSubscriptionsService,
  fixtures: Fixtures,
  actor = actorClaims(),
) {
  const draft = await seedReadyDraft(service, fixtures, actor);
  return service.activate(
    actor,
    draft.id,
    { expectedRowVersion: draft.rowVersion, reason: 'seed active' },
    `idem-seed-act-${draft.id.slice(0, 8)}`,
  );
}

type MatrixHarness = {
  operation: SubscriptionIdempotencyOperation;
  auditAction: string;
  execute: (service: PlatformSubscriptionsService, key: string) => Promise<{ id: string }>;
  conflict: (service: PlatformSubscriptionsService, key: string) => Promise<unknown>;
  concurrent: (
    prisma: PrismaClient,
    key: string,
    audit: FakeSubscriptionAuditLog,
    fixtures: Fixtures,
  ) => Promise<void>;
  setup: (prisma: PrismaClient, fixtures: Fixtures) => Promise<void>;
};

describeDb('Platform Subscriptions Step 16 final gate (postgres)', () => {
  let prisma: PrismaClient;
  let fixtures: Fixtures;

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

  function buildMatrix(): MatrixHarness[] {
    let configId = '';
    let rowVersion = 0;
    let activeId = '';
    let activeRv = 0;
    let suspendedId = '';
    let suspendedRv = 0;

    return [
      {
        operation: 'subscription.create',
        auditAction: 'platform_subscription_commercial.created',
        setup: async () => undefined,
        execute: async (service, key) => {
          const r = await service.create(
            actorClaims(),
            { platformTenantId: fixtures.platformTenantId },
            key,
          );
          return { id: r.id };
        },
        conflict: async (service, key) =>
          service.create(
            actorClaims(),
            { platformTenantId: randomUUID() },
            key,
          ),
        concurrent: async (p, key, audit, fx) => {
          const a = svc(p, audit);
          const b = svc(p, audit);
          const results = await Promise.allSettled([
            a.create(actorClaims(), { platformTenantId: fx.platformTenantId }, key),
            b.create(actorClaims(), { platformTenantId: fx.platformTenantId }, key),
          ]);
          const ok = results.filter((r) => r.status === 'fulfilled');
          expect(ok.length).toBeGreaterThanOrEqual(1);
        },
      },
      {
        operation: 'subscription.update',
        auditAction: 'platform_subscription_commercial.updated',
        setup: async (p) => {
          const s = svc(p);
          const c = await s.create(actorClaims(), { platformTenantId: fixtures.platformTenantId });
          configId = c.id;
          rowVersion = c.rowVersion;
        },
        execute: async (service, key) => {
          const r = await service.update(
            actorClaims(),
            configId,
            { expectedRowVersion: rowVersion, reasonCode: 'UPD' },
            key,
          );
          return { id: r.id };
        },
        conflict: async (service, key) =>
          service.update(
            actorClaims(),
            configId,
            { expectedRowVersion: rowVersion, reasonCode: 'OTHER' },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const a = svc(p, audit);
          const b = svc(p, audit);
          await Promise.allSettled([
            a.update(actorClaims(), configId, { expectedRowVersion: rowVersion, reasonCode: 'A' }, key),
            b.update(actorClaims(), configId, { expectedRowVersion: rowVersion, reasonCode: 'A' }, key),
          ]);
        },
      },
      {
        operation: 'subscription.assignPlanVersion',
        auditAction: 'platform_subscription_commercial.plan_version_assigned',
        setup: async (p) => {
          const s = svc(p);
          const c = await s.create(actorClaims(), { platformTenantId: fixtures.platformTenantId });
          configId = c.id;
          rowVersion = c.rowVersion;
        },
        execute: async (service, key) => {
          const r = await service.assignPlanVersion(
            actorClaims(),
            configId,
            { expectedRowVersion: rowVersion, planVersionId: fixtures.publishedPlanVersionId },
            key,
          );
          return { id: r.id };
        },
        conflict: async (service, key) =>
          service.assignPlanVersion(
            actorClaims(),
            configId,
            { expectedRowVersion: rowVersion + 999, planVersionId: fixtures.publishedPlanVersionId },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const a = svc(p, audit);
          const b = svc(p, audit);
          await Promise.allSettled([
            a.assignPlanVersion(
              actorClaims(),
              configId,
              { expectedRowVersion: rowVersion, planVersionId: fixtures.publishedPlanVersionId },
              key,
            ),
            b.assignPlanVersion(
              actorClaims(),
              configId,
              { expectedRowVersion: rowVersion, planVersionId: fixtures.publishedPlanVersionId },
              key,
            ),
          ]);
        },
      },
      {
        operation: 'subscription.replaceAddOns',
        auditAction: 'platform_subscription_commercial.addons_replaced',
        setup: async (p) => {
          const s = svc(p);
          const d = await seedReadyDraft(s, fixtures);
          configId = d.id;
          rowVersion = d.rowVersion;
        },
        execute: async (service, key) => {
          const r = await service.replaceAddOns(
            actorClaims(),
            configId,
            { expectedRowVersion: rowVersion, addOnVersionIds: [] },
            key,
          );
          return { id: r.id };
        },
        conflict: async (service, key) => {
          const addon = await prisma.platformAddOnVersion.findFirst({
            where: { lifecycle: 'PUBLISHED' },
          });
          return service.replaceAddOns(
            actorClaims(),
            configId,
            {
              expectedRowVersion: rowVersion,
              addOnVersionIds: addon ? [addon.id] : ['00000000-0000-4000-8000-000000009999'],
            },
            key,
          );
        },
        concurrent: async (p, key, audit) => {
          const a = svc(p, audit);
          const b = svc(p, audit);
          await Promise.allSettled([
            a.replaceAddOns(
              actorClaims(),
              configId,
              { expectedRowVersion: rowVersion, addOnVersionIds: [] },
              key,
            ),
            b.replaceAddOns(
              actorClaims(),
              configId,
              { expectedRowVersion: rowVersion, addOnVersionIds: [] },
              key,
            ),
          ]);
        },
      },
      {
        operation: 'subscription.replaceOverrides',
        auditAction: 'platform_subscription_commercial.overrides_replaced',
        setup: async (p) => {
          const s = svc(p);
          const d = await seedReadyDraft(s, fixtures);
          configId = d.id;
          rowVersion = d.rowVersion;
        },
        execute: async (service, key) => {
          const r = await service.replaceOverrides(
            actorClaims(),
            configId,
            { expectedRowVersion: rowVersion, overrideIds: [] },
            key,
          );
          return { id: r.id };
        },
        conflict: async (service, key) =>
          service.replaceOverrides(
            actorClaims(),
            configId,
            {
              expectedRowVersion: rowVersion,
              overrideIds: ['00000000-0000-4000-8000-000000009998'],
            },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const a = svc(p, audit);
          const b = svc(p, audit);
          await Promise.allSettled([
            a.replaceOverrides(
              actorClaims(),
              configId,
              { expectedRowVersion: rowVersion, overrideIds: [] },
              key,
            ),
            b.replaceOverrides(
              actorClaims(),
              configId,
              { expectedRowVersion: rowVersion, overrideIds: [] },
              key,
            ),
          ]);
        },
      },
      {
        operation: 'subscription.updateDates',
        auditAction: 'platform_subscription_commercial.dates_updated',
        setup: async (p) => {
          const s = svc(p);
          const d = await seedReadyDraft(s, fixtures);
          configId = d.id;
          rowVersion = d.rowVersion;
        },
        execute: async (service, key) => {
          const r = await service.updateDates(
            actorClaims(),
            configId,
            {
              expectedRowVersion: rowVersion,
              commercialStart: '2026-01-01T00:00:00.000Z',
              commercialEnd: '2027-01-01T00:00:00.000Z',
            },
            key,
          );
          return { id: r.id };
        },
        conflict: async (service, key) =>
          service.updateDates(
            actorClaims(),
            configId,
            {
              expectedRowVersion: rowVersion,
              commercialStart: '2028-01-01T00:00:00.000Z',
              commercialEnd: '2029-01-01T00:00:00.000Z',
            },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const a = svc(p, audit);
          const b = svc(p, audit);
          const body = {
            expectedRowVersion: rowVersion,
            commercialStart: '2026-06-01T00:00:00.000Z',
            commercialEnd: '2027-06-01T00:00:00.000Z',
          };
          await Promise.allSettled([
            a.updateDates(actorClaims(), configId, body, key),
            b.updateDates(actorClaims(), configId, body, key),
          ]);
        },
      },
      {
        operation: 'subscription.activate',
        auditAction: 'platform_subscription_commercial.active_commercial',
        setup: async (p) => {
          const s = svc(p);
          const d = await seedReadyDraft(s, fixtures);
          configId = d.id;
          rowVersion = d.rowVersion;
        },
        execute: async (service, key) => {
          const r = await service.activate(
            actorClaims(),
            configId,
            { expectedRowVersion: rowVersion, reason: 'activate gate' },
            key,
          );
          activeId = r.id;
          activeRv = r.rowVersion;
          return { id: r.id };
        },
        conflict: async (service, key) =>
          service.activate(
            actorClaims(),
            configId,
            { expectedRowVersion: rowVersion, reason: 'different reason' },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const a = svc(p, audit);
          const b = svc(p, audit);
          await Promise.allSettled([
            a.activate(
              actorClaims(),
              configId,
              { expectedRowVersion: rowVersion, reason: 'race activate' },
              key,
            ),
            b.activate(
              actorClaims(),
              configId,
              { expectedRowVersion: rowVersion, reason: 'race activate' },
              key,
            ),
          ]);
        },
      },
      {
        operation: 'subscription.schedule',
        auditAction: 'platform_subscription_commercial.scheduled',
        setup: async (p) => {
          const s = svc(p);
          const d = await seedReadyDraft(s, fixtures);
          configId = d.id;
          rowVersion = d.rowVersion;
        },
        execute: async (service, key) => {
          const r = await service.schedule(
            actorClaims(),
            configId,
            {
              expectedRowVersion: rowVersion,
              scheduledActivationAt: '2030-06-01T00:00:00.000Z',
              reason: 'schedule gate',
            },
            key,
          );
          activeId = r.id;
          activeRv = r.rowVersion;
          return { id: r.id };
        },
        conflict: async (service, key) =>
          service.schedule(
            actorClaims(),
            configId,
            {
              expectedRowVersion: rowVersion,
              scheduledActivationAt: '2031-06-01T00:00:00.000Z',
              reason: 'schedule gate',
            },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const a = svc(p, audit);
          const b = svc(p, audit);
          const body = {
            expectedRowVersion: rowVersion,
            scheduledActivationAt: '2030-07-01T00:00:00.000Z',
            reason: 'race schedule',
          };
          await Promise.allSettled([
            a.schedule(actorClaims(), configId, body, key),
            b.schedule(actorClaims(), configId, body, key),
          ]);
        },
      },
      {
        operation: 'subscription.suspend',
        auditAction: 'platform_subscription_commercial.suspended',
        setup: async (p) => {
          const s = svc(p);
          const a = await seedActive(s, fixtures);
          activeId = a.id;
          activeRv = a.rowVersion;
          configId = a.id;
          rowVersion = a.rowVersion;
        },
        execute: async (service, key) => {
          const r = await service.suspend(
            actorClaims(),
            configId,
            { expectedRowVersion: rowVersion, reason: 'suspend gate' },
            key,
          );
          suspendedId = r.id;
          suspendedRv = r.rowVersion;
          return { id: r.id };
        },
        conflict: async (service, key) =>
          service.suspend(
            actorClaims(),
            configId,
            { expectedRowVersion: rowVersion, reason: 'other suspend reason' },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const a = svc(p, audit);
          const b = svc(p, audit);
          await Promise.allSettled([
            a.suspend(
              actorClaims(),
              configId,
              { expectedRowVersion: rowVersion, reason: 'race suspend' },
              key,
            ),
            b.suspend(
              actorClaims(),
              configId,
              { expectedRowVersion: rowVersion, reason: 'race suspend' },
              key,
            ),
          ]);
        },
      },
      {
        operation: 'subscription.resume',
        auditAction: 'platform_subscription_commercial.active_commercial',
        setup: async (p) => {
          const s = svc(p);
          const a = await seedActive(s, fixtures);
          const suspended = await s.suspend(actorClaims(), a.id, {
            expectedRowVersion: a.rowVersion,
            reason: 'prep resume',
          });
          configId = suspended.id;
          rowVersion = suspended.rowVersion;
        },
        execute: async (service, key) => {
          const r = await service.resume(
            actorClaims(),
            configId,
            { expectedRowVersion: rowVersion, reason: 'resume gate' },
            key,
          );
          return { id: r.id };
        },
        conflict: async (service, key) =>
          service.resume(
            actorClaims(),
            configId,
            { expectedRowVersion: rowVersion, reason: 'other resume' },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const a = svc(p, audit);
          const b = svc(p, audit);
          await Promise.allSettled([
            a.resume(
              actorClaims(),
              configId,
              { expectedRowVersion: rowVersion, reason: 'race resume' },
              key,
            ),
            b.resume(
              actorClaims(),
              configId,
              { expectedRowVersion: rowVersion, reason: 'race resume' },
              key,
            ),
          ]);
        },
      },
      {
        operation: 'subscription.cancel',
        auditAction: 'platform_subscription_commercial.cancelled',
        setup: async (p) => {
          const s = svc(p);
          const a = await seedActive(s, fixtures);
          configId = a.id;
          rowVersion = a.rowVersion;
        },
        execute: async (service, key) => {
          const r = await service.cancel(
            actorClaims(),
            configId,
            { expectedRowVersion: rowVersion, reason: 'cancel gate' },
            key,
          );
          return { id: r.id };
        },
        conflict: async (service, key) =>
          service.cancel(
            actorClaims(),
            configId,
            { expectedRowVersion: rowVersion, reason: 'other cancel' },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const a = svc(p, audit);
          const b = svc(p, audit);
          await Promise.allSettled([
            a.cancel(
              actorClaims(),
              configId,
              { expectedRowVersion: rowVersion, reason: 'race cancel' },
              key,
            ),
            b.cancel(
              actorClaims(),
              configId,
              { expectedRowVersion: rowVersion, reason: 'race cancel' },
              key,
            ),
          ]);
        },
      },
      {
        operation: 'subscription.supersede',
        auditAction: 'platform_subscription_commercial.superseded',
        setup: async (p) => {
          const s = svc(p);
          const a = await seedActive(s, fixtures);
          configId = a.id;
          rowVersion = a.rowVersion;
        },
        execute: async (service, key) => {
          const r = await service.supersede(
            actorClaims(),
            configId,
            { expectedRowVersion: rowVersion, reason: 'supersede gate' },
            key,
          );
          return { id: r.id };
        },
        conflict: async (service, key) =>
          service.supersede(
            actorClaims(),
            configId,
            { expectedRowVersion: rowVersion, reason: 'other supersede' },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const a = svc(p, audit);
          const b = svc(p, audit);
          await Promise.allSettled([
            a.supersede(
              actorClaims(),
              configId,
              { expectedRowVersion: rowVersion, reason: 'race supersede' },
              key,
            ),
            b.supersede(
              actorClaims(),
              configId,
              { expectedRowVersion: rowVersion, reason: 'race supersede' },
              key,
            ),
          ]);
        },
      },
      {
        operation: 'subscription.renew',
        auditAction: 'platform_subscription_commercial.renewed',
        setup: async (p) => {
          const s = svc(p);
          const a = await seedActive(s, fixtures);
          configId = a.id;
          rowVersion = a.rowVersion;
        },
        execute: async (service, key) => {
          const r = await service.renew(
            actorClaims(),
            configId,
            { expectedRowVersion: rowVersion, reason: 'renew gate', renewalEffectiveAt: '2028-01-01T00:00:00.000Z' },
            key,
          );
          return { id: r.id };
        },
        conflict: async (service, key) =>
          service.renew(
            actorClaims(),
            configId,
            { expectedRowVersion: rowVersion, reason: 'other renew', renewalEffectiveAt: '2028-06-01T00:00:00.000Z' },
            key,
          ),
        concurrent: async (p, key, audit) => {
          const a = svc(p, audit);
          const b = svc(p, audit);
          await Promise.allSettled([
            a.renew(
              actorClaims(),
              configId,
              { expectedRowVersion: rowVersion, reason: 'race renew', renewalEffectiveAt: '2028-01-01T00:00:00.000Z' },
              key,
            ),
            b.renew(
              actorClaims(),
              configId,
              { expectedRowVersion: rowVersion, reason: 'race renew', renewalEffectiveAt: '2028-01-01T00:00:00.000Z' },
              key,
            ),
          ]);
        },
      },
    ];
  }

  it('idempotency matrix: replay, conflict, recreate, concurrent for all 13 durable ops', async () => {
    for (const op of buildMatrix()) {
      await cleanupPlatformSubscriptionCommercialTables(prisma);
      const key = `idem-${op.operation.replace(/\./g, '-')}`;

      await op.setup(prisma, fixtures);
      const audit = new FakeSubscriptionAuditLog();
      const service = svc(prisma, audit);

      const first = await op.execute(service, key);
      expect(await completedIdemCount(prisma, key, op.operation)).toBe(1);

      const replay = await op.execute(service, key);
      expect(replay.id).toBe(first.id);
      expect(await completedIdemCount(prisma, key, op.operation)).toBe(1);

      await expect(op.conflict(service, key)).rejects.toBeInstanceOf(ConflictException);

      const service2 = svc(prisma, new FakeSubscriptionAuditLog());
      const replay2 = await op.execute(service2, key);
      expect(replay2.id).toBe(first.id);

      await cleanupPlatformSubscriptionCommercialTables(prisma);
      const concAudit = new FakeSubscriptionAuditLog();
      await op.setup(prisma, fixtures);
      await op.concurrent(prisma, key, concAudit, fixtures);
      expect(await completedIdemCount(prisma, key, op.operation)).toBe(1);
    }
  });

  it('renew and supersede are distinct durable operations (same key, different op)', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const sharedKey = 'idem-renew-not-supersede';

    const renewed = await service.renew(
      actorClaims(),
      active.id,
      { expectedRowVersion: active.rowVersion, reason: 'renew distinct', renewalEffectiveAt: '2028-01-01T00:00:00.000Z' },
      sharedKey,
    );
    expect(await completedIdemCount(prisma, sharedKey, 'subscription.renew')).toBe(1);
    expect(await completedIdemCount(prisma, sharedKey, 'subscription.supersede')).toBe(0);

    await cleanupPlatformSubscriptionCommercialTables(prisma);
    const active2 = await seedActive(service, fixtures);
    const superseded = await service.supersede(
      actorClaims(),
      active2.id,
      { expectedRowVersion: active2.rowVersion, reason: 'supersede distinct' },
      sharedKey,
    );
    expect(await completedIdemCount(prisma, sharedKey, 'subscription.supersede')).toBe(1);
    expect(await completedIdemCount(prisma, sharedKey, 'subscription.renew')).toBe(0);
    expect(superseded.id).not.toBe(renewed.id);
  });

  it('mutation rate limit=1 → second create 429, no completed idempotency row', async () => {
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      config: { mutationRateLimitPerMinute: 1 },
    });
    await service.create(actorClaims(), { platformTenantId: fixtures.platformTenantId });
    let blocked: unknown;
    try {
      await service.create(
        actorClaims(),
        { platformTenantId: fixtures.platformTenantId },
        'idem-rate-mut-blocked',
      );
    } catch (err) {
      blocked = err;
    }
    expect(blocked).toBeInstanceOf(HttpException);
    expect(blocked).toMatchObject({ status: 429 });
    expect(await completedIdemCount(prisma, 'idem-rate-mut-blocked')).toBe(0);
  });

  it('highImpact rate limit=1 → second activate 429, no write side effects', async () => {
    const helper = svc(prisma);
    const limited = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
      config: { highImpactRateLimitPerMinute: 1 },
    });
    const draft1 = await seedReadyDraft(helper, fixtures);
    await limited.activate(
      actorClaims(),
      draft1.id,
      { expectedRowVersion: draft1.rowVersion, reason: 'first activate' },
      'idem-rate-hi-ok',
    );

    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    const draft2 = await seedReadyDraft(helper, fixtures);
    await expect(
      limited.activate(
        actorClaims(),
        draft2.id,
        { expectedRowVersion: draft2.rowVersion, reason: 'blocked activate' },
        'idem-rate-hi-blocked',
      ),
    ).rejects.toMatchObject({ status: 429 });
    expect(await completedIdemCount(prisma, 'idem-rate-hi-blocked')).toBe(0);
    const stillDraft = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft2.id },
    });
    expect(stillDraft.lifecycle).toBe('DRAFT');
  });

  it('readHeavy rate limit=1 → second readiness 429', async () => {
    const helper = svc(prisma);
    const draft = await seedReadyDraft(helper, fixtures);
    const limited = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      config: { readHeavyRateLimitPerMinute: 1 },
    });
    await limited.readiness(actorClaims(), draft.id);
    await expect(limited.readiness(actorClaims(), draft.id)).rejects.toMatchObject({ status: 429 });
  });

  it('view-only cannot mutate — Forbidden with zero config rows', async () => {
    const viewer = createSubscriptionsService({
      prisma,
      permissions: ['subscription.view', 'plan.view', 'addon.view', 'override.view'],
    });
    await expect(
      viewer.create(actorClaims(), { platformTenantId: fixtures.platformTenantId }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(await prisma.platformSubscriptionCommercialConfig.count()).toBe(0);
  });
});
