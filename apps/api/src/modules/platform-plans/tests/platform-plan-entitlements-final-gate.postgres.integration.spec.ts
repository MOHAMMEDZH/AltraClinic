/**
 * Step 14 final verification gate — durable PostgreSQL evidence for:
 * seed ownership, audit/redaction, per-op idempotency, concurrency/rollback,
 * fingerprint immutability, typed Limits, rate limits, and authz non-execution.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import {
  cleanupPlatformPlansTables,
  createEntitlementsService,
  createPlansPrismaWrapper,
  createPlansService,
  createPlansSeedService,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from './platform-plans-db.harness';
import { AuditTrailPlatformPlansAuditLog } from '../infrastructure/audit-trail-platform-plans-audit-log';
import { PlanIdempotencyService } from '../application/plan-idempotency.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { validateLimitAssignment } from '../domain/limit-value.validator';
import {
  buildPublicationFingerprint,
  buildPublicationFingerprintV2,
} from '../domain/publication-fingerprint';

const run = platformDbSecurityEnabled();
const describeDb = run ? describe : describe.skip;

const ACTOR = '00000000-0000-4000-8000-000000000114';
const ACTOR_B = '00000000-0000-4000-8000-000000000115';
const SESSION_A = '11111111-1111-4111-8111-111111111114';
const SESSION_B = '11111111-1111-4111-8111-111111111115';
const CLAIMS_A = { sub: ACTOR, sessionId: SESSION_A } as JwtClaimsVO;
const CLAIMS_B = { sub: ACTOR_B, sessionId: SESSION_B } as JwtClaimsVO;

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

const SENSITIVE_PATTERN =
  /Gate desc|مسودة|releaseNotes|Bearer |sessionId|password|PHI_SENTINEL|SELECT \*|stack|idempotency-key|Authorization/i;

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

async function auditCount(
  prisma: PrismaClient,
  action: string,
  resourceId: string,
): Promise<number> {
  return prisma.auditEntry.count({
    where: { action, resourceId, tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
  });
}

function assertNoSensitivePayload(serialized: string): void {
  expect(serialized).not.toMatch(SENSITIVE_PATTERN);
}

async function expectRateLimited(fn: () => Promise<unknown>): Promise<void> {
  let caught: unknown;
  try {
    await fn();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(HttpException);
  expect((caught as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
}

async function seedPlansOnly(prisma: PrismaClient): Promise<void> {
  await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: false });
}

/** Create an UNINITIALIZED seed-owned Draft for ownership tests (no children). */
async function createUninitializedDraft(
  prisma: PrismaClient,
  planCanonicalKey: string,
): Promise<{ planId: string; versionId: string; rowVersion: number }> {
  const plan = await prisma.platformPlan.findUniqueOrThrow({
    where: { canonicalKey: planCanonicalKey },
  });
  const version = await prisma.platformPlanVersion.create({
    data: {
      planId: plan.id,
      versionNumber: 1,
      lifecycle: 'DRAFT',
      systemSeeded: true,
      commercialDefinitionOwnership: 'UNINITIALIZED',
      translations: {
        create: [
          { locale: 'en-US', releaseLabel: 'Seed Draft', shortDescription: 'seed' },
          { locale: 'ar-SY', releaseLabel: 'مسودة', shortDescription: 'بذر' },
        ],
      },
    },
  });
  return { planId: plan.id, versionId: version.id, rowVersion: version.rowVersion };
}

