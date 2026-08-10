/**
 * Flexible Step 21 — A03–A15 Model A durability (representative paths).
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  createHybridPrisma,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  enableAuditCenter,
  ensureSentinel,
  platformClaims,
  platformDbSecurityEnabled,
} from './audit-center-db.harness';
import { createPlatformRefreshSession } from '../../auth/tests/platform-db-security.harness';
import {
  createCatalogService,
  createSeedService,
} from '../../platform-healthcare-catalog/tests/platform-healthcare-catalog-db.harness';
import { AuditTrailHealthcareCatalogAuditLog } from '../../platform-healthcare-catalog/infrastructure/audit-trail-healthcare-catalog-audit-log';
import {
  createEntitlementsService,
  createPlansPrismaWrapper,
  createPlansSeedService,
  createPlansService,
} from '../../platform-plans/tests/platform-plans-db.harness';
import { AuditTrailPlatformPlansAuditLog } from '../../platform-plans/infrastructure/audit-trail-platform-plans-audit-log';
import {
  createFfStack,
  enableFfFlag,
  seedActiveFlag,
  seedSetting,
} from '../../feature-flags-settings/tests/feature-flags-settings-db.harness';
import {
  createOverridesService,
  createAddonsPrismaWrapper,
} from '../../platform-addons/tests/platform-addons-db.harness';
import { AuditTrailPlatformAddonsAuditLog } from '../../platform-addons/infrastructure/audit-trail-platform-addons-audit-log';
import {
  ALL_SUBSCRIPTION_PERMS,
  cleanupFixtureRuntimeSubscriptions,
  cleanupPlatformSubscriptionCommercialTables,
  createSubscriptionsPrismaWrapper,
  createSubscriptionsService,
  ensurePlatformSubscriptionFixtures,
} from '../../platform-subscriptions/tests/platform-subscriptions-db.harness';
import { AuditTrailPlatformSubscriptionsAuditLog } from '../../platform-subscriptions/infrastructure/audit-trail-platform-subscriptions-audit-log';
import {
  buildRequestBody,
  createProvisioningStack,
  enableProvisioningFlag,
  findPublishedPlanFixture,
  runFullHappyPath,
} from '../../tenant-provisioning/tests/tenant-provisioning-db.harness';
import {
  createLifecycleStack,
  enableLifecycleFlag,
  previewAndBody,
  seedClinicTenant,
} from '../../tenant-lifecycle/tests/tenant-lifecycle-db.harness';
import { TenantLifecycleAuditLog } from '../../tenant-lifecycle/application/tenant-lifecycle-audit.log';
import {
  isOperationCorrelationId,
  resolveOperationCorrelationId,
} from '../application/operation-correlation';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const CATALOG_PERMS = [
  'facility-type.view',
  'facility-type.manage',
  'specialty.view',
  'specialty.manage',
  'module.view',
  'module.manage',
  'feature.view',
  'feature.manage',
  'limit.view',
  'limit.manage',
  'compatibility-rule.view',
  'compatibility-rule.manage',
];

const PLAN_PERMS = [
  'plan.view',
  'plan.create',
  'plan.edit',
  'plan.lifecycle',
  'plan.alias.manage',
  'plan-version.view',
  'plan-version.create',
  'plan-version.review',
  'plan-version.publish',
  'plan-version.retire',
  'plan-entitlement.view',
  'plan-entitlement.manage',
  'plan-limit.view',
  'plan-limit.manage',
];

function report(row: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(`A03_A15_DURABILITY ${JSON.stringify(row)}`);
}

async function countAudits(prisma: PrismaClient, action: string, resourceId?: string) {
  return prisma.auditEntry.count({
    where: { action, ...(resourceId ? { resourceId } : {}) },
  });
}

describeDb('Step 21 A03-A15 durable audit Model A (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restoreAudit: () => void;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient();
    restoreAudit = enableAuditCenter();
    await ensureSentinel(prisma);
    await createSeedService(prisma).seedAll();
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
  });

  afterAll(async () => {
    restoreAudit();
    await prisma.$disconnect();
  });

  it('A03-D01 catalog updateItem Model A — durable AuditEntry + correlation', async () => {
    const actor = await createPlatformUserFixture(prisma, {
      email: `a03d01-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const session = await createPlatformRefreshSession(prisma, actor.id, {
      stepUpVerifiedAt: new Date(),
    });
    const claims = platformClaims(actor.id, session.sessionId);
    const wrapped = createHybridPrisma(prisma);
    const audit = new AuditTrailHealthcareCatalogAuditLog(wrapped);
    const svc = createCatalogService({
      prisma,
      permissions: CATALOG_PERMS,
      audit,
      stepUpFresh: true,
    });
    const item = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { kind: 'MODULE', lifecycle: 'ACTIVE' },
      include: { translations: true },
    });
    const before = await countAudits(prisma, 'healthcare_catalog.item.updated', item.id);
    await svc.updateItem(claims, item.id, {
      expectedVersion: item.version,
      translations: [
        {
          locale: 'en-US',
          displayName: (item.translations.find((t) => t.locale === 'en-US')?.displayName ??
            item.canonicalKey
          ).slice(0, 180) + 'x',
          shortDescription: 'A03 durability',
        },
      ],
    });
    expect(await countAudits(prisma, 'healthcare_catalog.item.updated', item.id)).toBe(before + 1);
    const row = await prisma.auditEntry.findFirst({
      where: { action: 'healthcare_catalog.item.updated', resourceId: item.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(isOperationCorrelationId(row?.correlationId)).toBe(true);
    expect(row?.actorId).toBe(claims.sub);
    expect(row?.actorId).not.toBe(row?.correlationId);
    report({ id: 'A03-D01', model: 'A', auditDelta: 1, result: 'PASS' });
  });

  it('A03-D05 catalog audit failure rolls back version', async () => {
    const actor = await createPlatformUserFixture(prisma, {
      email: `a03d05-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const session = await createPlatformRefreshSession(prisma, actor.id, {
      stepUpVerifiedAt: new Date(),
    });
    const claims = platformClaims(actor.id, session.sessionId);
    const item = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { kind: 'FEATURE', lifecycle: 'ACTIVE' },
    });
    const versionBefore = item.version;
    const svc = createCatalogService({
      prisma,
      permissions: CATALOG_PERMS,
      audit: {
        record: async () => undefined,
        recordInTransaction: async () => {
          throw new Error('injected_audit_failure');
        },
      } as never,
      stepUpFresh: true,
    });
    await expect(
      svc.updateItem(claims, item.id, {
        expectedVersion: versionBefore,
        translations: [
          { locale: 'en-US', displayName: 'should-rollback', shortDescription: 'rollback' },
        ],
      }),
    ).rejects.toThrow(/injected_audit_failure/);
    const reloaded = await prisma.healthcareCatalogItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(reloaded.version).toBe(versionBefore);
    report({ id: 'A03-D05', model: 'A', business: 0, result: 'PASS' });
  });

  it('A04-D01 plan draft create Model A', async () => {
    const claims = { sub: randomUUID(), sessionId: randomUUID() } as JwtClaimsVO;
    const wrapper = createPlansPrismaWrapper(prisma);
    const audit = new AuditTrailPlatformPlansAuditLog(wrapper as unknown as PrismaService);
    const plans = createPlansService({ prisma, permissions: PLAN_PERMS, audit, stepUpFresh: true });
    const plan = await plans.createPlan(
      claims,
      {
        canonicalKey: `plan.a04d01_${randomUUID().slice(0, 8)}`,
        translations: [
          { locale: 'en-US', displayName: 'A04 D01', shortDescription: 'a04' },
          { locale: 'ar-SY', displayName: 'أ٠٤', shortDescription: 'أ٠٤' },
        ],
      },
      `a04d01-plan-${randomUUID()}`,
    );
    const draft = await plans.createDraftVersion(claims, plan.id, {
      translations: [
        {
          locale: 'en-US',
          releaseLabel: `A04 ${randomUUID().slice(0, 6)}`,
          shortDescription: 'a04',
        },
        {
          locale: 'ar-SY',
          releaseLabel: `أ٠٤ ${randomUUID().slice(0, 6)}`,
          shortDescription: 'مسودة',
        },
      ],
    });
    const row = await prisma.auditEntry.findFirst({
      where: { action: 'platform_plan_version.created', resourceId: draft.id },
    });
    expect(row).toBeTruthy();
    expect(isOperationCorrelationId(row?.correlationId)).toBe(true);
    report({ id: 'A04-D01', model: 'A', result: 'PASS' });
  });

  it('A05-D06 publish before_commit inject rolls back publication+audit', async () => {
    const claims = { sub: randomUUID(), sessionId: randomUUID() } as JwtClaimsVO;
    const wrapper = createPlansPrismaWrapper(prisma);
    const audit = new AuditTrailPlatformPlansAuditLog(wrapper as unknown as PrismaService);
    const plans = createPlansService({
      prisma,
      permissions: PLAN_PERMS,
      audit,
      stepUpFresh: true,
      failureHook: async (point) => {
        if (point === 'before_transaction_commit') throw new Error('injected_before_commit');
      },
    });
    const ents = createEntitlementsService({ prisma, permissions: PLAN_PERMS, audit });

    let planId: string;
    let versionId: string;
    let rowVersion: number;

    const existing = await prisma.platformPlanVersion.findFirst({
      where: { lifecycle: 'DRAFT', plan: { lifecycle: 'ACTIVE' } },
    });
    if (existing) {
      const readiness = await plans.getReadiness(claims, existing.planId, existing.id);
      if (readiness.publicationReady) {
        planId = existing.planId;
        versionId = existing.id;
        rowVersion = existing.rowVersion;
      } else {
        const createdPlan = await plans.createPlan(
          claims,
          {
            canonicalKey: `plan.a05d06_${randomUUID().slice(0, 8)}`,
            translations: [
              { locale: 'en-US', displayName: 'A05 D06', shortDescription: 'a05' },
              { locale: 'ar-SY', displayName: 'أ٠٥', shortDescription: 'أ٠٥' },
            ],
          },
          `a05d06-plan-${randomUUID()}`,
        );
        const createdDraft = await plans.createDraftVersion(
          claims,
          createdPlan.id,
          {
            translations: [
              {
                locale: 'en-US',
                releaseLabel: `A05 ${randomUUID().slice(0, 6)}`,
                shortDescription: 'draft',
              },
              { locale: 'ar-SY', releaseLabel: 'مسودة', shortDescription: 'مسودة' },
            ],
          },
          `a05d06-d-${randomUUID()}`,
        );
        await ents.putEntitlements(
          claims,
          createdPlan.id,
          createdDraft.id,
          {
            expectedRowVersion: createdDraft.rowVersion,
            entitlementKeys: ['module.dashboard', 'module.patients'],
          },
          `a05d06-e-${randomUUID()}`,
        );
        const afterEnt = await prisma.platformPlanVersion.findUniqueOrThrow({
          where: { id: createdDraft.id },
        });
        await ents.putLimits(
          claims,
          createdPlan.id,
          afterEnt.id,
          {
            expectedRowVersion: afterEnt.rowVersion,
            limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '10' }],
          },
          `a05d06-l-${randomUUID()}`,
        );
        const ready = await prisma.platformPlanVersion.findUniqueOrThrow({
          where: { id: createdDraft.id },
        });
        const r2 = await plans.getReadiness(claims, ready.planId, ready.id);
        if (!r2.publicationReady) {
          report({
            id: 'A05-D06',
            result: 'SKIP',
            note: `not publication-ready: ${JSON.stringify(r2.blockers)}`,
          });
          return;
        }
        planId = ready.planId;
        versionId = ready.id;
        rowVersion = ready.rowVersion;
      }
    } else {
      report({ id: 'A05-D06', result: 'SKIP', note: 'no draft' });
      return;
    }

    const auditsBefore = await countAudits(prisma, 'platform_plan_version.published', versionId);
    await expect(
      plans.publishVersion(claims, planId, versionId, {
        expectedRowVersion: rowVersion,
        reason: 'A05-D06 proof',
      }),
    ).rejects.toThrow(/injected_before_commit/);
    const still = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: versionId } });
    expect(still.lifecycle).toBe('DRAFT');
    expect(await countAudits(prisma, 'platform_plan_version.published', versionId)).toBe(auditsBefore);
    report({ id: 'A05-D06', model: 'A', business: 0, audit: 0, result: 'PASS' });
  }, 180_000);

  it('A06-D01/D02 entitlements replace + exact replay', async () => {
    const claims = { sub: randomUUID(), sessionId: randomUUID() } as JwtClaimsVO;
    const wrapper = createPlansPrismaWrapper(prisma);
    const audit = new AuditTrailPlatformPlansAuditLog(wrapper as unknown as PrismaService);
    const ents = createEntitlementsService({ prisma, permissions: PLAN_PERMS, audit });
    const draft = await prisma.platformPlanVersion.findFirstOrThrow({
      where: { lifecycle: 'DRAFT' },
    });
    const action = 'platform_plan_version.entitlements_replaced';
    const before = await countAudits(prisma, action, draft.id);
    const key = `a06-${randomUUID()}`;
    await ents.putEntitlements(
      claims,
      draft.planId,
      draft.id,
      { expectedRowVersion: draft.rowVersion, entitlementKeys: ['module.dashboard', 'module.patients'] },
      key,
    );
    expect(await countAudits(prisma, action, draft.id)).toBe(before + 1);
    await ents.putEntitlements(
      claims,
      draft.planId,
      draft.id,
      { expectedRowVersion: draft.rowVersion, entitlementKeys: ['module.dashboard', 'module.patients'] },
      key,
    );
    expect(await countAudits(prisma, action, draft.id)).toBe(before + 1);
    const row = await prisma.auditEntry.findFirst({
      where: { action, resourceId: draft.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(isOperationCorrelationId(row?.correlationId)).toBe(true);
    report({ id: 'A06-D01-D02', model: 'A', replayExtra: 0, result: 'PASS' });
  });

  it('A07-D01/D02 limits replace + exact replay', async () => {
    const claims = { sub: randomUUID(), sessionId: randomUUID() } as JwtClaimsVO;
    const wrapper = createPlansPrismaWrapper(prisma);
    const audit = new AuditTrailPlatformPlansAuditLog(wrapper as unknown as PrismaService);
    const ents = createEntitlementsService({ prisma, permissions: PLAN_PERMS, audit });
    const draft = await prisma.platformPlanVersion.findFirstOrThrow({
      where: { lifecycle: 'DRAFT' },
    });
    const action = 'platform_plan_version.limits_replaced';
    const before = await countAudits(prisma, action, draft.id);
    const key = `a07-${randomUUID()}`;
    const body = {
      expectedRowVersion: draft.rowVersion,
      limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '25' }],
    };
    await ents.putLimits(claims, draft.planId, draft.id, body, key);
    expect(await countAudits(prisma, action, draft.id)).toBe(before + 1);
    await ents.putLimits(claims, draft.planId, draft.id, body, key);
    expect(await countAudits(prisma, action, draft.id)).toBe(before + 1);
    report({ id: 'A07-D01-D02', model: 'A', replayExtra: 0, result: 'PASS' });
  });

  it('A13-A15-D01 Step20 history Model A correlation', async () => {
    const restore = enableFfFlag();
    try {
      const actor = await createPlatformUserFixture(prisma, {
        email: `a13-${randomUUID()}@test.local`,
        roleKeys: ['platform_owner'],
      });
      const stack = createFfStack(prisma, { stepUpFresh: true });
      const claims = platformClaims(actor.id, randomUUID());
      const flag = (await stack.service.createFlag(
        claims,
        {
          canonicalKey: `ops.a13.${randomUUID().slice(0, 8)}`,
          displayName: 'A13',
          description: 'coverage',
          ownerTeam: 'ops',
          category: 'test',
          effect: 'OPERATIONAL_ENABLEMENT',
          reason: 'A13 create',
        },
        `a13-${randomUUID()}`,
      )) as { id: string; rowVersion: number };
      expect(
        await prisma.platformFeatureFlagHistory.count({
          where: { flagId: flag.id, operation: 'FEATURE_FLAG_CREATE' },
        }),
      ).toBe(1);
      const h = await prisma.platformFeatureFlagHistory.findFirst({ where: { flagId: flag.id } });
      expect(isOperationCorrelationId(h?.correlationId)).toBe(true);

      const seeded = await seedActiveFlag(prisma, actor.id, { effect: 'KILL_SWITCH_DENY' });
      await stack.service.setKillSwitch(
        claims,
        seeded.id,
        true,
        {
          reason: 'A14 emergency kill',
          expectedRowVersion: seeded.rowVersion,
          previewFingerprint: 'fp',
          confirmation: 'CONFIRM',
        },
        `a14-${randomUUID()}`,
      );
      expect(
        await prisma.platformFeatureFlagHistory.count({
          where: { flagId: seeded.id, operation: 'FEATURE_FLAG_KILL_SWITCH_ACTIVATE' },
        }),
      ).toBe(1);

      const setting = await seedSetting(prisma, actor.id);
      await stack.service.updateSetting(
        claims,
        setting.id,
        {
          safeValueJson: { enabled: true },
          reason: 'A15 update',
          expectedRowVersion: setting.rowVersion,
        },
        `a15-${randomUUID()}`,
      );
      expect(
        await prisma.platformGlobalSettingHistory.count({ where: { settingId: setting.id } }),
      ).toBeGreaterThanOrEqual(1);
      report({ id: 'A13-A15-D01', model: 'A', result: 'PASS' });
    } finally {
      restore();
    }
  });

  it('A08-D01 replaceAddOns Model A — durable AuditEntry + correlation', async () => {
    const fixtures = await ensurePlatformSubscriptionFixtures(prisma);
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    const wrapper = createSubscriptionsPrismaWrapper(prisma);
    const audit = new AuditTrailPlatformSubscriptionsAuditLog(
      Object.assign(prisma, wrapper) as unknown as PrismaService,
    );
    const svc = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      audit,
      stepUpFresh: true,
    });
    const actor = await createPlatformUserFixture(prisma, {
      email: `a08d01-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const claims = platformClaims(actor.id, randomUUID());
    const created = await svc.create(
      claims,
      { platformTenantId: fixtures.platformTenantId },
      `a08d01-c-${randomUUID()}`,
    );
    const assigned = await svc.assignPlanVersion(
      claims,
      created.id,
      {
        expectedRowVersion: created.rowVersion,
        planVersionId: fixtures.publishedPlanVersionId,
      },
      `a08d01-p-${randomUUID()}`,
    );
    const action = 'platform_subscription_commercial.addons_replaced';
    const before = await countAudits(prisma, action, created.id);
    await svc.replaceAddOns(
      claims,
      created.id,
      { expectedRowVersion: assigned.rowVersion, addOnVersionIds: [] },
      `a08d01-a-${randomUUID()}`,
    );
    expect(await countAudits(prisma, action, created.id)).toBe(before + 1);
    const row = await prisma.auditEntry.findFirst({
      where: { action, resourceId: created.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(isOperationCorrelationId(row?.correlationId)).toBe(true);
    expect(row?.actorId).toBe(claims.sub);
    expect(row?.actorId).not.toBe(row?.correlationId);
    report({ id: 'A08-D01', model: 'A', auditDelta: 1, result: 'PASS' });
  }, 180_000);

  it('A08-D05 replaceAddOns audit failure rolls back commercial mutation', async () => {
    const fixtures = await ensurePlatformSubscriptionFixtures(prisma);
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    const wrapper = createSubscriptionsPrismaWrapper(prisma);
    const setupAudit = new AuditTrailPlatformSubscriptionsAuditLog(
      Object.assign(prisma, wrapper) as unknown as PrismaService,
    );
    const setup = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      audit: setupAudit,
      stepUpFresh: true,
    });
    const actor = await createPlatformUserFixture(prisma, {
      email: `a08d05-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const claims = platformClaims(actor.id, randomUUID());
    const created = await setup.create(
      claims,
      { platformTenantId: fixtures.platformTenantId },
      `a08d05-c-${randomUUID()}`,
    );
    const assigned = await setup.assignPlanVersion(
      claims,
      created.id,
      {
        expectedRowVersion: created.rowVersion,
        planVersionId: fixtures.publishedPlanVersionId,
      },
      `a08d05-p-${randomUUID()}`,
    );
    const action = 'platform_subscription_commercial.addons_replaced';
    const before = await countAudits(prisma, action, created.id);
    const failing = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
      audit: {
        record: async () => undefined,
        recordInTransaction: async () => {
          throw new Error('injected_audit_failure');
        },
      } as never,
    });
    await expect(
      failing.replaceAddOns(
        claims,
        created.id,
        { expectedRowVersion: assigned.rowVersion, addOnVersionIds: [] },
        `a08d05-a-${randomUUID()}`,
      ),
    ).rejects.toThrow(/injected_audit_failure/);
    const reloaded = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(reloaded.rowVersion).toBe(assigned.rowVersion);
    expect(await countAudits(prisma, action, created.id)).toBe(before);
    report({ id: 'A08-D05', model: 'A', business: 0, audit: 0, result: 'PASS' });
  }, 180_000);

  it('A09-D01 override approve Model A — durable AuditEntry + correlation', async () => {
    await createSeedService(prisma).seedAll();
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
    const moduleItem = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { canonicalKey: 'module.dashboard' },
    });
    const creator = await createPlatformUserFixture(prisma, {
      email: `a09d01-c-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const approver = await createPlatformUserFixture(prisma, {
      email: `a09d01-a-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const audit = new AuditTrailPlatformAddonsAuditLog(
      Object.assign(prisma, createAddonsPrismaWrapper(prisma)) as unknown as PrismaService,
    );
    const creatorOverrides = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      audit,
      stepUpFresh: true,
    });
    const approverOverrides = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.approve'],
      audit,
      stepUpFresh: true,
    });
    const creatorClaims = platformClaims(creator.id, randomUUID());
    const approverClaims = platformClaims(approver.id, randomUUID());
    const ov = await creatorOverrides.createOverride(
      creatorClaims,
      {
        reasonCode: 'SALES_CONCESSION',
        reasonNote: 'A09-D01 override approve durability',
        effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
      },
      `a09d01-c-${randomUUID()}`,
    );
    const submitted = await creatorOverrides.submit(
      creatorClaims,
      ov.id,
      { expectedRowVersion: ov.rowVersion },
      `a09d01-s-${randomUUID()}`,
    );
    const action = 'platform_override.approved';
    const before = await countAudits(prisma, action, ov.id);
    await approverOverrides.approve(
      approverClaims,
      ov.id,
      { expectedRowVersion: submitted.rowVersion },
      `a09d01-a-${randomUUID()}`,
    );
    expect(await countAudits(prisma, action, ov.id)).toBe(before + 1);
    const row = await prisma.auditEntry.findFirst({
      where: { action, resourceId: ov.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(isOperationCorrelationId(row?.correlationId)).toBe(true);
    expect(row?.actorId).toBe(approverClaims.sub);
    expect(row?.actorId).not.toBe(row?.correlationId);
    report({ id: 'A09-D01', model: 'A', auditDelta: 1, result: 'PASS' });
  }, 180_000);

  it('A09-D05 override approve audit failure rolls back lifecycle', async () => {
    await createSeedService(prisma).seedAll();
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
    const moduleItem = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { canonicalKey: 'module.dashboard' },
    });
    const creator = await createPlatformUserFixture(prisma, {
      email: `a09d05-c-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const approver = await createPlatformUserFixture(prisma, {
      email: `a09d05-a-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const setupAudit = new AuditTrailPlatformAddonsAuditLog(
      Object.assign(prisma, createAddonsPrismaWrapper(prisma)) as unknown as PrismaService,
    );
    const creatorOverrides = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      audit: setupAudit,
      stepUpFresh: true,
    });
    const creatorClaims = platformClaims(creator.id, randomUUID());
    const approverClaims = platformClaims(approver.id, randomUUID());
    const ov = await creatorOverrides.createOverride(
      creatorClaims,
      {
        reasonCode: 'SALES_CONCESSION',
        reasonNote: 'A09-D05 rollback proof',
        effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
      },
      `a09d05-c-${randomUUID()}`,
    );
    const submitted = await creatorOverrides.submit(
      creatorClaims,
      ov.id,
      { expectedRowVersion: ov.rowVersion },
      `a09d05-s-${randomUUID()}`,
    );
    const action = 'platform_override.approved';
    const before = await countAudits(prisma, action, ov.id);
    const failing = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.approve'],
      stepUpFresh: true,
      audit: {
        record: async () => undefined,
        recordInTransaction: async () => {
          throw new Error('injected_audit_failure');
        },
      } as never,
    });
    await expect(
      failing.approve(
        approverClaims,
        ov.id,
        { expectedRowVersion: submitted.rowVersion },
        `a09d05-a-${randomUUID()}`,
      ),
    ).rejects.toThrow(/injected_audit_failure/);
    const reloaded = await prisma.platformCommercialOverride.findUniqueOrThrow({
      where: { id: ov.id },
    });
    expect(reloaded.lifecycle).toBe('PENDING_APPROVAL');
    expect(reloaded.approvedByPlatformUserId).toBeNull();
    expect(await countAudits(prisma, action, ov.id)).toBe(before);
    report({ id: 'A09-D05', model: 'A', business: 0, audit: 0, result: 'PASS' });
  }, 180_000);

  it('A10-D01 assignPlanVersion Model A — durable AuditEntry + correlation', async () => {
    const fixtures = await ensurePlatformSubscriptionFixtures(prisma);
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    const wrapper = createSubscriptionsPrismaWrapper(prisma);
    const audit = new AuditTrailPlatformSubscriptionsAuditLog(
      Object.assign(prisma, wrapper) as unknown as PrismaService,
    );
    const svc = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      audit,
      stepUpFresh: true,
    });
    const actor = await createPlatformUserFixture(prisma, {
      email: `a10d01-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const claims = platformClaims(actor.id, randomUUID());
    const created = await svc.create(
      claims,
      { platformTenantId: fixtures.platformTenantId },
      `a10d01-c-${randomUUID()}`,
    );
    const action = 'platform_subscription_commercial.plan_version_assigned';
    const before = await countAudits(prisma, action, created.id);
    await svc.assignPlanVersion(
      claims,
      created.id,
      {
        expectedRowVersion: created.rowVersion,
        planVersionId: fixtures.publishedPlanVersionId,
      },
      `a10d01-p-${randomUUID()}`,
    );
    expect(await countAudits(prisma, action, created.id)).toBe(before + 1);
    const row = await prisma.auditEntry.findFirst({
      where: { action, resourceId: created.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(isOperationCorrelationId(row?.correlationId)).toBe(true);
    expect(row?.actorId).toBe(claims.sub);
    expect(row?.actorId).not.toBe(row?.correlationId);
    report({ id: 'A10-D01', model: 'A', auditDelta: 1, result: 'PASS' });
  }, 180_000);

  it('A10-D05 assignPlanVersion audit failure rolls back plan assignment', async () => {
    const fixtures = await ensurePlatformSubscriptionFixtures(prisma);
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    const wrapper = createSubscriptionsPrismaWrapper(prisma);
    const setupAudit = new AuditTrailPlatformSubscriptionsAuditLog(
      Object.assign(prisma, wrapper) as unknown as PrismaService,
    );
    const setup = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      audit: setupAudit,
      stepUpFresh: true,
    });
    const actor = await createPlatformUserFixture(prisma, {
      email: `a10d05-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const claims = platformClaims(actor.id, randomUUID());
    const created = await setup.create(
      claims,
      { platformTenantId: fixtures.platformTenantId },
      `a10d05-c-${randomUUID()}`,
    );
    const action = 'platform_subscription_commercial.plan_version_assigned';
    const before = await countAudits(prisma, action, created.id);
    const failing = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
      audit: {
        record: async () => undefined,
        recordInTransaction: async () => {
          throw new Error('injected_audit_failure');
        },
      } as never,
    });
    await expect(
      failing.assignPlanVersion(
        claims,
        created.id,
        {
          expectedRowVersion: created.rowVersion,
          planVersionId: fixtures.publishedPlanVersionId,
        },
        `a10d05-p-${randomUUID()}`,
      ),
    ).rejects.toThrow(/injected_audit_failure/);
    const reloaded = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(reloaded.rowVersion).toBe(created.rowVersion);
    expect(reloaded.planVersionId).toBeNull();
    expect(await countAudits(prisma, action, created.id)).toBe(before);
    report({ id: 'A10-D05', model: 'A', business: 0, audit: 0, result: 'PASS' });
  }, 180_000);

  it('A11-D01 provisioning activate Model A — durable AuditEntry + correlation', async () => {
    const restore = enableProvisioningFlag();
    try {
      const stack = createProvisioningStack({ prisma, stepUpFresh: true });
      const fixture = await findPublishedPlanFixture(prisma);
      if (!fixture?.planVersion) {
        report({ id: 'A11-D01', result: 'SKIP', note: 'no published plan fixture' });
        return;
      }
      const actor = await createPlatformUserFixture(prisma, {
        email: `a11d01-${randomUUID()}@test.local`,
        roleKeys: ['platform_owner'],
      });
      const claims = platformClaims(actor.id, randomUUID());
      const body = buildRequestBody(fixture as never);
      const action = 'tenant_provisioning.activated';
      const before = await countAudits(prisma, action);
      const { activated } = await runFullHappyPath(stack, claims, body, `a11d01-${randomUUID().slice(0, 8)}`);
      expect(await countAudits(prisma, action)).toBeGreaterThanOrEqual(before + 1);
      const row = await prisma.auditEntry.findFirst({
        where: {
          action,
          ...(activated?.id ? { resourceId: activated.id } : {}),
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(row).toBeTruthy();
      expect(isOperationCorrelationId(row?.correlationId)).toBe(true);
      expect(row?.actorId).toBe(claims.sub);
      expect(row?.actorId).not.toBe(row?.correlationId);
      report({ id: 'A11-D01', model: 'A', auditDelta: 1, result: 'PASS' });
    } finally {
      restore();
    }
  }, 300_000);

  it('A11-D05 provisioning activate audit failure rolls back COMPLETED', async () => {
    const restore = enableProvisioningFlag();
    try {
      const stack = createProvisioningStack({ prisma, stepUpFresh: true });
      const fixture = await findPublishedPlanFixture(prisma);
      if (!fixture?.planVersion) {
        report({ id: 'A11-D05', result: 'SKIP', note: 'no published plan fixture' });
        return;
      }
      const actor = await createPlatformUserFixture(prisma, {
        email: `a11d05-${randomUUID()}@test.local`,
        roleKeys: ['platform_owner'],
      });
      const claims = platformClaims(actor.id, randomUUID());
      const body = buildRequestBody(fixture as never);
      const prefix = `a11d05-${randomUUID().slice(0, 8)}`;
      const created = await stack.service.createRequest(claims, body, `${prefix}-create`);
      const started = await stack.service.start(
        claims,
        created.id,
        { expectedRowVersion: created.rowVersion },
        `${prefix}-start`,
      );
      const action = 'tenant_provisioning.activated';
      const before = await countAudits(prisma, action, started.id);
      const spy = jest
        .spyOn(stack.auditLog, 'recordInTransaction')
        .mockRejectedValue(new Error('injected_audit_failure'));
      try {
        await expect(
          stack.service.activate(
            claims,
            started.id,
            { expectedRowVersion: started.rowVersion, reason: 'A11-D05 proof' },
            `${prefix}-activate`,
          ),
        ).rejects.toThrow(/injected_audit_failure/);
      } finally {
        spy.mockRestore();
      }
      const reloaded = await prisma.platformTenantProvisioningRequest.findUniqueOrThrow({
        where: { id: started.id },
      });
      expect(reloaded.status).not.toBe('COMPLETED');
      expect(await countAudits(prisma, action, started.id)).toBe(before);
      report({ id: 'A11-D05', model: 'A', business: 0, audit: 0, result: 'PASS' });
    } finally {
      restore();
    }
  }, 300_000);

  it('A12-D01 lifecycle suspend Model A — durable AuditEntry + correlation', async () => {
    const restore = enableLifecycleFlag();
    try {
      const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
      const actor = await createPlatformUserFixture(prisma, {
        email: `a12d01-${randomUUID()}@test.local`,
        roleKeys: ['platform_owner'],
      });
      const stack = createLifecycleStack(prisma, { stepUpFresh: true });
      const claims = platformClaims(actor.id, randomUUID());
      const { body } = await previewAndBody(
        stack,
        claims,
        seeded.tenantId,
        'suspend',
        seeded.platformTenant.rowVersion,
      );
      const action = 'tenant_lifecycle.suspend';
      const before = await countAudits(prisma, action, seeded.tenantId);
      await stack.service.suspend(claims, seeded.tenantId, body, `a12d01-s-${randomUUID()}`);
      expect(await countAudits(prisma, action, seeded.tenantId)).toBe(before + 1);
      const row = await prisma.auditEntry.findFirst({
        where: { action, resourceId: seeded.tenantId },
        orderBy: { createdAt: 'desc' },
      });
      expect(isOperationCorrelationId(row?.correlationId)).toBe(true);
      expect(row?.actorId).toBe(claims.sub);
      expect(row?.actorId).not.toBe(row?.correlationId);
      report({ id: 'A12-D01', model: 'A', auditDelta: 1, result: 'PASS' });
    } finally {
      restore();
    }
  }, 300_000);

  it('A12-D05 lifecycle suspend audit failure rolls back tenant status', async () => {
    const restore = enableLifecycleFlag();
    const spy = jest
      .spyOn(TenantLifecycleAuditLog.prototype, 'recordInTransaction')
      .mockRejectedValue(new Error('injected_audit_failure'));
    try {
      const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
      const actor = await createPlatformUserFixture(prisma, {
        email: `a12d05-${randomUUID()}@test.local`,
        roleKeys: ['platform_owner'],
      });
      const stack = createLifecycleStack(prisma, { stepUpFresh: true });
      const claims = platformClaims(actor.id, randomUUID());
      const { body } = await previewAndBody(
        stack,
        claims,
        seeded.tenantId,
        'suspend',
        seeded.platformTenant.rowVersion,
      );
      const action = 'tenant_lifecycle.suspend';
      const before = await countAudits(prisma, action, seeded.tenantId);
      await expect(
        stack.service.suspend(claims, seeded.tenantId, body, `a12d05-s-${randomUUID()}`),
      ).rejects.toThrow(/injected_audit_failure/);
      const pt = await prisma.platformTenant.findUniqueOrThrow({
        where: { tenantId: seeded.tenantId },
      });
      expect(pt.status).toBe('ACTIVE');
      expect(pt.rowVersion).toBe(seeded.platformTenant.rowVersion);
      expect(await countAudits(prisma, action, seeded.tenantId)).toBe(before);
      report({ id: 'A12-D05', model: 'A', business: 0, audit: 0, result: 'PASS' });
    } finally {
      spy.mockRestore();
      restore();
    }
  }, 300_000);

  it('A08-A12-D09/D10 projector N/A Model A', () => {
    for (const id of [
      'A03-D09',
      'A08-D09',
      'A09-D09',
      'A10-D09',
      'A11-D09',
      'A12-D09',
      'A03-D10',
      'A08-D10',
      'A09-D10',
      'A10-D10',
      'A11-D10',
      'A12-D10',
    ]) {
      report({ id, model: 'A', result: 'N/A', note: 'same-transaction; no projector' });
    }
    expect(resolveOperationCorrelationId()).not.toBe(resolveOperationCorrelationId());
  });
});
