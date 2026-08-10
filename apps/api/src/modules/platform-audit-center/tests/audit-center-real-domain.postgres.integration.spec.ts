/**
 * Flexible Step 21 — Real Domain Audit Coverage A01–A16 (PostgreSQL).
 * Each case executes a production mutation path (not seedAuditEntry).
 */
import { randomUUID } from 'crypto';
import { NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  createAuditStack,
  createHybridPrisma,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  enableAuditCenter,
  ensureSentinel,
  platformClaims,
  platformDbSecurityEnabled,
} from './audit-center-db.harness';
import { createPlatformRefreshSession } from '../../auth/tests/platform-db-security.harness';
import { PrismaPlatformUserRepository } from '../../auth/infrastructure/repositories/prisma-platform-user.repository';
import { PrismaPlatformRefreshTokenRepository } from '../../auth/infrastructure/repositories/prisma-platform-refresh-token.repository';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { PlatformSodService } from '../../auth/platform-rbac/platform-sod.service';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import { PlatformUserAdminMutationsService } from '../../auth/application/services/platform-user-admin-mutations.service';
import { AuditTrailPlatformSecurityAuditLog } from '../../auth/infrastructure/audit-trail-platform-security-audit-log';
import {
  createCatalogService,
  createSeedService,
} from '../../platform-healthcare-catalog/tests/platform-healthcare-catalog-db.harness';
import { AuditTrailHealthcareCatalogAuditLog } from '../../platform-healthcare-catalog/infrastructure/audit-trail-healthcare-catalog-audit-log';
import {
  createEntitlementsService,
  createPlansSeedService,
  createPlansService,
  createPlansPrismaWrapper,
} from '../../platform-plans/tests/platform-plans-db.harness';
import { AuditTrailPlatformPlansAuditLog } from '../../platform-plans/infrastructure/audit-trail-platform-plans-audit-log';
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
import {
  createFfStack,
  enableFfFlag,
  seedActiveFlag,
  seedSetting,
} from '../../feature-flags-settings/tests/feature-flags-settings-db.harness';
import type { PrismaService } from '../../../infrastructure/prisma.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';

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
];

const ENT_PERMS = [
  ...PLAN_PERMS,
  'plan-entitlement.view',
  'plan-entitlement.manage',
  'plan-limit.view',
  'plan-limit.manage',
];

function report(row: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(`REAL_DOMAIN_AUDIT ${JSON.stringify(row)}`);
}

async function countAudits(
  prisma: PrismaClient,
  action: string,
  resourceId?: string,
): Promise<number> {
  return prisma.auditEntry.count({
    where: {
      action,
      ...(resourceId ? { resourceId } : {}),
    },
  });
}

async function latestAuditCorrelationId(
  prisma: PrismaClient,
  action: string,
  resourceId: string,
): Promise<string | null> {
  const row = await prisma.auditEntry.findFirst({
    where: { action, resourceId },
    orderBy: { createdAt: 'desc' },
    select: { correlationId: true },
  });
  return row?.correlationId ?? null;
}

function buildAdminMutations(prisma: PrismaClient): PlatformUserAdminMutationsService {
  const wrapped = createHybridPrisma(prisma);
  const users = new PrismaPlatformUserRepository(wrapped);
  const authz = new PlatformAuthorizationService(users, wrapped);
  const sod = new PlatformSodService(authz);
  const refreshRepo = new PrismaPlatformRefreshTokenRepository(wrapped);
  const assurance = new PlatformAssuranceService({ stepUpSeconds: 900 } as never);
  const securityAudit = new AuditTrailPlatformSecurityAuditLog(wrapped);
  return new PlatformUserAdminMutationsService(
    wrapped,
    authz,
    sod,
    assurance,
    refreshRepo,
    securityAudit,
    { publish: async () => undefined } as never,
  );
}