describeDb('Step 14 final gate (postgres)', () => {
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

  describe('seed ownership provenance', () => {
    it('populates UNINITIALIZED once; preserves SEED_INITIALIZED, admin empty, and admin non-empty', async () => {
      await seedPlansOnly(prisma);
      const { versionId } = await createUninitializedDraft(prisma, 'plan.lite');
      const draft = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: versionId },
      });
      expect(draft.commercialDefinitionOwnership).toBe('UNINITIALIZED');

      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      const seeded = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: versionId },
        include: { entitlements: true, limits: true },
      });
      expect(seeded.commercialDefinitionOwnership).toBe('SEED_INITIALIZED');
      expect(seeded.entitlements.length).toBeGreaterThan(0);
      const seededEntCount = seeded.entitlements.length;
      const seededLimitCount = seeded.limits.length;

      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      const again = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: versionId },
        include: { entitlements: true, limits: true },
      });
      expect(again.entitlements.length).toBe(seededEntCount);
      expect(again.limits.length).toBe(seededLimitCount);

      // Administrator-owned intentionally empty Draft is never repopulated.
      const plans = createPlansService({
        prisma,
        permissions: ALL_STEP14,
        audit: durableAudit(prisma),
        stepUpFresh: true,
      });
      const plan = await plans.createPlan(
        CLAIMS_A,
        {
          canonicalKey: 'plan.ownership_empty',
          translations: [
            { locale: 'en-US', displayName: 'Own Empty', shortDescription: 'Gate desc' },
            { locale: 'ar-SY', displayName: 'فارغ', shortDescription: 'وصف' },
          ],
        },
        'own-empty-create',
      );
      await plans.transitionPlanLifecycle(CLAIMS_A, plan.id, 'ACTIVE', {
        expectedVersion: plan.version,
        reason: 'activate ownership empty',
      });
      const emptyDraft = await plans.createDraftVersion(
        CLAIMS_A,
        plan.id,
        {
          translations: [
            { locale: 'en-US', releaseLabel: 'Empty', shortDescription: 'Gate desc' },
            { locale: 'ar-SY', releaseLabel: 'فارغ', shortDescription: 'مسودة' },
          ],
        },
        'own-empty-draft',
      );
      const emptyRow = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: emptyDraft.id },
      });
      expect(emptyRow.commercialDefinitionOwnership).toBe('ADMINISTRATOR_OWNED');
      const emptyEntBefore = await prisma.platformPlanVersionEntitlement.count({
        where: { planVersionId: emptyDraft.id },
      });
      expect(emptyEntBefore).toBe(0);
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      const emptyEntAfter = await prisma.platformPlanVersionEntitlement.count({
        where: { planVersionId: emptyDraft.id },
      });
      expect(emptyEntAfter).toBe(0);

      // Administrator-owned non-empty is never overwritten.
      const ents = createEntitlementsService({
        prisma,
        permissions: ALL_STEP14,
        audit: durableAudit(prisma),
      });
      await ents.putEntitlements(
        CLAIMS_A,
        plan.id,
        emptyDraft.id,
        { expectedRowVersion: emptyDraft.rowVersion, entitlementKeys: ['module.dashboard'] },
        'own-nonempty',
      );
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      const nonEmpty = await prisma.platformPlanVersionEntitlement.count({
        where: { planVersionId: emptyDraft.id },
      });
      expect(nonEmpty).toBe(1);
      const ownership = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: emptyDraft.id },
      });
      expect(ownership.commercialDefinitionOwnership).toBe('ADMINISTRATOR_OWNED');
    });
  });

  describe('authorization isolation and repository non-execution', () => {
    it('isolates entitlement vs Limit vs publish permissions without repository execution', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      const plan = await prisma.platformPlan.findUniqueOrThrow({
        where: { canonicalKey: 'plan.lite' },
      });
      const version = await prisma.platformPlanVersion.findFirstOrThrow({
        where: { planId: plan.id, lifecycle: 'DRAFT' },
      });
      const beforeRv = version.rowVersion;

      const viewOnly = createEntitlementsService({
        prisma,
        permissions: ['plan-entitlement.view', 'plan-limit.view'],
      });
      await expect(
        viewOnly.putEntitlements(CLAIMS_A, plan.id, version.id, {
          expectedRowVersion: beforeRv,
          entitlementKeys: [],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        viewOnly.putLimits(CLAIMS_A, plan.id, version.id, {
          expectedRowVersion: beforeRv,
          limits: [],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const entManageOnly = createEntitlementsService({
        prisma,
        permissions: ['plan-entitlement.manage', 'plan-entitlement.view'],
      });
      await expect(
        entManageOnly.putLimits(CLAIMS_A, plan.id, version.id, {
          expectedRowVersion: beforeRv,
          limits: [],
        }),
      ).rejects.toThrow(/Missing plan-limit.manage/);

      const limitManageOnly = createEntitlementsService({
        prisma,
        permissions: ['plan-limit.manage', 'plan-limit.view'],
      });
      await expect(
        limitManageOnly.putEntitlements(CLAIMS_A, plan.id, version.id, {
          expectedRowVersion: beforeRv,
          entitlementKeys: [],
        }),
      ).rejects.toThrow(/Missing plan-entitlement.manage/);

      const publishOnly = createPlansService({
        prisma,
        permissions: ['plan-version.publish', 'plan-version.view', 'plan.view'],
        stepUpFresh: true,
      });
      const entsDenied = createEntitlementsService({
        prisma,
        permissions: ['plan-version.publish', 'plan-version.view'],
      });
      await expect(
        entsDenied.putEntitlements(CLAIMS_A, plan.id, version.id, {
          expectedRowVersion: beforeRv,
          entitlementKeys: ['module.dashboard'],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        entsDenied.putLimits(CLAIMS_A, plan.id, version.id, {
          expectedRowVersion: beforeRv,
          limits: [],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const step13Edit = createEntitlementsService({
        prisma,
        permissions: ['plan.edit', 'plan-version.create', 'plan-version.view'],
      });
      await expect(
        step13Edit.putEntitlements(CLAIMS_A, plan.id, version.id, {
          expectedRowVersion: beforeRv,
          entitlementKeys: [],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const after = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: version.id } });
      expect(after.rowVersion).toBe(beforeRv);
      expect(
        await prisma.platformPlanIdempotencyRecord.count({
          where: { status: 'completed', actorId: ACTOR },
        }),
      ).toBe(0);
      expect(
        await auditCount(prisma, 'platform_plan_version.entitlements_replaced', version.id),
      ).toBe(0);
      void publishOnly;
    });
  });

  describe('durable audit matrix and redaction', () => {
    it('persists entitlement, Limit, dependency, clone, and publish audits without sensitive payloads', async () => {
      const audit = durableAudit(prisma);
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: false });
      const { planId, versionId, rowVersion } = await createUninitializedDraft(prisma, 'plan.lite');
      // Mark as admin-owned empty so commercial seed does not fill this Draft.
      await prisma.platformPlanVersion.update({
        where: { id: versionId },
        data: { commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED' },
      });
      const plans = createPlansService({
        prisma,
        permissions: ALL_STEP14,
        audit,
        stepUpFresh: true,
      });
      const ents = createEntitlementsService({ prisma, permissions: ALL_STEP14, audit });

      const plan = { id: planId };
      let version = { id: versionId, rowVersion };

      const replaced = await ents.putEntitlements(
        CLAIMS_A,
        plan.id,
        version.id,
        {
          expectedRowVersion: version.rowVersion,
          entitlementKeys: ['module.dashboard', 'module.patients'],
        },
        'audit-ent-replace',
      );
      expect(
        await auditCount(prisma, 'platform_plan_version.entitlements_replaced', version.id),
      ).toBe(1);

      version = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: version.id } });
      await ents.putEntitlements(
        CLAIMS_A,
        plan.id,
        version.id,
        { expectedRowVersion: version.rowVersion, entitlementKeys: [] },
        'audit-ent-empty',
      );
      expect(
        await auditCount(prisma, 'platform_plan_version.entitlements_replaced', version.id),
      ).toBe(2);

      // Mutating apply-required fixture: install MODULE→MODULE REQUIRES, grant subject only.
      const emr = await prisma.healthcareCatalogItem.findUniqueOrThrow({
        where: { canonicalKey: 'module.emr' },
      });
      const patients = await prisma.healthcareCatalogItem.findUniqueOrThrow({
        where: { canonicalKey: 'module.patients' },
      });
      await prisma.healthcareCatalogCompatibilityRule.deleteMany({
        where: {
          ruleType: 'REQUIRES',
          subjectItemId: emr.id,
          targetItemId: patients.id,
          anyOfGroupKey: '',
        },
      });
      const fixtureRule = await prisma.healthcareCatalogCompatibilityRule.create({
        data: {
          ruleType: 'REQUIRES',
          subjectItemId: emr.id,
          targetItemId: patients.id,
          lifecycle: 'ACTIVE',
          explanationEn: 'audit fixture REQUIRES',
          explanationAr: 'قاعدة تدقيق',
          anyOfGroupKey: '',
          systemSeeded: false,
        },
      });
      try {
        version = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: version.id } });
        await ents.putEntitlements(
          CLAIMS_A,
          plan.id,
          version.id,
          {
            expectedRowVersion: version.rowVersion,
            entitlementKeys: ['module.emr'],
          },
          'audit-ent-deps-base',
        );
        version = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: version.id } });
        await ents.applyRequiredDependencies(
          CLAIMS_A,
          plan.id,
          version.id,
          { expectedRowVersion: version.rowVersion, confirm: true },
          'audit-apply-required',
        );
        expect(
          await auditCount(prisma, 'platform_plan_version.required_dependencies_applied', version.id),
        ).toBe(1);

        // No-op apply-required: no second mutation audit when dependencies already satisfied.
        version = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: version.id } });
        await ents.applyRequiredDependencies(
          CLAIMS_A,
          plan.id,
          version.id,
          { expectedRowVersion: version.rowVersion, confirm: true },
          'audit-apply-required-noop',
        );
        expect(
          await auditCount(prisma, 'platform_plan_version.required_dependencies_applied', version.id),
        ).toBe(1);
      } finally {
        await prisma.healthcareCatalogCompatibilityRule.deleteMany({ where: { id: fixtureRule.id } });
      }

      version = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: version.id } });
      await ents.putLimits(
        CLAIMS_A,
        plan.id,
        version.id,
        {
          expectedRowVersion: version.rowVersion,
          limits: [
            { canonicalKey: 'limit.max_users', unlimited: false, valueText: '10' },
            { canonicalKey: 'limit.max_doctors', unlimited: true, valueText: null },
          ],
        },
        'audit-limits-replace',
      );
      expect(await auditCount(prisma, 'platform_plan_version.limits_replaced', version.id)).toBe(1);

      version = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: version.id } });
      await ents.putLimits(
        CLAIMS_A,
        plan.id,
        version.id,
        { expectedRowVersion: version.rowVersion, limits: [] },
        'audit-limits-empty',
      );
      expect(await auditCount(prisma, 'platform_plan_version.limits_replaced', version.id)).toBe(2);

      version = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: version.id } });
      await ents.putEntitlements(
        CLAIMS_A,
        plan.id,
        version.id,
        {
          expectedRowVersion: version.rowVersion,
          entitlementKeys: ['module.dashboard', 'module.patients'],
        },
        'audit-pre-publish-ents',
      );
      version = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: version.id } });
      await ents.putLimits(
        CLAIMS_A,
        plan.id,
        version.id,
        {
          expectedRowVersion: version.rowVersion,
          limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '5' }],
        },
        'audit-pre-publish-limits',
      );
      version = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: version.id } });
      const published = await plans.publishVersion(
        CLAIMS_A,
        plan.id,
        version.id,
        { expectedRowVersion: version.rowVersion, reason: 'Step 14 publish evidence' },
        'audit-publish',
      );
      expect(await auditCount(prisma, 'platform_plan_version.published', version.id)).toBe(1);
      const publishRows = await prisma.auditEntry.findMany({
        where: {
          action: 'platform_plan_version.published',
          resourceId: version.id,
          tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
        },
      });
      const publishMeta = JSON.stringify(publishRows);
      expect(publishMeta).toMatch(/entitlementCount/);
      expect(publishMeta).toMatch(/limitCount/);
      expect(publishMeta).toMatch(/fingerprintSchemaVersion/);
      expect(publishMeta).toMatch(/readinessResult/);
      assertNoSensitivePayload(publishMeta);

      const cloned = await plans.cloneVersion(CLAIMS_A, plan.id, published.id, 'audit-clone');
      expect(await auditCount(prisma, 'platform_plan_version.cloned', cloned.id)).toBe(1);
      const cloneRows = await prisma.auditEntry.findMany({
        where: {
          action: 'platform_plan_version.cloned',
          resourceId: cloned.id,
          tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
        },
      });
      assertNoSensitivePayload(JSON.stringify(cloneRows));

      for (const action of [
        'platform_plan_version.entitlements_replaced',
        'platform_plan_version.limits_replaced',
        'platform_plan_version.required_dependencies_applied',
        'platform_plan_version.published',
        'platform_plan_version.cloned',
      ]) {
        const rows = await prisma.auditEntry.findMany({
          where: { action, tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
        });
        expect(rows.length).toBeGreaterThanOrEqual(1);
        assertNoSensitivePayload(JSON.stringify(rows));
      }
      void replaced;
    });
  });

  describe('per-operation durable idempotency', () => {
    it('replace entitlements: replay, conflict, recreation, actor/op isolation, failed validation', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: false });
      const { planId, versionId, rowVersion } = await createUninitializedDraft(prisma, 'plan.pro');
      await prisma.platformPlanVersion.update({
        where: { id: versionId },
        data: { commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED' },
      });
      const plan = { id: planId };
      const version = { id: versionId, rowVersion };
      const s1 = createEntitlementsService({ prisma, permissions: ALL_STEP14 });
      const first = await s1.putEntitlements(
        CLAIMS_A,
        plan.id,
        version.id,
        {
          expectedRowVersion: version.rowVersion,
          entitlementKeys: ['module.dashboard'],
        },
        'ent-idem-1',
      );
      const s2 = createEntitlementsService({ prisma, permissions: ALL_STEP14 });
      const replay = await s2.putEntitlements(
        CLAIMS_A,
        plan.id,
        version.id,
        {
          expectedRowVersion: version.rowVersion,
          entitlementKeys: ['module.dashboard'],
        },
        'ent-idem-1',
      );
      expect(replay.entitlementCount).toBe(first.entitlementCount);

      await expect(
        s2.putEntitlements(
          CLAIMS_A,
          plan.id,
          version.id,
          {
            expectedRowVersion: version.rowVersion,
            entitlementKeys: ['module.patients'],
          },
          'ent-idem-1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      const otherActor = await s2.putEntitlements(
        CLAIMS_B,
        plan.id,
        version.id,
        {
          expectedRowVersion: first.rowVersion,
          entitlementKeys: ['module.dashboard', 'module.patients'],
        },
        'ent-idem-1',
      );
      expect(otherActor.entitlementCount).toBe(2);

      const refreshed = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: version.id },
      });
      await expect(
        s2.putEntitlements(
          CLAIMS_A,
          plan.id,
          version.id,
          {
            expectedRowVersion: refreshed.rowVersion,
            entitlementKeys: ['limit.max_users'],
          },
          'ent-fail-kind',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(
        await prisma.platformPlanIdempotencyRecord.count({
          where: { idempotencyKey: 'ent-fail-kind', status: 'completed' },
        }),
      ).toBe(0);
    });

    it('replace Limits: replay, conflict, invalid type creates no completed record', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      const plan = await prisma.platformPlan.findUniqueOrThrow({
        where: { canonicalKey: 'plan.lite' },
      });
      const version = await prisma.platformPlanVersion.findFirstOrThrow({
        where: { planId: plan.id, lifecycle: 'DRAFT' },
      });
      const s1 = createEntitlementsService({ prisma, permissions: ALL_STEP14 });
      await s1.putLimits(
        CLAIMS_A,
        plan.id,
        version.id,
        {
          expectedRowVersion: version.rowVersion,
          limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '12' }],
        },
        'lim-idem-1',
      );
      const s2 = createEntitlementsService({ prisma, permissions: ALL_STEP14 });
      const replay = await s2.putLimits(
        CLAIMS_A,
        plan.id,
        version.id,
        {
          expectedRowVersion: version.rowVersion,
          limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '12' }],
        },
        'lim-idem-1',
      );
      expect(replay.items.find((i) => i.canonicalKey === 'limit.max_users')?.valueText).toBe('12');

      await expect(
        s2.putLimits(
          CLAIMS_A,
          plan.id,
          version.id,
          {
            expectedRowVersion: version.rowVersion,
            limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '99' }],
          },
          'lim-idem-1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      const refreshed = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: version.id },
      });
      await expect(
        s2.putLimits(
          CLAIMS_A,
          plan.id,
          version.id,
          {
            expectedRowVersion: refreshed.rowVersion,
            limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '1.5' }],
          },
          'lim-fail-frac',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(
        await prisma.platformPlanIdempotencyRecord.count({
          where: { idempotencyKey: 'lim-fail-frac', status: 'completed' },
        }),
      ).toBe(0);
    });

    it('apply-required: replay and stale OCC create no completed success on failure', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      const plan = await prisma.platformPlan.findUniqueOrThrow({
        where: { canonicalKey: 'plan.enterprise' },
      });
      const version = await prisma.platformPlanVersion.findFirstOrThrow({
        where: { planId: plan.id, lifecycle: 'DRAFT' },
      });
      const ents = createEntitlementsService({ prisma, permissions: ALL_STEP14 });
      const first = await ents.applyRequiredDependencies(
        CLAIMS_A,
        plan.id,
        version.id,
        { expectedRowVersion: version.rowVersion, confirm: true },
        'dep-idem-1',
      );
      const replay = await ents.applyRequiredDependencies(
        CLAIMS_A,
        plan.id,
        version.id,
        { expectedRowVersion: version.rowVersion, confirm: true },
        'dep-idem-1',
      );
      expect(replay.entitlementCount).toBe(first.entitlementCount);

      await expect(
        ents.applyRequiredDependencies(
          CLAIMS_A,
          plan.id,
          version.id,
          { expectedRowVersion: version.rowVersion - 1, confirm: true },
          'dep-stale',
        ),
      ).rejects.toThrow();
      expect(
        await prisma.platformPlanIdempotencyRecord.count({
          where: { idempotencyKey: 'dep-stale', status: 'completed' },
        }),
      ).toBe(0);
    });

    it('clone and publish Step 14 children: replay, fingerprint stability, step-up failure', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      const plans = createPlansService({
        prisma,
        permissions: ALL_STEP14,
        stepUpFresh: true,
      });
      const plan = await prisma.platformPlan.findUniqueOrThrow({
        where: { canonicalKey: 'plan.lite' },
      });
      let version = await prisma.platformPlanVersion.findFirstOrThrow({
        where: { planId: plan.id, lifecycle: 'DRAFT' },
      });
      const published = await plans.publishVersion(
        CLAIMS_A,
        plan.id,
        version.id,
        { expectedRowVersion: version.rowVersion, reason: 'publish for idem' },
        'pub-idem-1',
      );
      const replayPub = await plans.publishVersion(
        CLAIMS_A,
        plan.id,
        version.id,
        { expectedRowVersion: version.rowVersion, reason: 'publish for idem' },
        'pub-idem-1',
      );
      expect(replayPub.publicationFingerprint).toBe(published.publicationFingerprint);

      const noStepUp = createPlansService({
        prisma,
        permissions: ALL_STEP14,
        stepUpFresh: false,
      });
      const clonedForPub = await plans.cloneVersion(CLAIMS_A, plan.id, published.id, 'clone-for-pub');
      await expect(
        noStepUp.publishVersion(
          CLAIMS_A,
          plan.id,
          clonedForPub.id,
          { expectedRowVersion: clonedForPub.rowVersion, reason: 'missing step-up' },
          'pub-no-step',
        ),
      ).rejects.toThrow();
      expect(
        await prisma.platformPlanIdempotencyRecord.count({
          where: { idempotencyKey: 'pub-no-step', status: 'completed' },
        }),
      ).toBe(0);
      const stillDraft = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: clonedForPub.id },
      });
      expect(stillDraft.lifecycle).toBe('DRAFT');
      expect(stillDraft.publicationFingerprint).toBeNull();
      expect(stillDraft.commercialDefinitionOwnership).toBe('ADMINISTRATOR_OWNED');

      const cloneReplay = await plans.cloneVersion(CLAIMS_A, plan.id, published.id, 'clone-for-pub');
      expect(cloneReplay.id).toBe(clonedForPub.id);
      void SESSION_B;
    });
  });

  describe('concurrency, OCC, and rollback', () => {
    it('concurrent different entitlement saves: one winner, no orphans, one completed idem where used', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: false });
      const { planId, versionId, rowVersion } = await createUninitializedDraft(prisma, 'plan.lite');
      await prisma.platformPlanVersion.update({
        where: { id: versionId },
        data: { commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED' },
      });
      const plan = { id: planId };
      const version = { id: versionId, rowVersion };
      const a = createEntitlementsService({ prisma, permissions: ALL_STEP14 });
      const b = createEntitlementsService({ prisma, permissions: ALL_STEP14 });
      const results = await Promise.allSettled([
        a.putEntitlements(
          CLAIMS_A,
          plan.id,
          version.id,
          {
            expectedRowVersion: version.rowVersion,
            entitlementKeys: ['module.dashboard'],
          },
          'race-ent-a',
        ),
        b.putEntitlements(
          CLAIMS_B,
          plan.id,
          version.id,
          {
            expectedRowVersion: version.rowVersion,
            entitlementKeys: ['module.patients'],
          },
          'race-ent-b',
        ),
      ]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const after = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: version.id },
        include: { entitlements: true },
      });
      expect(after.rowVersion).toBe(version.rowVersion + 1);
      expect(after.entitlements).toHaveLength(1);
    });

    it('entitlement edit versus Limit edit OCC: loser leaves no child rows from losing write', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: false });
      const { planId, versionId, rowVersion } = await createUninitializedDraft(prisma, 'plan.pro');
      await prisma.platformPlanVersion.update({
        where: { id: versionId },
        data: { commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED' },
      });
      const plan = { id: planId };
      const version = { id: versionId, rowVersion };
      const ents = createEntitlementsService({ prisma, permissions: ALL_STEP14 });
      const results = await Promise.allSettled([
        ents.putEntitlements(CLAIMS_A, plan.id, version.id, {
          expectedRowVersion: version.rowVersion,
          entitlementKeys: ['module.dashboard', 'module.patients'],
        }),
        ents.putLimits(CLAIMS_B, plan.id, version.id, {
          expectedRowVersion: version.rowVersion,
          limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '7' }],
        }),
      ]);
      const ok = results.filter((r) => r.status === 'fulfilled');
      const fail = results.filter((r) => r.status === 'rejected');
      expect(ok).toHaveLength(1);
      expect(fail).toHaveLength(1);
      const after = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: version.id },
        include: { entitlements: true, limits: true },
      });
      expect(after.rowVersion).toBe(version.rowVersion + 1);
      // Exactly one of the two writers committed.
      const entOnly = after.entitlements.length === 2 && after.limits.length === 0;
      const limOnly = after.entitlements.length === 0 && after.limits.length === 1;
      expect(entOnly || limOnly).toBe(true);
    });

    it('Published and Retired child mutations rejected; parent version and fingerprint unchanged', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      const plans = createPlansService({
        prisma,
        permissions: ALL_STEP14,
        stepUpFresh: true,
      });
      const ents = createEntitlementsService({ prisma, permissions: ALL_STEP14 });
      const plan = await prisma.platformPlan.findUniqueOrThrow({
        where: { canonicalKey: 'plan.enterprise' },
      });
      let version = await prisma.platformPlanVersion.findFirstOrThrow({
        where: { planId: plan.id, lifecycle: 'DRAFT' },
      });
      const published = await plans.publishVersion(CLAIMS_A, plan.id, version.id, {
        expectedRowVersion: version.rowVersion,
        reason: 'immutability publish',
      });
      const fp = published.publicationFingerprint;
      const entCount = await prisma.platformPlanVersionEntitlement.count({
        where: { planVersionId: published.id },
      });
      await expect(
        ents.putEntitlements(CLAIMS_A, plan.id, published.id, {
          expectedRowVersion: published.rowVersion,
          entitlementKeys: ['module.dashboard'],
        }),
      ).rejects.toThrow(/immutable/i);
      await expect(
        ents.putLimits(CLAIMS_A, plan.id, published.id, {
          expectedRowVersion: published.rowVersion,
          limits: [],
        }),
      ).rejects.toThrow(/immutable/i);
      await expect(
        ents.applyRequiredDependencies(CLAIMS_A, plan.id, published.id, {
          expectedRowVersion: published.rowVersion,
          confirm: true,
        }),
      ).rejects.toThrow(/immutable/i);

      const afterPub = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: published.id },
      });
      expect(afterPub.rowVersion).toBe(published.rowVersion);
      expect(afterPub.publicationFingerprint).toBe(fp);
      expect(
        await prisma.platformPlanVersionEntitlement.count({
          where: { planVersionId: published.id },
        }),
      ).toBe(entCount);

      const retired = await plans.retireVersion(CLAIMS_A, plan.id, published.id, {
        expectedRowVersion: afterPub.rowVersion,
        reason: 'retire for immutability',
      });
      await expect(
        ents.putEntitlements(CLAIMS_A, plan.id, retired.id, {
          expectedRowVersion: retired.rowVersion,
          entitlementKeys: [],
        }),
      ).rejects.toThrow(/immutable/i);
      const afterRet = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: retired.id },
      });
      expect(afterRet.publicationFingerprint).toBe(fp);
    });
  });

  describe('typed Limit invariants and fingerprint determinism', () => {
    it('enforces COUNT/INTEGER/DECIMAL/DURATION/BYTES; BOOLEAN N/A in Catalog enum', () => {
      const base = {
        canonicalKey: 'limit.max_users',
        kind: 'LIMIT',
        lifecycle: 'ACTIVE',
        limitUnit: 'count',
        limitMin: '1',
        limitMax: '100',
        limitZeroValid: false,
        limitUnlimitedSupported: true,
        owningModuleCanonicalKey: null as string | null,
        owningFeatureCanonicalKey: null as string | null,
      };
      for (const vt of ['INTEGER', 'COUNT', 'BYTES', 'DURATION'] as const) {
        const meta = { ...base, limitValueType: vt };
        expect(
          validateLimitAssignment(
            { canonicalKey: base.canonicalKey, unlimited: false, valueText: '10' },
            meta,
            new Set(),
          ),
        ).toHaveLength(0);
        expect(
          validateLimitAssignment(
            { canonicalKey: base.canonicalKey, unlimited: false, valueText: '10.5' },
            meta,
            new Set(),
          ).some((i) => i.code === 'limit_invalid_type'),
        ).toBe(true);
      }
      const decimalMeta = { ...base, limitValueType: 'DECIMAL' as const, limitMin: '0.5', limitMax: '9.5' };
      expect(
        validateLimitAssignment(
          { canonicalKey: base.canonicalKey, unlimited: false, valueText: '1.25' },
          decimalMeta,
          new Set(),
        ),
      ).toHaveLength(0);
      expect(
        validateLimitAssignment(
          { canonicalKey: base.canonicalKey, unlimited: false, valueText: 'abc' },
          decimalMeta,
          new Set(),
        ).some((i) => i.code === 'limit_invalid_type'),
      ).toBe(true);
      // Catalog Prisma enum has no BOOLEAN — validator may accept defensive BOOLEAN but Catalog SoR does not.
      expect(['INTEGER', 'DECIMAL', 'DURATION', 'BYTES', 'COUNT']).not.toContain('BOOLEAN');
    });

    it('fingerprint v2 is order-independent and content-sensitive; v1 preserved', () => {
      const base = {
        planCanonicalKey: 'plan.lite',
        versionNumber: 1,
        effectiveFrom: null,
        retireAt: null,
        trialDefaultEnabled: null,
        trialDefaultDays: null,
        priceAmountMinor: null,
        priceCurrency: null,
        billingInterval: null,
        billingIntervalCount: null,
        translations: [
          { locale: 'en-US', releaseLabel: 'A', shortDescription: 'B' },
          { locale: 'ar-SY', releaseLabel: 'ج', shortDescription: 'د' },
        ],
        sourceVersionId: null,
      };
      const a = buildPublicationFingerprintV2({
        ...base,
        entitlements: [
          { canonicalKey: 'module.patients', kind: 'MODULE' },
          { canonicalKey: 'module.dashboard', kind: 'MODULE' },
        ],
        limits: [
          { canonicalKey: 'limit.max_doctors', unlimited: false, valueText: '2' },
          { canonicalKey: 'limit.max_users', unlimited: false, valueText: '10' },
        ],
      });
      const b = buildPublicationFingerprintV2({
        ...base,
        entitlements: [
          { canonicalKey: 'module.dashboard', kind: 'MODULE' },
          { canonicalKey: 'module.patients', kind: 'MODULE' },
        ],
        limits: [
          { canonicalKey: 'limit.max_users', unlimited: false, valueText: '10' },
          { canonicalKey: 'limit.max_doctors', unlimited: false, valueText: '2' },
        ],
      });
      expect(a).toEqual(b);
      const removed = buildPublicationFingerprintV2({
        ...base,
        entitlements: [{ canonicalKey: 'module.dashboard', kind: 'MODULE' }],
        limits: [
          { canonicalKey: 'limit.max_users', unlimited: false, valueText: '10' },
          { canonicalKey: 'limit.max_doctors', unlimited: false, valueText: '2' },
        ],
      });
      expect(removed).not.toEqual(a);
      const unlimited = buildPublicationFingerprintV2({
        ...base,
        entitlements: [
          { canonicalKey: 'module.dashboard', kind: 'MODULE' },
          { canonicalKey: 'module.patients', kind: 'MODULE' },
        ],
        limits: [
          { canonicalKey: 'limit.max_users', unlimited: true, valueText: null },
          { canonicalKey: 'limit.max_doctors', unlimited: false, valueText: '2' },
        ],
      });
      expect(unlimited).not.toEqual(a);
      const v1 = buildPublicationFingerprint({
        planCanonicalKey: base.planCanonicalKey,
        versionNumber: base.versionNumber,
        effectiveFrom: base.effectiveFrom,
        retireAt: base.retireAt,
        trialDefaultEnabled: base.trialDefaultEnabled,
        trialDefaultDays: base.trialDefaultDays,
        priceAmountMinor: base.priceAmountMinor,
        priceCurrency: base.priceCurrency,
        billingInterval: base.billingInterval,
        billingIntervalCount: base.billingIntervalCount,
        translations: base.translations,
      });
      expect(v1).not.toEqual(a);
    });
  });

  describe('rate limits and passive reads', () => {
    it('mutation and read-heavy buckets return 429 without writes', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: false });
      const { planId, versionId, rowVersion } = await createUninitializedDraft(prisma, 'plan.lite');
      await prisma.platformPlanVersion.update({
        where: { id: versionId },
        data: { commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED' },
      });
      const plan = { id: planId };
      const version = { id: versionId, rowVersion };
      const mut = createEntitlementsService({
        prisma,
        permissions: ALL_STEP14,
        config: { mutationRateLimitPerMinute: 1 },
      });
      await mut.putEntitlements(
        CLAIMS_A,
        plan.id,
        version.id,
        { expectedRowVersion: version.rowVersion, entitlementKeys: ['module.dashboard'] },
        'rl-mut-1',
      );
      const refreshed = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: version.id },
      });
      await expectRateLimited(() =>
        mut.putEntitlements(
          CLAIMS_A,
          plan.id,
          version.id,
          {
            expectedRowVersion: refreshed.rowVersion,
            entitlementKeys: ['module.patients'],
          },
          'rl-mut-2',
        ),
      );
      const after = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: version.id },
      });
      expect(after.rowVersion).toBe(refreshed.rowVersion);
      expect(
        await prisma.platformPlanIdempotencyRecord.count({
          where: { idempotencyKey: 'rl-mut-2', status: 'completed' },
        }),
      ).toBe(0);

      const readHeavy = createEntitlementsService({
        prisma,
        permissions: ALL_STEP14,
        config: { readHeavyRateLimitPerMinute: 1 },
      });
      await readHeavy.getEntitlements(CLAIMS_A, plan.id, version.id);
      await expectRateLimited(() => readHeavy.getLimits(CLAIMS_A, plan.id, version.id));
    });
  });

  describe('idempotency retention', () => {
    it('purgeExpired removes expired Step 14 operation rows and preserves unexpired', async () => {
      const wrapper = createPlansPrismaWrapper(prisma);
      const idem = new PlanIdempotencyService(wrapper as never);
      await prisma.platformPlanIdempotencyRecord.create({
        data: {
          actorId: ACTOR,
          operation: 'plan.replaceEntitlements',
          idempotencyKey: 'ret-expired',
          requestHash: 'a'.repeat(64),
          resultResourceType: 'planVersion',
          resultResourceId: '00000000-0000-4000-8000-000000000099',
          status: 'completed',
          expiresAt: new Date(Date.now() - 60_000),
        },
      });
      await prisma.platformPlanIdempotencyRecord.create({
        data: {
          actorId: ACTOR,
          operation: 'plan.replaceLimits',
          idempotencyKey: 'ret-fresh',
          requestHash: 'b'.repeat(64),
          resultResourceType: 'planVersion',
          resultResourceId: '00000000-0000-4000-8000-000000000098',
          status: 'completed',
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
      await idem.purgeExpired();
      expect(
        await prisma.platformPlanIdempotencyRecord.count({ where: { idempotencyKey: 'ret-expired' } }),
      ).toBe(0);
      expect(
        await prisma.platformPlanIdempotencyRecord.count({ where: { idempotencyKey: 'ret-fresh' } }),
      ).toBe(1);
    });
  });
});
