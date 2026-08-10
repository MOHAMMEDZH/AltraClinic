/**
 * Step 16 injected transaction rollback by family (test-only failure hook).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import {
  PLATFORM_SUBSCRIPTIONS_TX_FAILURE_HOOK,
  type SubscriptionTxFailurePoint,
} from '../platform-subscriptions.tokens';
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

function failAt(point: SubscriptionTxFailurePoint) {
  return async (p: SubscriptionTxFailurePoint) => {
    if (p === point) throw new Error(`injected ${point}`);
  };
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
        name: 'Rollback Tenant',
        slug: `rollback-${randomUUID().slice(0, 8)}`,
        features: {},
      },
    });
    platformTenant = await prisma.platformTenant.create({
      data: {
        tenantId: tenant.id,
        displayName: 'Rollback Tenant',
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

describe('Step 16 production failure-hook absence', () => {
  it('PlatformSubscriptionsModule does not register PLATFORM_SUBSCRIPTIONS_TX_FAILURE_HOOK', () => {
    const moduleSrc = readFileSync(
      join(__dirname, '../platform-subscriptions.module.ts'),
      'utf8',
    );
    expect(moduleSrc).not.toContain('PLATFORM_SUBSCRIPTIONS_TX_FAILURE_HOOK');
    expect(moduleSrc).not.toMatch(/provide:\s*PLATFORM_SUBSCRIPTIONS_TX_FAILURE_HOOK/);
    expect(PLATFORM_SUBSCRIPTIONS_TX_FAILURE_HOOK.description).toContain(
      'PLATFORM_SUBSCRIPTIONS_TX_FAILURE_HOOK',
    );
  });
});

describeDb('Step 16 subscription rollback injection by transaction family', () => {
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

  function baseService(audit = new FakeSubscriptionAuditLog(), hook?: SubscriptionTxFailurePoint) {
    return createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      audit,
      stepUpFresh: true,
      failureHook: hook ? failAt(hook) : undefined,
    });
  }

  async function seedReadyDraft() {
    const s = baseService();
    const c = await s.create(actorClaims(), { platformTenantId: fixtures.platformTenantId });
    return s.assignPlanVersion(actorClaims(), c.id, {
      expectedRowVersion: c.rowVersion,
      planVersionId: fixtures.publishedPlanVersionId,
    });
  }

  async function seedActive() {
    const s = baseService();
    const d = await seedReadyDraft();
    return s.activate(actorClaims(), d.id, {
      expectedRowVersion: d.rowVersion,
      reason: 'rollback seed',
    });
  }

  it('A. create parent insert rolls back — no config row', async () => {
    const audit = new FakeSubscriptionAuditLog();
    const failing = baseService(audit, 'after_create_parent_insert');
    await expect(
      failing.create(
        actorClaims(),
        { platformTenantId: fixtures.platformTenantId },
        'idem-rb-create',
      ),
    ).rejects.toThrow(/after_create_parent_insert/);
    expect(await prisma.platformSubscriptionCommercialConfig.count()).toBe(0);
    expect(
      await prisma.platformSubscriptionCommercialIdempotencyRecord.count({
        where: { idempotencyKey: 'idem-rb-create' },
      }),
    ).toBe(0);
    expect(audit.records.length).toBe(0);
  });

  it('B. draft update rolls back rowVersion', async () => {
    const bare = baseService();
    const created = await bare.create(actorClaims(), {
      platformTenantId: fixtures.platformTenantId,
    });
    const audit = new FakeSubscriptionAuditLog();
    const failing = baseService(audit, 'after_update_row_version');
    await expect(
      failing.update(
        actorClaims(),
        created.id,
        { expectedRowVersion: created.rowVersion, reasonCode: 'RB' },
        'idem-rb-update',
      ),
    ).rejects.toThrow(/after_update_row_version/);
    const after = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(after.rowVersion).toBe(created.rowVersion);
    expect(audit.records.filter((r) => r.action === 'platform_subscription_commercial.updated').length).toBe(0);
  });

  it('C. plan assignment rolls back', async () => {
    const bare = baseService();
    const created = await bare.create(actorClaims(), {
      platformTenantId: fixtures.platformTenantId,
    });
    const audit = new FakeSubscriptionAuditLog();
    const failing = baseService(audit, 'after_plan_row_version');
    await expect(
      failing.assignPlanVersion(
        actorClaims(),
        created.id,
        {
          expectedRowVersion: created.rowVersion,
          planVersionId: fixtures.publishedPlanVersionId,
        },
        'idem-rb-plan',
      ),
    ).rejects.toThrow(/after_plan_row_version/);
    const after = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(after.planVersionId).toBeNull();
    expect(after.rowVersion).toBe(created.rowVersion);
  });

  it('D. add-on replacement rolls back partial insert', async () => {
    const draft = await seedReadyDraft();
    const before = await prisma.platformSubscriptionAddOnAssignment.count({
      where: { configId: draft.id },
    });
    const audit = new FakeSubscriptionAuditLog();
    const failing = baseService(audit, 'after_addon_delete');
    await expect(
      failing.replaceAddOns(
        actorClaims(),
        draft.id,
        { expectedRowVersion: draft.rowVersion, addOnVersionIds: [] },
        'idem-rb-addon',
      ),
    ).rejects.toThrow(/after_addon_delete/);
    expect(
      await prisma.platformSubscriptionAddOnAssignment.count({ where: { configId: draft.id } }),
    ).toBe(before);
    const after = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(after.rowVersion).toBe(draft.rowVersion);
  });

  it('E. override replacement rolls back partial insert', async () => {
    const draft = await seedReadyDraft();
    const audit = new FakeSubscriptionAuditLog();
    const failing = baseService(audit, 'after_override_delete');
    await expect(
      failing.replaceOverrides(
        actorClaims(),
        draft.id,
        { expectedRowVersion: draft.rowVersion, overrideIds: [] },
        'idem-rb-override',
      ),
    ).rejects.toThrow(/after_override_delete/);
    const after = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(after.rowVersion).toBe(draft.rowVersion);
  });

  it('F. date update rolls back', async () => {
    const draft = await seedReadyDraft();
    const audit = new FakeSubscriptionAuditLog();
    const failing = baseService(audit, 'after_dates_row_version');
    await expect(
      failing.updateDates(
        actorClaims(),
        draft.id,
        {
          expectedRowVersion: draft.rowVersion,
          commercialStart: '2026-01-01T00:00:00.000Z',
          commercialEnd: '2027-01-01T00:00:00.000Z',
        },
        'idem-rb-dates',
      ),
    ).rejects.toThrow(/after_dates_row_version/);
    const after = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(after.commercialStart).toBeNull();
    expect(after.commercialEnd).toBeNull();
  });

  it('G. activate rolls back — no snapshot, lifecycle unchanged', async () => {
    const draft = await seedReadyDraft();
    const audit = new FakeSubscriptionAuditLog();
    const failing = baseService(audit, 'after_activate_snapshot');
    await expect(
      failing.activate(
        actorClaims(),
        draft.id,
        { expectedRowVersion: draft.rowVersion, reason: 'rb activate' },
        'idem-rb-activate',
      ),
    ).rejects.toThrow(/after_activate_snapshot/);
    const after = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(after.lifecycle).toBe('DRAFT');
    expect(await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: draft.id } })).toBe(0);
  });

  it('H. cancel rolls back current clear', async () => {
    const active = await seedActive();
    const audit = new FakeSubscriptionAuditLog();
    const failing = baseService(audit, 'before_cancel_commit');
    await expect(
      failing.cancel(
        actorClaims(),
        active.id,
        { expectedRowVersion: active.rowVersion, reason: 'rb cancel' },
        'idem-rb-cancel',
      ),
    ).rejects.toThrow(/before_cancel_commit/);
    const after = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.id },
    });
    expect(after.lifecycle).toBe('ACTIVE_COMMERCIAL');
    expect(after.isCurrent).toBe(true);
  });

  it('I. supersede rolls back — no successor orphan, predecessor unchanged', async () => {
    const active = await seedActive();
    const beforeCount = await prisma.platformSubscriptionCommercialConfig.count();
    const audit = new FakeSubscriptionAuditLog();
    const failing = baseService(audit, 'after_supersede_successor_create');
    await expect(
      failing.supersede(
        actorClaims(),
        active.id,
        { expectedRowVersion: active.rowVersion, reason: 'rb supersede' },
        'idem-rb-supersede',
      ),
    ).rejects.toThrow(/after_supersede_successor_create/);
    expect(await prisma.platformSubscriptionCommercialConfig.count()).toBe(beforeCount);
    const pred = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.id },
    });
    expect(pred.lifecycle).toBe('ACTIVE_COMMERCIAL');
    expect(pred.isCurrent).toBe(true);
  });
});