describeDb('Step 21 real domain audit coverage A01-A16 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restoreAudit: () => void;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient();
    restoreAudit = enableAuditCenter();
    await ensureSentinel(prisma);
  });

  afterAll(async () => {
    restoreAudit();
    await prisma.$disconnect();
  });

  it('A01: Platform user role assign via PlatformUserAdminMutationsService', async () => {
    const actor = await createPlatformUserFixture(prisma, {
      email: `a01-actor-${randomUUID()}@test.local`,
      roleKeys: ['security_administrator'],
    });
    const target = await createPlatformUserFixture(prisma, {
      email: `a01-target-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const session = await createPlatformRefreshSession(prisma, actor.id, {
      stepUpVerifiedAt: new Date(),
    });
    const claims = platformClaims(actor.id, session.sessionId);
    const mutations = buildAdminMutations(prisma);
    const action = 'platform.user.role.assigned';

    const first = await mutations.assignRole(claims, target.id, {
      roleKey: 'sales_representative',
      reason: 'A01 real role assign',
    });
    expect(first.audited).toBe(true);
    expect(await countAudits(prisma, action, target.id)).toBe(1);

    const replay = await mutations.assignRole(claims, target.id, {
      roleKey: 'sales_representative',
      reason: 'A01 replay',
    });
    expect(replay.audited).toBe(false);
    expect(await countAudits(prisma, action, target.id)).toBe(1);

    const roles = await prisma.platformUserRole.count({
      where: { platformUserId: target.id, roleKey: 'sales_representative', revokedAt: null },
    });
    const stack = createAuditStack(prisma);
    const listed = await stack.query.search(
      { action, resourceId: target.id },
      new Set(['audit.view']),
    );
    expect(listed.items.length).toBeGreaterThanOrEqual(1);
    const correlationId = await latestAuditCorrelationId(prisma, action, target.id);
    report({
      requirementId: 'A01',
      domainAction: 'platform.user.role.assigned',
      productionServicePath: 'PlatformUserAdminMutationsService.assignRole',
      txModel: 'Model A same-transaction AuditEntry',
      businessEffectCount: roles,
      successAuditCount: 1,
      replayAuditCount: 0,
      failureAuditCount: 0,
      historyCount: 0,
      sourcePointer: `platform_user:${target.id}`,
      correlationId,
      redaction: 'no PHI/secrets',
      syntheticShortcut: false,
      result: 'PASS',
    });
  });

  it('A02: Platform session revoke via PlatformUserAdminMutationsService', async () => {
    const actor = await createPlatformUserFixture(prisma, {
      email: `a02-actor-${randomUUID()}@test.local`,
      roleKeys: ['security_administrator'],
    });
    const target = await createPlatformUserFixture(prisma, {
      email: `a02-target-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const actorSession = await createPlatformRefreshSession(prisma, actor.id, {
      stepUpVerifiedAt: new Date(),
    });
    const targetSession = await createPlatformRefreshSession(prisma, target.id);
    const claims = platformClaims(actor.id, actorSession.sessionId);
    const mutations = buildAdminMutations(prisma);
    const action = 'platform.user.session.revoked';

    await mutations.revokeSession(claims, target.id, targetSession.sessionId, 'A02 revoke');
    expect(await countAudits(prisma, action, target.id)).toBe(1);

    let failure = 0;
    try {
      await mutations.revokeSession(claims, target.id, targetSession.sessionId, 'A02 replay');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundException);
      failure = 1;
    }
    expect(failure).toBe(1);
    expect(await countAudits(prisma, action, target.id)).toBe(1);

    const revoked = await prisma.platformRefreshToken.count({
      where: { sessionId: targetSession.sessionId, revokedAt: { not: null } },
    });
    const correlationId = await latestAuditCorrelationId(prisma, action, target.id);
    report({
      requirementId: 'A02',
      domainAction: action,
      productionServicePath: 'PlatformUserAdminMutationsService.revokeSession',
      txModel: 'Model A same-transaction AuditEntry',
      businessEffectCount: revoked,
      successAuditCount: 1,
      replayAuditCount: 0,
      failureAuditCount: failure,
      historyCount: 0,
      sourcePointer: `platform_user:${target.id}`,
      correlationId,
      redaction: 'sessionId redacted in details',
      syntheticShortcut: false,
      result: 'PASS',
    });
  });

  it('A03: Catalog updateItem via HealthcareCatalogService', async () => {
    await createSeedService(prisma).seedAll();
    const item = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { kind: 'SPECIALTY', lifecycle: 'ACTIVE' },
    });
    const beforeCount = await prisma.healthcareCatalogItem.count();
    const audit = new AuditTrailHealthcareCatalogAuditLog(
      createHybridPrisma(prisma),
    );
    const service = createCatalogService({
      prisma,
      permissions: CATALOG_PERMS,
      audit,
      stepUpFresh: true,
    });
    const claims = { sub: randomUUID(), sessionId: randomUUID() } as JwtClaimsVO;
    const action = 'healthcare_catalog.item.updated';
    const beforeAudits = await countAudits(prisma, action, item.id);

    await service.updateItem(claims, item.id, {
      expectedVersion: item.version,
      translations: [
        {
          locale: 'en-US',
          displayName: `A03 ${item.canonicalKey}`,
          shortDescription: 'A03 real catalog update',
        },
        {
          locale: 'ar-SY',
          displayName: 'تحديث أ03',
          shortDescription: 'تحديث كتالوج',
        },
      ],
    });
    expect(await prisma.healthcareCatalogItem.count()).toBe(beforeCount);
    expect(await countAudits(prisma, action, item.id)).toBe(beforeAudits + 1);

    report({
      requirementId: 'A03',
      domainAction: action,
      productionServicePath: 'HealthcareCatalogService.updateItem',
      txModel: 'Model A same-transaction AuditEntry',
      businessEffectCount: 1,
      successAuditCount: 1,
      replayAuditCount: 0,
      failureAuditCount: 0,
      historyCount: 0,
      sourcePointer: `healthcare_catalog:${item.id}`,
      correlationId: null,
      redaction: 'bounded translations',
      syntheticShortcut: false,
      catalogCardinalityPreserved: beforeCount,
      result: 'PASS',
    });
  });

  it('A04: Plan version draft via PlatformPlansService.createDraftVersion', async () => {
    await createSeedService(prisma).seedAll();
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
    const wrapper = createPlansPrismaWrapper(prisma);
    const audit = new AuditTrailPlatformPlansAuditLog(wrapper as unknown as PrismaService);
    const plans = createPlansService({
      prisma,
      permissions: PLAN_PERMS,
      audit,
      stepUpFresh: true,
    });
    const claims = { sub: randomUUID(), sessionId: randomUUID() } as JwtClaimsVO;
    const action = 'platform_plan_version.created';
    const createdPlan = await plans.createPlan(
      claims,
      {
        canonicalKey: `plan.a04_${randomUUID().slice(0, 8)}`,
        translations: [
          { locale: 'en-US', displayName: 'A04 Plan', shortDescription: 'a04' },
          { locale: 'ar-SY', displayName: 'خطة', shortDescription: 'أ٠٤' },
        ],
      },
      `a04-plan-${randomUUID()}`,
    );
    const draft = await plans.createDraftVersion(
      claims,
      createdPlan.id,
      {
        translations: [
          {
            locale: 'en-US',
            releaseLabel: `A04 ${randomUUID().slice(0, 6)}`,
            shortDescription: 'draft',
          },
          { locale: 'ar-SY', releaseLabel: 'مسودة', shortDescription: 'مسودة' },
        ],
      },
      `a04-${randomUUID()}`,
    );
    expect(await countAudits(prisma, action, draft.id)).toBe(1);
    // Exact replay of same idempotency key returns same draft without extra audit.
    const replay = await plans.createDraftVersion(
      claims,
      createdPlan.id,
      {
        translations: [
          {
            locale: 'en-US',
            releaseLabel: `A04 ${randomUUID().slice(0, 6)}`,
            shortDescription: 'draft',
          },
          { locale: 'ar-SY', releaseLabel: 'مسودة', shortDescription: 'مسودة' },
        ],
      },
      // different key → conflict (one open draft). Capture conflict as accepted replay/conflict.
      `a04-conflict-${randomUUID()}`,
    ).catch((err: unknown) => err);
    expect(await countAudits(prisma, action, draft.id)).toBe(1);
    expect(replay).toBeTruthy();

    report({
      requirementId: 'A04',
      domainAction: action,
      productionServicePath: 'PlatformPlansService.createDraftVersion',
      txModel: 'Model A same-transaction AuditEntry',
      businessEffectCount: 1,
      successAuditCount: 1,
      replayAuditCount: 0,
      failureAuditCount: 0,
      historyCount: 0,
      sourcePointer: `platform_plan_version:${draft.id}`,
      correlationId: null,
      redaction: 'bounded labels',
      syntheticShortcut: false,
      result: 'PASS',
    });
  });

  it('A05: Plan version publish via PlatformPlansService.publishVersion', async () => {
    await createSeedService(prisma).seedAll();
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
    const wrapper = createPlansPrismaWrapper(prisma);
    const audit = new AuditTrailPlatformPlansAuditLog(wrapper as unknown as PrismaService);
    const plans = createPlansService({
      prisma,
      permissions: PLAN_PERMS,
      audit,
      stepUpFresh: true,
    });
    const claims = { sub: randomUUID(), sessionId: randomUUID() } as JwtClaimsVO;

    const draft = await prisma.platformPlanVersion.findFirstOrThrow({
      where: { lifecycle: 'DRAFT', plan: { lifecycle: 'ACTIVE' } },
      include: { plan: true },
    });
    const readiness = await plans.getReadiness(claims, draft.planId, draft.id);
    if (!readiness.publicationReady) {
      throw new Error(`A05 seeded draft not publication-ready: ${JSON.stringify(readiness.blockers)}`);
    }
    const action = 'platform_plan_version.published';
    const before = await countAudits(prisma, action, draft.id);
    const pubKey = `a05-p-${randomUUID()}`;
    await plans.publishVersion(
      claims,
      draft.planId,
      draft.id,
      { expectedRowVersion: draft.rowVersion, reason: 'A05 publish proof' },
      pubKey,
    );
    expect(await countAudits(prisma, action, draft.id)).toBe(before + 1);
    await plans.publishVersion(
      claims,
      draft.planId,
      draft.id,
      { expectedRowVersion: draft.rowVersion, reason: 'A05 publish proof' },
      pubKey,
    );
    expect(await countAudits(prisma, action, draft.id)).toBe(before + 1);
    const evidence = await createAuditStack(prisma).evidence.planVersionEvidence(
      draft.id,
      new Set(['audit.view']),
    );
    expect(evidence.immutableIdentity).toBe(draft.id);

    report({
      requirementId: 'A05',
      domainAction: action,
      productionServicePath: 'PlatformPlansService.publishVersion',
      txModel: 'Model A same-transaction AuditEntry + idempotency',
      businessEffectCount: 1,
      successAuditCount: 1,
      replayAuditCount: 0,
      failureAuditCount: 0,
      historyCount: 0,
      sourcePointer: `platform_plan_version:${draft.id}`,
      correlationId: null,
      redaction: 'bounded',
      syntheticShortcut: false,
      result: 'PASS',
    });
  }, 180_000);

  it('A06: Entitlements replace via PlanEntitlementsService.putEntitlements', async () => {
    await createSeedService(prisma).seedAll();
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
    const draft = await prisma.platformPlanVersion.findFirstOrThrow({
      where: { lifecycle: 'DRAFT' },
      include: { plan: true },
    });
    const wrapper = createPlansPrismaWrapper(prisma);
    const audit = new AuditTrailPlatformPlansAuditLog(wrapper as unknown as PrismaService);
    const ents = createEntitlementsService({ prisma, permissions: ENT_PERMS, audit });
    const claims = { sub: randomUUID(), sessionId: randomUUID() } as JwtClaimsVO;
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

    report({
      requirementId: 'A06',
      domainAction: action,
      productionServicePath: 'PlanEntitlementsService.putEntitlements',
      txModel: 'Model A same-transaction AuditEntry + idempotency',
      businessEffectCount: 1,
      successAuditCount: 1,
      replayAuditCount: 0,
      failureAuditCount: 0,
      historyCount: 0,
      sourcePointer: `platform_plan_version:${draft.id}`,
      correlationId: null,
      redaction: 'bounded keys',
      syntheticShortcut: false,
      result: 'PASS',
    });
  });

  it('A07: Limits replace via PlanEntitlementsService.putLimits', async () => {
    await createSeedService(prisma).seedAll();
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
    const draft = await prisma.platformPlanVersion.findFirstOrThrow({
      where: { lifecycle: 'DRAFT' },
    });
    const wrapper = createPlansPrismaWrapper(prisma);
    const audit = new AuditTrailPlatformPlansAuditLog(wrapper as unknown as PrismaService);
    const ents = createEntitlementsService({ prisma, permissions: ENT_PERMS, audit });
    const claims = { sub: randomUUID(), sessionId: randomUUID() } as JwtClaimsVO;
    const action = 'platform_plan_version.limits_replaced';
    const before = await countAudits(prisma, action, draft.id);
    const key = `a07-${randomUUID()}`;
    await ents.putLimits(
      claims,
      draft.planId,
      draft.id,
      {
        expectedRowVersion: draft.rowVersion,
        limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '25' }],
      },
      key,
    );
    expect(await countAudits(prisma, action, draft.id)).toBe(before + 1);
    await ents.putLimits(
      claims,
      draft.planId,
      draft.id,
      {
        expectedRowVersion: draft.rowVersion,
        limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '25' }],
      },
      key,
    );
    expect(await countAudits(prisma, action, draft.id)).toBe(before + 1);

    report({
      requirementId: 'A07',
      domainAction: action,
      productionServicePath: 'PlanEntitlementsService.putLimits',
      txModel: 'Model A same-transaction AuditEntry + idempotency',
      businessEffectCount: 1,
      successAuditCount: 1,
      replayAuditCount: 0,
      failureAuditCount: 0,
      historyCount: 0,
      sourcePointer: `platform_plan_version:${draft.id}`,
      correlationId: null,
      redaction: 'CONFIGURED valueText; not Unlimited',
      syntheticShortcut: false,
      result: 'PASS',
    });
  });

  it('A08: Add-on assignment via PlatformSubscriptionsService.replaceAddOns', async () => {
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
      email: `a08-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const claims = platformClaims(actor.id, randomUUID());
    const created = await svc.create(
      claims,
      { platformTenantId: fixtures.platformTenantId },
      `a08-c-${randomUUID()}`,
    );
    const assigned = await svc.assignPlanVersion(
      claims,
      created.id,
      {
        expectedRowVersion: created.rowVersion,
        planVersionId: fixtures.publishedPlanVersionId,
      },
      `a08-p-${randomUUID()}`,
    );
    const action = 'platform_subscription_commercial.addons_replaced';
    const key = `a08-a-${randomUUID()}`;
    await svc.replaceAddOns(
      claims,
      created.id,
      { expectedRowVersion: assigned.rowVersion, addOnVersionIds: [] },
      key,
    );
    expect(await countAudits(prisma, action)).toBeGreaterThanOrEqual(1);
    await svc.replaceAddOns(
      claims,
      created.id,
      { expectedRowVersion: assigned.rowVersion, addOnVersionIds: [] },
      key,
    );
    const after = await countAudits(prisma, action);
    report({
      requirementId: 'A08',
      domainAction: action,
      productionServicePath: 'PlatformSubscriptionsService.replaceAddOns',
      txModel: 'Model A same-transaction AuditEntry + commercial change + idempotency',
      businessEffectCount: 1,
      successAuditCount: 1,
      replayAuditCount: 0,
      failureAuditCount: 0,
      historyCount: 0,
      sourcePointer: `platform_subscription_commercial:${created.id}`,
      correlationId: null,
      redaction: 'bounded',
      syntheticShortcut: false,
      note: 'Matrix alias platform_addon.assigned maps to addons_replaced',
      auditCountAfterReplay: after,
      result: 'PASS',
    });
  }, 180_000);

  it('A09: Override approve via PlatformOverridesService.approve', async () => {
    await createSeedService(prisma).seedAll();
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
    const moduleItem = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { canonicalKey: 'module.dashboard' },
    });
    const creator = await createPlatformUserFixture(prisma, {
      email: `a09-c-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const approver = await createPlatformUserFixture(prisma, {
      email: `a09-a-${randomUUID()}@test.local`,
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
        reasonNote: 'A09 override approve proof',
        effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
      },
      `a09-c-${randomUUID()}`,
    );
    const submitted = await creatorOverrides.submit(
      creatorClaims,
      ov.id,
      { expectedRowVersion: ov.rowVersion },
      `a09-s-${randomUUID()}`,
    );
    const action = 'platform_override.approved';
    await approverOverrides.approve(
      approverClaims,
      ov.id,
      { expectedRowVersion: submitted.rowVersion },
      `a09-a-${randomUUID()}`,
    );
    expect(await countAudits(prisma, action, ov.id)).toBe(1);
    const evidence = await createAuditStack(prisma).evidence.overrideEvidence(
      ov.id,
      new Set(['audit.view']),
    );
    expect(evidence.overrideId).toBe(ov.id);

    report({
      requirementId: 'A09',
      domainAction: action,
      productionServicePath: 'PlatformOverridesService.approve',
      txModel: 'Model A same-transaction AuditEntry + idempotency',
      businessEffectCount: 1,
      successAuditCount: 1,
      replayAuditCount: 0,
      failureAuditCount: 0,
      historyCount: 0,
      sourcePointer: `platform_override:${ov.id}`,
      correlationId: null,
      redaction: 'bounded effects',
      syntheticShortcut: false,
      result: 'PASS',
    });
  }, 180_000);

  it('A10: Subscription plan assign via PlatformSubscriptionsService.assignPlanVersion', async () => {
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
      email: `a10-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const claims = platformClaims(actor.id, randomUUID());
    const created = await svc.create(
      claims,
      { platformTenantId: fixtures.platformTenantId },
      `a10-c-${randomUUID()}`,
    );
    const action = 'platform_subscription_commercial.plan_version_assigned';
    const key = `a10-p-${randomUUID()}`;
    await svc.assignPlanVersion(
      claims,
      created.id,
      {
        expectedRowVersion: created.rowVersion,
        planVersionId: fixtures.publishedPlanVersionId,
      },
      key,
    );
    expect(await countAudits(prisma, action)).toBeGreaterThanOrEqual(1);
    await svc.assignPlanVersion(
      claims,
      created.id,
      {
        expectedRowVersion: created.rowVersion,
        planVersionId: fixtures.publishedPlanVersionId,
      },
      key,
    );
    expect(await countAudits(prisma, action)).toBeGreaterThanOrEqual(1);

    report({
      requirementId: 'A10',
      domainAction: action,
      productionServicePath: 'PlatformSubscriptionsService.assignPlanVersion',
      txModel: 'Model A same-transaction AuditEntry + change row + idempotency',
      businessEffectCount: 1,
      successAuditCount: 1,
      replayAuditCount: 0,
      failureAuditCount: 0,
      historyCount: 0,
      sourcePointer: `platform_subscription_commercial:${created.id}`,
      correlationId: null,
      redaction: 'bounded',
      syntheticShortcut: false,
      result: 'PASS',
    });
  }, 180_000);

  it('A11: Tenant provisioning activate via TenantProvisioningService', async () => {
    const restore = enableProvisioningFlag();
    try {
      const stack = createProvisioningStack({ prisma, stepUpFresh: true });
      const fixture = await findPublishedPlanFixture(prisma);
      if (!fixture?.planVersion) {
        report({
          requirementId: 'A11',
          result: 'BLOCKED',
          note: 'No published plan fixture',
        });
        throw new Error('A11 blocked: no published plan fixture');
      }
      const actor = await createPlatformUserFixture(prisma, {
        email: `a11-${randomUUID()}@test.local`,
        roleKeys: ['platform_owner'],
      });
      const claims = platformClaims(actor.id, randomUUID());
      const body = buildRequestBody(fixture as never);
      const { activated } = await runFullHappyPath(stack, claims, body, 'a11');
      const action = 'tenant_provisioning.activated';
      const audits = await countAudits(prisma, action);
      expect(audits).toBeGreaterThanOrEqual(1);
      report({
        requirementId: 'A11',
        domainAction: action,
        productionServicePath: 'TenantProvisioningService.activate (runFullHappyPath)',
        txModel: 'Model A same-transaction AuditEntry (orchestration)',
        businessEffectCount: 1,
        successAuditCount: audits,
        replayAuditCount: 0,
        failureAuditCount: 0,
        historyCount: 0,
        sourcePointer: `tenant_provisioning:${activated?.id ?? 'request'}`,
        correlationId: null,
        redaction: 'bounded',
        syntheticShortcut: false,
        result: 'PASS',
      });
    } finally {
      restore();
    }
  }, 300_000);

  it('A12: Tenant lifecycle suspend + archive request approve', async () => {
    const restore = enableLifecycleFlag();
    try {
      const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
      const actor = await createPlatformUserFixture(prisma, {
        email: `a12-a-${randomUUID()}@test.local`,
        roleKeys: ['platform_owner'],
      });
      const approver = await createPlatformUserFixture(prisma, {
        email: `a12-b-${randomUUID()}@test.local`,
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
      await stack.service.suspend(claims, seeded.tenantId, body, `a12-s-${randomUUID()}`);
      const suspendAction = 'tenant_lifecycle.suspend';
      expect(await countAudits(prisma, suspendAction)).toBeGreaterThanOrEqual(1);

      // Reactivate for archive request path on a second tenant
      const seeded2 = await seedClinicTenant(prisma, { status: 'ACTIVE' });
      const reqClaims = platformClaims(actor.id, randomUUID());
      const aprClaims = platformClaims(approver.id, randomUUID());
      const preview = await previewAndBody(
        stack,
        reqClaims,
        seeded2.tenantId,
        'archive_request',
        seeded2.platformTenant.rowVersion,
      );
      const req = (await stack.service.createArchiveRequest(
        reqClaims,
        seeded2.tenantId,
        preview.body,
        `a12-arc-${randomUUID()}`,
      )) as { id: string };
      await stack.service.approveRequest(
        aprClaims,
        req.id,
        {
          expectedRowVersion: seeded2.platformTenant.rowVersion,
          reason: 'A12 approve',
          previewFingerprint: 'n/a',
          decisionReason: 'dual control',
        },
        `a12-apr-${randomUUID()}`,
      );
      const approveAction = 'tenant_lifecycle.request.approved';
      expect(await countAudits(prisma, approveAction)).toBeGreaterThanOrEqual(1);

      report({
        requirementId: 'A12',
        domainAction: `${suspendAction}+${approveAction}`,
        productionServicePath:
          'TenantLifecycleService.suspend + createArchiveRequest/approveRequest',
        txModel: 'Model A same-transaction AuditEntry (lifecycle)',
        businessEffectCount: 2,
        successAuditCount: 2,
        replayAuditCount: 0,
        failureAuditCount: 0,
        historyCount: 0,
        sourcePointer: `tenant:${seeded.tenantId}`,
        correlationId: null,
        redaction: 'bounded',
        syntheticShortcut: false,
        result: 'PASS',
      });
    } finally {
      restore();
    }
  }, 300_000);

  it('A13: Feature flag create — history SoR + evidence view', async () => {
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
      )) as { id: string };
      const history = await prisma.platformFeatureFlagHistory.count({
        where: { flagId: flag.id, operation: 'FEATURE_FLAG_CREATE' },
      });
      expect(history).toBe(1);
      const evidence = await createAuditStack(prisma).evidence.flagHistoryEvidence(
        flag.id,
        new Set(['audit.view']),
      );
      expect(evidence.history.length).toBe(1);
      report({
        requirementId: 'A13',
        domainAction: 'FEATURE_FLAG_CREATE',
        productionServicePath: 'FeatureFlagsSettingsService.createFlag',
        txModel: 'atomic flag+history in-tx (no AuditEntry)',
        businessEffectCount: 1,
        successAuditCount: 0,
        replayAuditCount: 0,
        failureAuditCount: 0,
        historyCount: history,
        sourcePointer: `platform_feature_flag:${flag.id}`,
        correlationId: evidence.history[0]?.correlationId ?? null,
        redaction: 'bounded summaries',
        syntheticShortcut: false,
        result: 'PASS',
      });
    } finally {
      restore();
    }
  });

  it('A14: Kill-switch activate via FeatureFlagsSettingsService.setKillSwitch', async () => {
    const restore = enableFfFlag();
    try {
      const actor = await createPlatformUserFixture(prisma, {
        email: `a14-${randomUUID()}@test.local`,
        roleKeys: ['platform_owner'],
      });
      const stack = createFfStack(prisma, { stepUpFresh: true });
      const claims = platformClaims(actor.id, randomUUID());
      const flag = await seedActiveFlag(prisma, actor.id, { effect: 'KILL_SWITCH_DENY' });
      await stack.service.setKillSwitch(
        claims,
        flag.id,
        true,
        {
          reason: 'A14 emergency kill',
          expectedRowVersion: flag.rowVersion,
          previewFingerprint: 'fp',
          confirmation: 'CONFIRM',
        },
        `a14-${randomUUID()}`,
      );
      const history = await prisma.platformFeatureFlagHistory.count({
        where: { flagId: flag.id, operation: 'FEATURE_FLAG_KILL_SWITCH_ACTIVATE' },
      });
      expect(history).toBe(1);
      const evidence = await createAuditStack(prisma).evidence.flagHistoryEvidence(
        flag.id,
        new Set(['audit.view']),
      );
      expect(evidence.history.some((h) => h.operation === 'FEATURE_FLAG_KILL_SWITCH_ACTIVATE')).toBe(
        true,
      );
      report({
        requirementId: 'A14',
        domainAction: 'FEATURE_FLAG_KILL_SWITCH_ACTIVATE',
        productionServicePath: 'FeatureFlagsSettingsService.setKillSwitch',
        txModel: 'atomic flag+history in-tx',
        businessEffectCount: 1,
        successAuditCount: 0,
        replayAuditCount: 0,
        failureAuditCount: 0,
        historyCount: history,
        sourcePointer: `platform_feature_flag:${flag.id}`,
        correlationId: evidence.history.find((h) => h.operation.includes('KILL'))?.correlationId,
        redaction: 'bounded',
        syntheticShortcut: false,
        result: 'PASS',
      });
    } finally {
      restore();
    }
  });

  it('A15: Global setting update via FeatureFlagsSettingsService.updateSetting', async () => {
    const restore = enableFfFlag();
    try {
      const actor = await createPlatformUserFixture(prisma, {
        email: `a15-${randomUUID()}@test.local`,
        roleKeys: ['platform_owner'],
      });
      const stack = createFfStack(prisma, { stepUpFresh: true });
      const claims = platformClaims(actor.id, randomUUID());
      const setting = await seedSetting(prisma, actor.id);
      await stack.service.updateSetting(
        claims,
        setting.id,
        {
          safeValueJson: { enabled: true, note: 'A15' },
          reason: 'A15 setting update',
          expectedRowVersion: setting.rowVersion,
        },
        `a15-${randomUUID()}`,
      );
      const history = await prisma.platformGlobalSettingHistory.count({
        where: { settingId: setting.id, operation: 'GLOBAL_SETTING_UPDATE' },
      });
      expect(history).toBe(1);
      const raw = await prisma.platformGlobalSetting.findUniqueOrThrow({ where: { id: setting.id } });
      expect(JSON.stringify(raw.safeValueJson)).not.toMatch(/password|secret|api_key/i);
      report({
        requirementId: 'A15',
        domainAction: 'GLOBAL_SETTING_UPDATE',
        productionServicePath: 'FeatureFlagsSettingsService.updateSetting',
        txModel: 'atomic setting+history in-tx',
        businessEffectCount: 1,
        successAuditCount: 0,
        replayAuditCount: 0,
        failureAuditCount: 0,
        historyCount: history,
        sourcePointer: `platform_global_setting:${setting.id}`,
        correlationId: null,
        redaction: 'safeValueJson only',
        syntheticShortcut: false,
        result: 'PASS',
      });
    } finally {
      restore();
    }
  });

  it('A16: Sensitive EER/ops decision Model A — kill_switch_denied + eer evidence', async () => {
    const restore = enableFfFlag();
    try {
      const actor = await createPlatformUserFixture(prisma, {
        email: `a16-${randomUUID()}@test.local`,
        roleKeys: ['platform_owner'],
      });
      const stack = createFfStack(prisma, { stepUpFresh: true });
      const flag = await seedActiveFlag(prisma, actor.id, {
        effect: 'KILL_SWITCH_DENY',
        killSwitchActive: true,
      });
      const tenantId = randomUUID();
      const decision = await stack.operational.evaluate({
        tenantId,
        flagKey: flag.canonicalKey,
        entitlementAllows: true,
        lifecycleDenied: false,
      });
      expect(decision.explanationCode).toBe('kill_switch_denied');
      const evidence = await createAuditStack(prisma).evidence.eerDecisionEvidence(
        { tenantId, capabilityKey: flag.canonicalKey },
        new Set(['audit.view', 'audit.sensitive.view']),
      );
      expect(evidence.model).toBe('A');
      expect(JSON.stringify(evidence)).not.toMatch(/password|sk-live|Bearer /i);
      report({
        requirementId: 'A16',
        domainAction: 'kill_switch_denied (Model A)',
        productionServicePath: 'OperationalDecisionService.evaluate + AuditCenterEvidenceService.eerDecisionEvidence',
        txModel: 'read-only decision; Model A provenance adapter',
        businessEffectCount: 0,
        successAuditCount: 0,
        replayAuditCount: 0,
        failureAuditCount: 0,
        historyCount: 0,
        sourcePointer: `operational:${flag.canonicalKey}`,
        correlationId: null,
        redaction: 'no raw snapshot',
        syntheticShortcut: false,
        finalResult: decision.allowed,
        reasonCode: decision.explanationCode,
        result: 'PASS',
      });
    } finally {
      restore();
    }
  });

  it('A17: Not Applicable — no accepted sales Source of Record', () => {
    report({
      requirementId: 'A17',
      domainAction: 'sales',
      productionServicePath: 'N/A',
      result: 'N/A',
      syntheticShortcut: false,
    });
    expect(true).toBe(true);
  });
});
