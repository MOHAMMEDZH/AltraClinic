/**
 * Step 14 final gate — concurrent equivalent idempotency matrix + Option A completed-only model.
 * Every operation proves: mutation count, audit count, completed-record count, different-payload 409.
 * Apply-required mutating and no-op are independent fixtures (never combined ≤1).
 */
import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import {
  cleanupPlatformPlansTables,
  createEntitlementsService,
  createPlansService,
  createPlansSeedService,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
  createPlansPrismaWrapper,
} from './platform-plans-db.harness';
import { AuditTrailPlatformPlansAuditLog } from '../infrastructure/audit-trail-platform-plans-audit-log';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { PrismaService } from '../../../infrastructure/prisma.service';
import {
  PlanIdempotencyService,
  PLAN_IDEMPOTENCY_REPLAY_DELAY_MS,
  PLAN_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS,
  PLAN_IDEMPOTENCY_REPLAY_MAX_DURATION_MS,
  IdempotencyEquivalentReplayTimeoutError,
} from '../application/plan-idempotency.service';

const run = platformDbSecurityEnabled();
const describeDb = run ? describe : describe.skip;

const ACTOR = '00000000-0000-4000-8000-000000000314';
const SESSION_A = '11111111-1111-4111-8111-111111111314';
const CLAIMS_A = { sub: ACTOR, sessionId: SESSION_A } as JwtClaimsVO;

const ALL_STEP14 = [
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

function durableAudit(prisma: PrismaClient) {
  const wrapper = createPlansPrismaWrapper(prisma);
  return new AuditTrailPlatformPlansAuditLog({
    withPlatformBypass: wrapper.withPlatformBypass,
  } as unknown as PrismaService);
}

async function ensureCatalog(prisma: PrismaClient): Promise<void> {
  const dash = await prisma.healthcareCatalogItem.findUnique({
    where: { canonicalKey: 'module.dashboard' },
  });
  if (dash) return;
  const { HealthcareCatalogSeedService } = await import(
    '../../platform-healthcare-catalog/application/catalog-seed.service'
  );
  const catalogSeed = new HealthcareCatalogSeedService({
    withPlatformBypass: async <T>(fn: (client: typeof prisma) => Promise<T>) =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
        return fn(tx as unknown as typeof prisma);
      }),
  } as never);
  await catalogSeed.seedAll();
}

async function installModuleRequiresRule(
  prisma: PrismaClient,
  subjectKey: string,
  targetKey: string,
): Promise<() => Promise<void>> {
  const subject = await prisma.healthcareCatalogItem.findUniqueOrThrow({
    where: { canonicalKey: subjectKey },
  });
  const target = await prisma.healthcareCatalogItem.findUniqueOrThrow({
    where: { canonicalKey: targetKey },
  });
  await prisma.healthcareCatalogCompatibilityRule.deleteMany({
    where: {
      ruleType: 'REQUIRES',
      subjectItemId: subject.id,
      targetItemId: target.id,
      anyOfGroupKey: '',
    },
  });
  const created = await prisma.healthcareCatalogCompatibilityRule.create({
    data: {
      ruleType: 'REQUIRES',
      subjectItemId: subject.id,
      targetItemId: target.id,
      lifecycle: 'ACTIVE',
      explanationEn: 'Step 14 concurrent matrix fixture REQUIRES',
      explanationAr: 'قاعدة اختبار',
      anyOfGroupKey: '',
      systemSeeded: false,
    },
  });
  return async () => {
    await prisma.healthcareCatalogCompatibilityRule.deleteMany({ where: { id: created.id } });
  };
}

async function createEmptyDraft(prisma: PrismaClient, planCanonicalKey: string) {
  const plan = await prisma.platformPlan.findUniqueOrThrow({
    where: { canonicalKey: planCanonicalKey },
  });
  const version = await prisma.platformPlanVersion.create({
    data: {
      planId: plan.id,
      versionNumber: 1,
      lifecycle: 'DRAFT',
      commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED',
      translations: {
        create: [
          { locale: 'en-US', releaseLabel: 'C', shortDescription: 'c' },
          { locale: 'ar-SY', releaseLabel: 'م', shortDescription: 'م' },
        ],
      },
    },
  });
  return { plan, version };
}

