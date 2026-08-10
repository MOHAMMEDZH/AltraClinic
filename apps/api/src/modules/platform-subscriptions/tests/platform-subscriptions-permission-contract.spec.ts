/**
 * Step 16 subscription permission contract — catalog keys, migrate scope, non-execution.
 */
import { ForbiddenException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { PrismaClient } from '@prisma/client';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  PLATFORM_PERMISSIONS,
  PLATFORM_ROLES,
} from '../../auth/platform-rbac/platform-rbac.catalog';
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

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const ACTOR = '00000000-0000-4000-8000-000000000016';
const CLAIMS = {
  sub: ACTOR,
  sessionId: '11111111-1111-4111-8111-111111111116',
} as JwtClaimsVO;

function claims(): JwtClaimsVO {
  return { ...CLAIMS, sessionId: randomUUID() } as JwtClaimsVO;
}

async function ensureFixtureTenant(prisma: PrismaClient): Promise<{
  platformTenantId: string;
  publishedPlanVersionId: string;
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
        name: 'Perm Contract Tenant',
        slug: `perm-contract-${randomUUID().slice(0, 8)}`,
        features: {},
      },
    });
    platformTenant = await prisma.platformTenant.create({
      data: {
        tenantId: tenant.id,
        displayName: 'Perm Contract Tenant',
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

describe('Step 16 subscription permission contract', () => {
  const servicePath = join(__dirname, '../application/platform-subscriptions.service.ts');
  const catalogKeys = new Set(PLATFORM_PERMISSIONS.map((p) => p.key));
  const serviceSrc = readFileSync(servicePath, 'utf8');

  it('catalog defines subscription.view|assign|migrate|suspend|cancel only (no wildcard)', () => {
    expect(catalogKeys.has('subscription.view')).toBe(true);
    expect(catalogKeys.has('subscription.assign')).toBe(true);
    expect(catalogKeys.has('subscription.migrate')).toBe(true);
    expect(catalogKeys.has('subscription.suspend')).toBe(true);
    expect(catalogKeys.has('subscription.cancel')).toBe(true);
    expect(catalogKeys.has('subscription.*')).toBe(false);
    expect(catalogKeys.has('subscription.manage')).toBe(false);
  });

  it('service gates migrate paths with subscription.migrate (schedule/activate/supersede/renew)', () => {
    for (const fn of ['schedule', 'activate', 'supersede', 'renew']) {
      const idx = serviceSrc.indexOf(`async ${fn}(`);
      expect(idx).toBeGreaterThan(0);
    }
    expect(serviceSrc).toMatch(/transitionLifecycle[\s\S]*subscription\.migrate/);
    expect(serviceSrc).toMatch(/supersedeInternal[\s\S]*subscription\.migrate/);
    expect(serviceSrc).not.toMatch(/this\.require\(permissions,\s*'subscription\.\*'/);
    expect(serviceSrc).not.toMatch(/permissions\.has\('\*'\)/);
  });

  it('plans_subscription_manager grants all subscription mutation permissions', () => {
    const role = PLATFORM_ROLES.find((r) => r.key === 'plans_subscription_manager');
    expect(role).toBeDefined();
    for (const key of [
      'subscription.view',
      'subscription.assign',
      'subscription.migrate',
      'subscription.suspend',
      'subscription.cancel',
    ]) {
      expect(role!.permissionKeys).toContain(key);
    }
  });

  describeDb('denied mutations do not execute (non-execution spies)', () => {
    let prisma: PrismaClient;
    let fixtures: Awaited<ReturnType<typeof ensureFixtureTenant>>;

    beforeAll(async () => {
      prisma = createPlatformDbSecurityClient(DEFAULT_PLATFORM_DB_SECURITY_URL);
      await prisma.$connect();
      fixtures = await ensureFixtureTenant(prisma);
    });

    afterAll(async () => {
      await prisma?.$disconnect();
    });

    beforeEach(async () => {
      await cleanupPlatformSubscriptionCommercialTables(prisma);
      await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    });

    it('subscription.assign does not grant activate (migrate required)', async () => {
      const audit = new FakeSubscriptionAuditLog();
      const manager = createSubscriptionsService({
        prisma,
        permissions: ALL_SUBSCRIPTION_PERMS,
        audit,
        stepUpFresh: true,
      });
      const created = await manager.create(claims(), {
        platformTenantId: fixtures.platformTenantId,
      });
      const assigned = await manager.assignPlanVersion(claims(), created.id, {
        expectedRowVersion: created.rowVersion,
        planVersionId: fixtures.publishedPlanVersionId,
      });
      const beforeConfigs = await prisma.platformSubscriptionCommercialConfig.count();
      const beforeSnapshots = await prisma.platformSubscriptionCommercialSnapshot.count();

      const assignOnly = createSubscriptionsService({
        prisma,
        permissions: [
          'subscription.view',
          'subscription.assign',
          'plan.view',
          'addon.view',
          'override.view',
        ],
        audit: new FakeSubscriptionAuditLog(),
        stepUpFresh: true,
      });
      await expect(
        assignOnly.activate(claims(), assigned.id, {
          expectedRowVersion: assigned.rowVersion,
          reason: 'should be denied',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(await prisma.platformSubscriptionCommercialConfig.count()).toBe(beforeConfigs);
      expect(await prisma.platformSubscriptionCommercialSnapshot.count()).toBe(beforeSnapshots);
      expect(
        audit.records.filter((r) => r.action === 'platform_subscription_commercial.active_commercial')
          .length,
      ).toBe(0);
      const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
        where: { id: assigned.id },
      });
      expect(row.lifecycle).toBe('DRAFT');
    });

    it('subscription.view only → create Forbidden, audit spy empty, no idempotency row', async () => {
      const audit = new FakeSubscriptionAuditLog();
      const viewer = createSubscriptionsService({
        prisma,
        permissions: ['subscription.view', 'plan.view', 'addon.view', 'override.view'],
        audit,
      });
      await expect(
        viewer.create(claims(), { platformTenantId: fixtures.platformTenantId }, 'idem-perm-deny'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(await prisma.platformSubscriptionCommercialConfig.count()).toBe(0);
      expect(
        await prisma.platformSubscriptionCommercialIdempotencyRecord.count({
          where: { idempotencyKey: 'idem-perm-deny' },
        }),
      ).toBe(0);
      expect(audit.records.length).toBe(0);
    });

    it('subscription.assign only → supersede Forbidden without migrate', async () => {
      const audit = new FakeSubscriptionAuditLog();
      const full = createSubscriptionsService({
        prisma,
        permissions: ALL_SUBSCRIPTION_PERMS,
        audit,
        stepUpFresh: true,
      });
      const created = await full.create(claims(), {
        platformTenantId: fixtures.platformTenantId,
      });
      const assigned = await full.assignPlanVersion(claims(), created.id, {
        expectedRowVersion: created.rowVersion,
        planVersionId: fixtures.publishedPlanVersionId,
      });
      const active = await full.activate(claims(), assigned.id, {
        expectedRowVersion: assigned.rowVersion,
        reason: 'activate for perm test',
      });
      const beforeCount = await prisma.platformSubscriptionCommercialConfig.count();

      const assignOnly = createSubscriptionsService({
        prisma,
        permissions: [
          'subscription.view',
          'subscription.assign',
          'plan.view',
          'addon.view',
          'override.view',
        ],
        audit: new FakeSubscriptionAuditLog(),
        stepUpFresh: true,
      });
      await expect(
        assignOnly.supersede(claims(), active.id, {
          expectedRowVersion: active.rowVersion,
          reason: 'denied supersede',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(await prisma.platformSubscriptionCommercialConfig.count()).toBe(beforeCount);
    });
  });
});
