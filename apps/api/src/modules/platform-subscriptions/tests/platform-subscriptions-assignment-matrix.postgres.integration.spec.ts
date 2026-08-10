/**
 * Step 16 assignment + snapshot matrix (Plan / Add-on / Override / activation).
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
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
import type { SubscriptionTxFailurePoint } from '../platform-subscriptions.tokens';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

function claims(): JwtClaimsVO {
  return {
    sub: randomUUID(),
    sessionId: randomUUID(),
    principalType: 'platform',
  } as unknown as JwtClaimsVO;
}

describeDb('Step 16 assignment and snapshot matrix (postgres)', () => {
  let prisma: PrismaClient;
  let platformTenantId: string;
  let publishedPlanVersionId: string;
  let draftPlanVersionId: string;
  let planBefore: string;

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
        data: { name: 'Assign Matrix', slug: `am-${randomUUID().slice(0, 8)}`, features: {} },
      });
      pt = await prisma.platformTenant.create({
        data: {
          tenantId: t.id,
          displayName: 'Assign Matrix',
          region: 'ME_SOUTH',
          plan: 'PRO',
          status: 'ACTIVE',
          provisionedBy: randomUUID(),
        },
      });
    }
    platformTenantId = pt.id;
    planBefore = pt.plan;
    const published = await prisma.platformPlanVersion.findFirstOrThrow({
      where: {
        lifecycle: 'PUBLISHED',
        publicationFingerprint: { not: null },
        plan: { canonicalKey: { not: 'plan.business' } },
      },
    });
    publishedPlanVersionId = published.id;
    let draft = await prisma.platformPlanVersion.findFirst({ where: { lifecycle: 'DRAFT' } });
    if (!draft) {
      draft = await prisma.platformPlanVersion.create({
        data: { planId: published.planId, versionNumber: 998, lifecycle: 'DRAFT' },
      });
    }
    draftPlanVersionId = draft.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupPlatformSubscriptionCommercialTables(prisma);
  });

  it('Plan: published accepted; draft/business rejected; no PlatformTenant.plan mutation; OCC', async () => {
    const audit = new FakeSubscriptionAuditLog();
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
      audit,
    });
    const actor = claims();
    const draft = await service.create(actor, { platformTenantId });
    await expect(
      service.assignPlanVersion(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        planVersionId: draftPlanVersionId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const assigned = await service.assignPlanVersion(
      actor,
      draft.id,
      { expectedRowVersion: draft.rowVersion, planVersionId: publishedPlanVersionId },
      'idem-plan-assign',
    );
    expect(assigned.planVersionId).toBe(publishedPlanVersionId);
    await expect(
      service.assignPlanVersion(actor, draft.id, {
        expectedRowVersion: draft.rowVersion,
        planVersionId: publishedPlanVersionId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const tenant = await prisma.platformTenant.findUniqueOrThrow({ where: { id: platformTenantId } });
    expect(tenant.plan).toBe(planBefore);
    expect(
      audit.records.filter(
        (r) => r.action === 'platform_subscription_commercial.plan_version_assigned',
      ),
    ).toHaveLength(1);
  });

  it('snapshot: activate creates one; resume does not; injected failure rolls back fingerprint', async () => {
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
    });
    const actor = claims();
    const draft = await service.create(actor, { platformTenantId });
    const assigned = await service.assignPlanVersion(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      planVersionId: publishedPlanVersionId,
    });
    const active = await service.activate(actor, draft.id, {
      expectedRowVersion: assigned.rowVersion,
      reason: 'snap activate',
    });
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: active.id } }),
    ).toBe(1);
    const suspended = await service.suspend(actor, active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'pause',
    });
    const resumed = await service.resume(actor, suspended.id, {
      expectedRowVersion: suspended.rowVersion,
      reason: 'resume',
    });
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: resumed.id } }),
    ).toBe(1);

    await service.cancel(actor, resumed.id, {
      expectedRowVersion: resumed.rowVersion,
      reason: 'clear current',
    });

    let hit = false;
    const failing = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
      failureHook: async (point: SubscriptionTxFailurePoint) => {
        if (point === 'after_activate_snapshot') {
          hit = true;
          throw new Error('injected snapshot failure');
        }
      },
    });
    const d3 = await failing.create(claims(), { platformTenantId });
    const a3 = await failing.assignPlanVersion(claims(), d3.id, {
      expectedRowVersion: d3.rowVersion,
      planVersionId: publishedPlanVersionId,
    });
    await expect(
      failing.activate(claims(), d3.id, {
        expectedRowVersion: a3.rowVersion,
        reason: 'fail snap',
      }),
    ).rejects.toThrow(/injected snapshot failure/);
    expect(hit).toBe(true);
    expect(
      await prisma.platformSubscriptionCommercialSnapshot.count({ where: { configId: d3.id } }),
    ).toBe(0);
    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: d3.id },
    });
    expect(row.lifecycle).toBe('DRAFT');
    expect(row.commercialFingerprint).toBeNull();
  });
});