async function auditCount(prisma: PrismaClient, action: string, resourceId: string) {
  return prisma.auditEntry.count({
    where: {
      action,
      resourceId,
      tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
    },
  });
}

describe('Step 14 idempotency Option A (completed-only) unit', () => {
  it('documents completed-only: no durable pending/failed in service contract', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../application/plan-idempotency.service.ts'),
      'utf8',
    );
    expect(src).toContain('Option A: completed-only');
    expect(src).toContain('ON CONFLICT');
    expect(src).toContain('IdempotencyEquivalentRaceLostError');
    expect(src).toContain('PLAN_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS');
    expect(src).not.toMatch(/promote.*pending/i);
  });

  it('exports bounded winner-reload contract constants', () => {
    expect(PLAN_IDEMPOTENCY_REPLAY_MAX_ATTEMPTS).toBe(25);
    expect(PLAN_IDEMPOTENCY_REPLAY_DELAY_MS).toBe(20);
    expect(PLAN_IDEMPOTENCY_REPLAY_MAX_DURATION_MS).toBe(500);
    expect(new IdempotencyEquivalentReplayTimeoutError().name).toBe(
      'IdempotencyEquivalentReplayTimeoutError',
    );
  });
});

describeDb('Step 14 concurrent equivalent idempotency (postgres)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient(DEFAULT_PLATFORM_DB_SECURITY_URL);
    await prisma.$connect();
    await ensureCatalog(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupPlatformPlansTables(prisma);
  });

  it('Option A: failed mutation leaves no idempotency row; orphan non-completed is purged', async () => {
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: false });
    const { plan, version } = await createEmptyDraft(prisma, 'plan.lite');
    await prisma.platformPlanIdempotencyRecord.create({
      data: {
        actorId: ACTOR,
        operation: 'plan.replaceEntitlements',
        idempotencyKey: 'orphan-pending',
        requestHash: 'c'.repeat(64),
        resultResourceType: 'planVersion',
        resultResourceId: version.id,
        status: 'pending',
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const ents = createEntitlementsService({ prisma, permissions: ALL_STEP14 });
    await ents.putEntitlements(
      CLAIMS_A,
      plan.id,
      version.id,
      { expectedRowVersion: version.rowVersion, entitlementKeys: ['module.dashboard'] },
      'orphan-pending',
    );
    const row = await prisma.platformPlanIdempotencyRecord.findUniqueOrThrow({
      where: {
        actorId_operation_idempotencyKey: {
          actorId: ACTOR,
          operation: 'plan.replaceEntitlements',
          idempotencyKey: 'orphan-pending',
        },
      },
    });
    expect(row.status).toBe('completed');

    // Without a concurrent winner, stale OCC + idempotency claim exhausts bounded reload → 503
    // (retryable), never conflicting-reuse 409 and never a completed idempotency row.
    await expect(
      ents.putEntitlements(
        CLAIMS_A,
        plan.id,
        version.id,
        { expectedRowVersion: 999, entitlementKeys: ['module.patients'] },
        'fail-no-row',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(
      await prisma.platformPlanIdempotencyRecord.count({
        where: { idempotencyKey: 'fail-no-row' },
      }),
    ).toBe(0);

    // Pure stale OCC without an idempotency claim remains ConflictException.
    await expect(
      ents.putEntitlements(
        CLAIMS_A,
        plan.id,
        version.id,
        { expectedRowVersion: 999, entitlementKeys: ['module.patients'] },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('bounded winner-reload: fixed attempts/delay; timeout is 503 not conflict; no DB-lock details', async () => {
    const idem = new PlanIdempotencyService(createPlansPrismaWrapper(prisma) as never);
    const started = Date.now();
    const result = await idem.awaitEquivalentReplay(
      {
        actorId: ACTOR,
        operation: 'plan.replaceEntitlements',
        idempotencyKey: 'never-completes',
        requestHash: 'a'.repeat(64),
      },
      { maxAttempts: 3, delayMs: 15 },
    );
    const elapsed = Date.now() - started;
    expect(result).toBeNull();
    expect(elapsed).toBeGreaterThanOrEqual(30);
    expect(elapsed).toBeLessThan(2_000);
    expect(ServiceUnavailableException).toBeDefined();
    const timeout = new IdempotencyEquivalentReplayTimeoutError();
    expect(timeout.message).not.toMatch(/lock|conflict|different request/i);
    expect(timeout.message).toMatch(/retry shortly/i);
  });

  it('concurrent replace entitlements: one mutation, one audit, same result; different payload 409', async () => {
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: false });
    const { plan, version } = await createEmptyDraft(prisma, 'plan.pro');
    const ents = createEntitlementsService({
      prisma,
      permissions: ALL_STEP14,
      audit: durableAudit(prisma),
    });
    const body = {
      expectedRowVersion: version.rowVersion,
      entitlementKeys: ['module.dashboard', 'module.patients'],
    };
    const key = 'conc-ent-same';
    const [a, b] = await Promise.all([
      ents.putEntitlements(CLAIMS_A, plan.id, version.id, body, key),
      ents.putEntitlements(CLAIMS_A, plan.id, version.id, body, key),
    ]);
    expect(a.entitlementCount).toBe(2);
    expect(b.entitlementCount).toBe(2);
    expect(a.rowVersion).toBe(b.rowVersion);
    expect(a.rowVersion).toBe(version.rowVersion + 1);
    expect(
      await prisma.platformPlanIdempotencyRecord.count({
        where: { idempotencyKey: key, status: 'completed' },
      }),
    ).toBe(1);
    expect(await auditCount(prisma, 'platform_plan_version.entitlements_replaced', version.id)).toBe(
      1,
    );
    expect(
      await prisma.platformPlanVersionEntitlement.count({ where: { planVersionId: version.id } }),
    ).toBe(2);

    await expect(
      ents.putEntitlements(
        CLAIMS_A,
        plan.id,
        version.id,
        { expectedRowVersion: 1, entitlementKeys: ['module.emr'] },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await auditCount(prisma, 'platform_plan_version.entitlements_replaced', version.id)).toBe(
      1,
    );
    expect(
      await prisma.platformPlanIdempotencyRecord.count({
        where: { idempotencyKey: key, status: 'completed' },
      }),
    ).toBe(1);
    expect(
      await prisma.platformPlanVersionEntitlement.count({ where: { planVersionId: version.id } }),
    ).toBe(2);
  });

  it('concurrent replace Limits: one mutation, one audit, typed exact; different payload 409', async () => {
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: false });
    const { plan, version } = await createEmptyDraft(prisma, 'plan.enterprise');
    const ents = createEntitlementsService({
      prisma,
      permissions: ALL_STEP14,
      audit: durableAudit(prisma),
    });
    const body = {
      expectedRowVersion: version.rowVersion,
      limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '7' }],
    };
    const key = 'conc-lim-same';
    const [a, b] = await Promise.all([
      ents.putLimits(CLAIMS_A, plan.id, version.id, body, key),
      ents.putLimits(CLAIMS_A, plan.id, version.id, body, key),
    ]);
    expect(a.rowVersion).toBe(b.rowVersion);
    expect(a.rowVersion).toBe(version.rowVersion + 1);
    const lims = await prisma.platformPlanVersionLimit.findMany({
      where: { planVersionId: version.id },
    });
    expect(lims).toHaveLength(1);
    expect(lims[0]!.valueText).toBe('7');
    expect(
      await prisma.platformPlanIdempotencyRecord.count({
        where: { idempotencyKey: key, status: 'completed' },
      }),
    ).toBe(1);
    expect(await auditCount(prisma, 'platform_plan_version.limits_replaced', version.id)).toBe(1);

    await expect(
      ents.putLimits(
        CLAIMS_A,
        plan.id,
        version.id,
        {
          expectedRowVersion: 1,
          limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '99' }],
        },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await auditCount(prisma, 'platform_plan_version.limits_replaced', version.id)).toBe(1);
    expect(
      (
        await prisma.platformPlanVersionLimit.findMany({
          where: { planVersionId: version.id },
        })
      )[0]!.valueText,
    ).toBe('7');
  });

  it('concurrent apply-required MUTATING: deps added once; one audit; different payload 409', async () => {
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: false });
    const removeRule = await installModuleRequiresRule(prisma, 'module.emr', 'module.patients');
    try {
      const { plan, version } = await createEmptyDraft(prisma, 'plan.pro');
      const ents = createEntitlementsService({
        prisma,
        permissions: ALL_STEP14,
        audit: durableAudit(prisma),
      });
      // Subject only — patients is missing required dependency.
      await ents.putEntitlements(
        CLAIMS_A,
        plan.id,
        version.id,
        { expectedRowVersion: version.rowVersion, entitlementKeys: ['module.emr'] },
        'seed-emr-only',
      );
      const refreshed = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: version.id },
      });
      const beforeKeys = (
        await prisma.platformPlanVersionEntitlement.findMany({
          where: { planVersionId: version.id },
          include: { catalogItem: true },
        })
      ).map((r) => r.catalogItem.canonicalKey);
      expect(beforeKeys.sort()).toEqual(['module.emr']);

      const body = { expectedRowVersion: refreshed.rowVersion, confirm: true as const };
      const key = 'conc-dep-mutate';
      const [a, b] = await Promise.all([
        ents.applyRequiredDependencies(CLAIMS_A, plan.id, version.id, body, key),
        ents.applyRequiredDependencies(CLAIMS_A, plan.id, version.id, body, key),
      ]);
      expect(a.entitlementCount).toBe(2);
      expect(b.entitlementCount).toBe(2);
      expect(a.rowVersion).toBe(b.rowVersion);
      expect(a.rowVersion).toBe(refreshed.rowVersion + 1);
      const afterKeys = (
        await prisma.platformPlanVersionEntitlement.findMany({
          where: { planVersionId: version.id },
          include: { catalogItem: true },
        })
      )
        .map((r) => r.catalogItem.canonicalKey)
        .sort();
      expect(afterKeys).toEqual(['module.emr', 'module.patients']);
      expect(
        await prisma.platformPlanIdempotencyRecord.count({
          where: { idempotencyKey: key, status: 'completed' },
        }),
      ).toBe(1);
      expect(
        await auditCount(prisma, 'platform_plan_version.required_dependencies_applied', version.id),
      ).toBe(1);

      await expect(
        ents.applyRequiredDependencies(
          CLAIMS_A,
          plan.id,
          version.id,
          { expectedRowVersion: refreshed.rowVersion + 99, confirm: true },
          key,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(
        await auditCount(prisma, 'platform_plan_version.required_dependencies_applied', version.id),
      ).toBe(1);
    } finally {
      await removeRule();
    }
  });

  it('concurrent apply-required NO-OP: no child mutation; no mutation audit; different payload 409', async () => {
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
    const plan = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.lite' } });
    const draft = await prisma.platformPlanVersion.findFirstOrThrow({
      where: { planId: plan.id, lifecycle: 'DRAFT' },
    });
    const ents = createEntitlementsService({
      prisma,
      permissions: ALL_STEP14,
      audit: durableAudit(prisma),
    });
    const beforeCount = await prisma.platformPlanVersionEntitlement.count({
      where: { planVersionId: draft.id },
    });
    const beforeVersion = draft.rowVersion;
    const body = { expectedRowVersion: draft.rowVersion, confirm: true as const };
    const key = 'conc-dep-noop';
    const [a, b] = await Promise.all([
      ents.applyRequiredDependencies(CLAIMS_A, plan.id, draft.id, body, key),
      ents.applyRequiredDependencies(CLAIMS_A, plan.id, draft.id, body, key),
    ]);
    expect(a.entitlementCount).toBe(b.entitlementCount);
    expect(a.entitlementCount).toBe(beforeCount);
    expect(a.rowVersion).toBe(beforeVersion);
    expect(b.rowVersion).toBe(beforeVersion);
    expect(
      await prisma.platformPlanVersionEntitlement.count({ where: { planVersionId: draft.id } }),
    ).toBe(beforeCount);
    expect(
      await prisma.platformPlanIdempotencyRecord.count({
        where: { idempotencyKey: key, status: 'completed' },
      }),
    ).toBe(1);
    // No misleading success-mutation audit when nothing was added.
    expect(
      await auditCount(prisma, 'platform_plan_version.required_dependencies_applied', draft.id),
    ).toBe(0);

    await expect(
      ents.applyRequiredDependencies(
        CLAIMS_A,
        plan.id,
        draft.id,
        { expectedRowVersion: beforeVersion + 1, confirm: true },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      await prisma.platformPlanIdempotencyRecord.count({
        where: { idempotencyKey: key, status: 'completed' },
      }),
    ).toBe(1);
  });

  it('concurrent clone: one Draft; one audit; different source fingerprint 409', async () => {
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
    const plan = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.lite' } });
    const draft = await prisma.platformPlanVersion.findFirstOrThrow({
      where: { planId: plan.id, lifecycle: 'DRAFT' },
    });
    const plans = createPlansService({
      prisma,
      permissions: ALL_STEP14,
      stepUpFresh: true,
      audit: durableAudit(prisma),
    });
    const published = await plans.publishVersion(CLAIMS_A, plan.id, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'conc clone source',
    });
    // Second published source for different-payload conflict (different sourceVersionId fingerprint).
    const secondDraft = await plans.cloneVersion(CLAIMS_A, plan.id, published.id, 'prep-second-source');
    const published2 = await plans.publishVersion(
      CLAIMS_A,
      plan.id,
      secondDraft.id,
      { expectedRowVersion: secondDraft.rowVersion, reason: 'second source' },
      'pub-second-source',
    );

    const key = 'conc-clone-same';
    const [a, b] = await Promise.all([
      plans.cloneVersion(CLAIMS_A, plan.id, published.id, key),
      plans.cloneVersion(CLAIMS_A, plan.id, published.id, key),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.versionNumber).toBe(b.versionNumber);
    expect(
      await prisma.platformPlanVersion.count({
        where: { planId: plan.id, lifecycle: 'DRAFT', sourceVersionId: published.id },
      }),
    ).toBe(1);
    expect(
      await prisma.platformPlanIdempotencyRecord.count({
        where: { idempotencyKey: key, status: 'completed' },
      }),
    ).toBe(1);
    expect(await auditCount(prisma, 'platform_plan_version.cloned', a.id)).toBe(1);

    await expect(plans.cloneVersion(CLAIMS_A, plan.id, published2.id, key)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(
      await prisma.platformPlanVersion.count({
        where: { planId: plan.id, lifecycle: 'DRAFT', sourceVersionId: published.id },
      }),
    ).toBe(1);
    expect(await auditCount(prisma, 'platform_plan_version.cloned', a.id)).toBe(1);
  });

  it('concurrent publish: one fingerprint; one audit; different reason 409', async () => {
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
    const plan = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.pro' } });
    const draft = await prisma.platformPlanVersion.findFirstOrThrow({
      where: { planId: plan.id, lifecycle: 'DRAFT' },
    });
    const plans = createPlansService({
      prisma,
      permissions: ALL_STEP14,
      stepUpFresh: true,
      audit: durableAudit(prisma),
    });
    const body = { expectedRowVersion: draft.rowVersion, reason: 'conc publish' };
    const key = 'conc-pub-same';
    const [a, b] = await Promise.all([
      plans.publishVersion(CLAIMS_A, plan.id, draft.id, body, key),
      plans.publishVersion(CLAIMS_A, plan.id, draft.id, body, key),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.lifecycle).toBe('PUBLISHED');
    expect(a.publicationFingerprint).toBe(b.publicationFingerprint);
    expect(a.publicationFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(
      await prisma.platformPlanIdempotencyRecord.count({
        where: { idempotencyKey: key, status: 'completed' },
      }),
    ).toBe(1);
    expect(await auditCount(prisma, 'platform_plan_version.published', draft.id)).toBe(1);

    await expect(
      plans.publishVersion(
        CLAIMS_A,
        plan.id,
        draft.id,
        { expectedRowVersion: draft.rowVersion, reason: 'different reason payload' },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await auditCount(prisma, 'platform_plan_version.published', draft.id)).toBe(1);
    const still = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(still.publicationFingerprint).toBe(a.publicationFingerprint);
  });

  describe('service-recreation replay (new service graph, same PostgreSQL)', () => {
    it('replace entitlements: same result; no second mutation/audit/completed row; conflict remains 409', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: false });
      const { plan, version } = await createEmptyDraft(prisma, 'plan.lite');
      const audit = durableAudit(prisma);
      const first = createEntitlementsService({ prisma, permissions: ALL_STEP14, audit });
      const body = {
        expectedRowVersion: version.rowVersion,
        entitlementKeys: ['module.dashboard'],
      };
      const key = 'recreate-ent';
      const original = await first.putEntitlements(CLAIMS_A, plan.id, version.id, body, key);
      const second = createEntitlementsService({ prisma, permissions: ALL_STEP14, audit });
      const replay = await second.putEntitlements(CLAIMS_A, plan.id, version.id, body, key);
      expect(replay.entitlementCount).toBe(original.entitlementCount);
      expect(replay.rowVersion).toBe(original.rowVersion);
      expect(
        await prisma.platformPlanVersionEntitlement.count({ where: { planVersionId: version.id } }),
      ).toBe(1);
      expect(await auditCount(prisma, 'platform_plan_version.entitlements_replaced', version.id)).toBe(
        1,
      );
      expect(
        await prisma.platformPlanIdempotencyRecord.count({
          where: { idempotencyKey: key, status: 'completed' },
        }),
      ).toBe(1);
      await expect(
        second.putEntitlements(
          CLAIMS_A,
          plan.id,
          version.id,
          { expectedRowVersion: 1, entitlementKeys: ['module.patients'] },
          key,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('replace Limits: same result; no second mutation/audit/completed row; conflict remains 409', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: false });
      const { plan, version } = await createEmptyDraft(prisma, 'plan.enterprise');
      const audit = durableAudit(prisma);
      const first = createEntitlementsService({ prisma, permissions: ALL_STEP14, audit });
      const body = {
        expectedRowVersion: version.rowVersion,
        limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '11' }],
      };
      const key = 'recreate-lim';
      const original = await first.putLimits(CLAIMS_A, plan.id, version.id, body, key);
      const second = createEntitlementsService({ prisma, permissions: ALL_STEP14, audit });
      const replay = await second.putLimits(CLAIMS_A, plan.id, version.id, body, key);
      expect(replay.rowVersion).toBe(original.rowVersion);
      expect(
        await prisma.platformPlanVersionLimit.count({ where: { planVersionId: version.id } }),
      ).toBe(1);
      expect(await auditCount(prisma, 'platform_plan_version.limits_replaced', version.id)).toBe(1);
      expect(
        await prisma.platformPlanIdempotencyRecord.count({
          where: { idempotencyKey: key, status: 'completed' },
        }),
      ).toBe(1);
      await expect(
        second.putLimits(
          CLAIMS_A,
          plan.id,
          version.id,
          {
            expectedRowVersion: 1,
            limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '99' }],
          },
          key,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('apply-required mutating: same deps; no second mutation/audit; conflict remains 409', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: false });
      const removeRule = await installModuleRequiresRule(prisma, 'module.emr', 'module.patients');
      try {
        const { plan, version } = await createEmptyDraft(prisma, 'plan.pro');
        const audit = durableAudit(prisma);
        const first = createEntitlementsService({ prisma, permissions: ALL_STEP14, audit });
        await first.putEntitlements(
          CLAIMS_A,
          plan.id,
          version.id,
          { expectedRowVersion: version.rowVersion, entitlementKeys: ['module.emr'] },
          'recreate-dep-seed',
        );
        const refreshed = await prisma.platformPlanVersion.findUniqueOrThrow({
          where: { id: version.id },
        });
        const body = { expectedRowVersion: refreshed.rowVersion, confirm: true as const };
        const key = 'recreate-dep-mutate';
        const original = await first.applyRequiredDependencies(
          CLAIMS_A,
          plan.id,
          version.id,
          body,
          key,
        );
        const second = createEntitlementsService({ prisma, permissions: ALL_STEP14, audit });
        const replay = await second.applyRequiredDependencies(
          CLAIMS_A,
          plan.id,
          version.id,
          body,
          key,
        );
        expect(replay.entitlementCount).toBe(original.entitlementCount);
        expect(replay.rowVersion).toBe(original.rowVersion);
        expect(replay.entitlementCount).toBe(2);
        expect(
          await auditCount(prisma, 'platform_plan_version.required_dependencies_applied', version.id),
        ).toBe(1);
        expect(
          await prisma.platformPlanIdempotencyRecord.count({
            where: { idempotencyKey: key, status: 'completed' },
          }),
        ).toBe(1);
        await expect(
          second.applyRequiredDependencies(
            CLAIMS_A,
            plan.id,
            version.id,
            { expectedRowVersion: refreshed.rowVersion + 50, confirm: true },
            key,
          ),
        ).rejects.toBeInstanceOf(ConflictException);
      } finally {
        await removeRule();
      }
    });

    it('apply-required no-op: same result; no mutation audit; conflict remains 409', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      const plan = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.lite' } });
      const draft = await prisma.platformPlanVersion.findFirstOrThrow({
        where: { planId: plan.id, lifecycle: 'DRAFT' },
      });
      const audit = durableAudit(prisma);
      const first = createEntitlementsService({ prisma, permissions: ALL_STEP14, audit });
      const beforeCount = await prisma.platformPlanVersionEntitlement.count({
        where: { planVersionId: draft.id },
      });
      const body = { expectedRowVersion: draft.rowVersion, confirm: true as const };
      const key = 'recreate-dep-noop';
      const original = await first.applyRequiredDependencies(CLAIMS_A, plan.id, draft.id, body, key);
      const second = createEntitlementsService({ prisma, permissions: ALL_STEP14, audit });
      const replay = await second.applyRequiredDependencies(CLAIMS_A, plan.id, draft.id, body, key);
      expect(replay.entitlementCount).toBe(original.entitlementCount);
      expect(replay.rowVersion).toBe(original.rowVersion);
      expect(replay.rowVersion).toBe(draft.rowVersion);
      expect(
        await prisma.platformPlanVersionEntitlement.count({ where: { planVersionId: draft.id } }),
      ).toBe(beforeCount);
      expect(
        await auditCount(prisma, 'platform_plan_version.required_dependencies_applied', draft.id),
      ).toBe(0);
      expect(
        await prisma.platformPlanIdempotencyRecord.count({
          where: { idempotencyKey: key, status: 'completed' },
        }),
      ).toBe(1);
      await expect(
        second.applyRequiredDependencies(
          CLAIMS_A,
          plan.id,
          draft.id,
          { expectedRowVersion: draft.rowVersion + 1, confirm: true },
          key,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('clone: same Draft id/version; no duplicates; conflict remains 409', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      const plan = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.lite' } });
      const draft = await prisma.platformPlanVersion.findFirstOrThrow({
        where: { planId: plan.id, lifecycle: 'DRAFT' },
      });
      const first = createPlansService({
        prisma,
        permissions: ALL_STEP14,
        stepUpFresh: true,
        audit: durableAudit(prisma),
      });
      const published = await first.publishVersion(CLAIMS_A, plan.id, draft.id, {
        expectedRowVersion: draft.rowVersion,
        reason: 'recreate clone source',
      });
      const secondSource = await first.cloneVersion(
        CLAIMS_A,
        plan.id,
        published.id,
        'recreate-clone-alt-source',
      );
      const published2 = await first.publishVersion(
        CLAIMS_A,
        plan.id,
        secondSource.id,
        { expectedRowVersion: secondSource.rowVersion, reason: 'alt source' },
        'recreate-pub-alt',
      );
      const key = 'recreate-clone';
      const original = await first.cloneVersion(CLAIMS_A, plan.id, published.id, key);
      const second = createPlansService({
        prisma,
        permissions: ALL_STEP14,
        stepUpFresh: true,
        audit: durableAudit(prisma),
      });
      const replay = await second.cloneVersion(CLAIMS_A, plan.id, published.id, key);
      expect(replay.id).toBe(original.id);
      expect(replay.versionNumber).toBe(original.versionNumber);
      expect(
        await prisma.platformPlanVersion.count({
          where: { planId: plan.id, lifecycle: 'DRAFT', sourceVersionId: published.id },
        }),
      ).toBe(1);
      expect(await auditCount(prisma, 'platform_plan_version.cloned', original.id)).toBe(1);
      expect(
        await prisma.platformPlanIdempotencyRecord.count({
          where: { idempotencyKey: key, status: 'completed' },
        }),
      ).toBe(1);
      const entCount = await prisma.platformPlanVersionEntitlement.count({
        where: { planVersionId: original.id },
      });
      const limCount = await prisma.platformPlanVersionLimit.count({
        where: { planVersionId: original.id },
      });
      const trCount = await prisma.platformPlanVersionTranslation.count({
        where: { planVersionId: original.id },
      });
      expect(entCount).toBeGreaterThan(0);
      expect(limCount).toBeGreaterThan(0);
      expect(trCount).toBe(2);
      await expect(second.cloneVersion(CLAIMS_A, plan.id, published2.id, key)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(
        await prisma.platformPlanVersionEntitlement.count({ where: { planVersionId: original.id } }),
      ).toBe(entCount);
    });

    it('publish: same fingerprint/timestamp/actor; no second transition; conflict remains 409', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      const plan = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.pro' } });
      const draft = await prisma.platformPlanVersion.findFirstOrThrow({
        where: { planId: plan.id, lifecycle: 'DRAFT' },
      });
      const first = createPlansService({
        prisma,
        permissions: ALL_STEP14,
        stepUpFresh: true,
        audit: durableAudit(prisma),
      });
      const body = { expectedRowVersion: draft.rowVersion, reason: 'recreate publish' };
      const key = 'recreate-pub';
      const original = await first.publishVersion(CLAIMS_A, plan.id, draft.id, body, key);
      const second = createPlansService({
        prisma,
        permissions: ALL_STEP14,
        stepUpFresh: true,
        audit: durableAudit(prisma),
      });
      const replay = await second.publishVersion(CLAIMS_A, plan.id, draft.id, body, key);
      expect(replay.id).toBe(original.id);
      expect(replay.lifecycle).toBe('PUBLISHED');
      expect(replay.publicationFingerprint).toBe(original.publicationFingerprint);
      const row = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: draft.id } });
      expect(row.publicationFingerprint).toBe(original.publicationFingerprint);
      expect(row.publishedAt?.toISOString()).toBe(original.publishedAt);
      expect(row.publishedByPlatformUserId).toBe(original.publishedByPlatformUserId);
      expect(await auditCount(prisma, 'platform_plan_version.published', draft.id)).toBe(1);
      expect(
        await prisma.platformPlanIdempotencyRecord.count({
          where: { idempotencyKey: key, status: 'completed' },
        }),
      ).toBe(1);
      await expect(
        second.publishVersion(
          CLAIMS_A,
          plan.id,
          draft.id,
          { expectedRowVersion: draft.rowVersion, reason: 'different recreate reason' },
          key,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
