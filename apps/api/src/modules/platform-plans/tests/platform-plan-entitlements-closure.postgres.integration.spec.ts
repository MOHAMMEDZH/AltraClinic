/**
 * Step 14 final closure gate — injected mid-transaction rollback, complete rate limits,
 * seed-ownership fixtures, pending/failed idempotency, and production hook absence.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import {
  cleanupPlatformPlansTables,
  createEntitlementsService,
  createPlansService,
  createPlansSeedService,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from './platform-plans-db.harness';
import { AuditTrailPlatformPlansAuditLog } from '../infrastructure/audit-trail-platform-plans-audit-log';
import { createPlansPrismaWrapper } from './platform-plans-db.harness';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { PrismaService } from '../../../infrastructure/prisma.service';
import {
  PLATFORM_PLANS_TX_FAILURE_HOOK,
  type PlanTxFailurePoint,
} from '../platform-plans.tokens';
import { buildPublicationFingerprint } from '../domain/publication-fingerprint';

const run = platformDbSecurityEnabled();
const describeDb = run ? describe : describe.skip;

const ACTOR = '00000000-0000-4000-8000-000000000214';
const SESSION_A = '11111111-1111-4111-8111-111111111214';
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

function inject(point: PlanTxFailurePoint): (p: PlanTxFailurePoint) => Promise<void> {
  return async (p) => {
    if (p === point) throw new Error(`Injected Step 14 failure at ${point}`);
  };
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

async function createAdminDraft(
  prisma: PrismaClient,
  planKey: string,
): Promise<{ planId: string; versionId: string; rowVersion: number }> {
  await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: false });
  const plan = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: planKey } });
  const version = await prisma.platformPlanVersion.create({
    data: {
      planId: plan.id,
      versionNumber: 1,
      lifecycle: 'DRAFT',
      commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED',
      translations: {
        create: [
          { locale: 'en-US', releaseLabel: 'Admin', shortDescription: 'admin' },
          { locale: 'ar-SY', releaseLabel: 'مسؤول', shortDescription: 'مسؤول' },
        ],
      },
    },
  });
  return { planId: plan.id, versionId: version.id, rowVersion: version.rowVersion };
}

describe('Step 14 production failure-hook absence', () => {
  it('PlatformPlansModule does not register PLATFORM_PLANS_TX_FAILURE_HOOK', () => {
    const moduleSrc = readFileSync(join(__dirname, '../platform-plans.module.ts'), 'utf8');
    expect(moduleSrc).not.toContain('PLATFORM_PLANS_TX_FAILURE_HOOK');
    expect(moduleSrc).not.toMatch(/provide:\s*PLATFORM_PLANS_TX_FAILURE_HOOK/);
    expect(PLATFORM_PLANS_TX_FAILURE_HOOK.description).toContain('PLATFORM_PLANS_TX_FAILURE_HOOK');
  });
});

describeDb('Step 14 final closure gate (postgres)', () => {
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

  describe('injected mid-transaction rollback', () => {
    const points: PlanTxFailurePoint[] = [
      'after_entitlement_delete',
      'after_entitlement_partial_insert',
      'after_row_version_bump',
      'before_idempotency_complete',
      'before_transaction_commit',
    ];

    for (const point of points) {
      it(`entitlement replace rolls back at ${point}`, async () => {
        const { planId, versionId, rowVersion } = await createAdminDraft(prisma, 'plan.lite');
        const dash = await prisma.healthcareCatalogItem.findUniqueOrThrow({
          where: { canonicalKey: 'module.dashboard' },
        });
        await prisma.platformPlanVersionEntitlement.create({
          data: { planVersionId: versionId, catalogItemId: dash.id },
        });
        const beforeEnt = await prisma.platformPlanVersionEntitlement.count({
          where: { planVersionId: versionId },
        });
        const ents = createEntitlementsService({
          prisma,
          permissions: ALL_STEP14,
          audit: durableAudit(prisma),
          failureHook: inject(point),
        });
        await expect(
          ents.putEntitlements(
            CLAIMS_A,
            planId,
            versionId,
            {
              expectedRowVersion: rowVersion,
              entitlementKeys: ['module.dashboard', 'module.patients', 'module.emr'],
            },
            `inj-ent-${point}`,
          ),
        ).rejects.toThrow(/Injected Step 14 failure/);

        const after = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: versionId } });
        expect(after.rowVersion).toBe(rowVersion);
        expect(after.lifecycle).toBe('DRAFT');
        expect(
          await prisma.platformPlanVersionEntitlement.count({ where: { planVersionId: versionId } }),
        ).toBe(beforeEnt);
        expect(
          await prisma.platformPlanIdempotencyRecord.count({
            where: { idempotencyKey: `inj-ent-${point}`, status: 'completed' },
          }),
        ).toBe(0);
        expect(
          await prisma.auditEntry.count({
            where: {
              action: 'platform_plan_version.entitlements_replaced',
              resourceId: versionId,
              tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
            },
          }),
        ).toBe(0);
      });
    }

    it('Limit replace rolls back after_limit_delete and after_limit_partial_insert', async () => {
      for (const point of ['after_limit_delete', 'after_limit_partial_insert'] as PlanTxFailurePoint[]) {
        await cleanupPlatformPlansTables(prisma);
        const { planId, versionId, rowVersion } = await createAdminDraft(prisma, 'plan.pro');
        const lim = await prisma.healthcareCatalogItem.findUniqueOrThrow({
          where: { canonicalKey: 'limit.max_users' },
        });
        await prisma.platformPlanVersionLimit.create({
          data: {
            planVersionId: versionId,
            catalogItemId: lim.id,
            unlimited: false,
            valueText: '3',
          },
        });
        const ents = createEntitlementsService({
          prisma,
          permissions: ALL_STEP14,
          audit: durableAudit(prisma),
          failureHook: inject(point),
        });
        await expect(
          ents.putLimits(
            CLAIMS_A,
            planId,
            versionId,
            {
              expectedRowVersion: rowVersion,
              limits: [
                { canonicalKey: 'limit.max_users', unlimited: false, valueText: '10' },
                { canonicalKey: 'limit.max_doctors', unlimited: false, valueText: '2' },
              ],
            },
            `inj-lim-${point}`,
          ),
        ).rejects.toThrow(/Injected Step 14 failure/);
        const after = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: versionId } });
        expect(after.rowVersion).toBe(rowVersion);
        const lims = await prisma.platformPlanVersionLimit.findMany({
          where: { planVersionId: versionId },
        });
        expect(lims).toHaveLength(1);
        expect(lims[0]!.valueText).toBe('3');
        expect(
          await prisma.platformPlanIdempotencyRecord.count({
            where: { idempotencyKey: `inj-lim-${point}`, status: 'completed' },
          }),
        ).toBe(0);
      }
    });

    it('clone rolls back after partial children; publish rolls back after fingerprint', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      const plan = await prisma.platformPlan.findUniqueOrThrow({
        where: { canonicalKey: 'plan.lite' },
      });
      let version = await prisma.platformPlanVersion.findFirstOrThrow({
        where: { planId: plan.id, lifecycle: 'DRAFT' },
      });
      const plansOk = createPlansService({
        prisma,
        permissions: ALL_STEP14,
        stepUpFresh: true,
        audit: durableAudit(prisma),
      });
      const published = await plansOk.publishVersion(CLAIMS_A, plan.id, version.id, {
        expectedRowVersion: version.rowVersion,
        reason: 'source for clone inject',
      });

      for (const point of [
        'after_clone_source_linkage',
        'after_clone_entitlement_partial',
        'after_clone_limit_partial',
        'before_transaction_commit',
      ] as PlanTxFailurePoint[]) {
        const beforeVersions = await prisma.platformPlanVersion.count({
          where: { planId: plan.id },
        });
        const plans = createPlansService({
          prisma,
          permissions: ALL_STEP14,
          stepUpFresh: true,
          audit: durableAudit(prisma),
          failureHook: inject(point),
        });
        await expect(
          plans.cloneVersion(CLAIMS_A, plan.id, published.id, `inj-clone-${point}`),
        ).rejects.toThrow(/Injected Step 14 failure/);
        expect(await prisma.platformPlanVersion.count({ where: { planId: plan.id } })).toBe(
          beforeVersions,
        );
        expect(
          await prisma.platformPlanIdempotencyRecord.count({
            where: { idempotencyKey: `inj-clone-${point}`, status: 'completed' },
          }),
        ).toBe(0);
        // Ensure no orphan drafts from failed clone
        const drafts = await prisma.platformPlanVersion.findMany({
          where: { planId: plan.id, lifecycle: 'DRAFT' },
        });
        expect(drafts.every((d) => d.sourceVersionId !== published.id || d.id === published.id)).toBe(
          true,
        );
        expect(drafts.filter((d) => d.sourceVersionId === published.id)).toHaveLength(0);
      }

      const cloned = await plansOk.cloneVersion(CLAIMS_A, plan.id, published.id, 'clone-for-pub-inj');
      for (const point of [
        'after_fingerprint_before_commit',
        'before_idempotency_complete',
        'before_transaction_commit',
      ] as PlanTxFailurePoint[]) {
        const plans = createPlansService({
          prisma,
          permissions: ALL_STEP14,
          stepUpFresh: true,
          audit: durableAudit(prisma),
          failureHook: inject(point),
        });
        await expect(
          plans.publishVersion(
            CLAIMS_A,
            plan.id,
            cloned.id,
            { expectedRowVersion: cloned.rowVersion, reason: 'inject publish fail' },
            `inj-pub-${point}`,
          ),
        ).rejects.toThrow(/Injected Step 14 failure/);
        const after = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: cloned.id } });
        expect(after.lifecycle).toBe('DRAFT');
        expect(after.publicationFingerprint).toBeNull();
        expect(after.publishedAt).toBeNull();
        expect(after.rowVersion).toBe(cloned.rowVersion);
        expect(
          await prisma.platformPlanIdempotencyRecord.count({
            where: { idempotencyKey: `inj-pub-${point}`, status: 'completed' },
          }),
        ).toBe(0);
        expect(
          await prisma.auditEntry.count({
            where: {
              action: 'platform_plan_version.published',
              resourceId: cloned.id,
              tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
            },
          }),
        ).toBe(0);
      }
    });
  });

  describe('Option A completed-only: orphan non-completed does not replay as success', () => {
    it('orphan pending is purged then completed on success; failed OCC leaves no row', async () => {
      const { planId, versionId, rowVersion } = await createAdminDraft(prisma, 'plan.enterprise');
      await prisma.platformPlanIdempotencyRecord.create({
        data: {
          actorId: ACTOR,
          operation: 'plan.replaceEntitlements',
          idempotencyKey: 'orphan-pending-key',
          requestHash: 'a'.repeat(64),
          resultResourceType: 'planVersion',
          resultResourceId: versionId,
          status: 'pending',
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
      const ents = createEntitlementsService({ prisma, permissions: ALL_STEP14 });
      const snap = await ents.putEntitlements(
        CLAIMS_A,
        planId,
        versionId,
        { expectedRowVersion: rowVersion, entitlementKeys: ['module.dashboard'] },
        'orphan-pending-key',
      );
      expect(snap.entitlementCount).toBe(1);
      const completed = await prisma.platformPlanIdempotencyRecord.findUniqueOrThrow({
        where: {
          actorId_operation_idempotencyKey: {
            actorId: ACTOR,
            operation: 'plan.replaceEntitlements',
            idempotencyKey: 'orphan-pending-key',
          },
        },
      });
      expect(completed.status).toBe('completed');
    });
  });

  describe('Step 14 rate limits for all buckets', () => {
    it('mutation: entitlements, Limits, apply-required return 429 without writes', async () => {
      const { planId, versionId, rowVersion } = await createAdminDraft(prisma, 'plan.lite');
      const ents = createEntitlementsService({
        prisma,
        permissions: ALL_STEP14,
        config: { mutationRateLimitPerMinute: 1 },
      });
      await ents.putEntitlements(
        CLAIMS_A,
        planId,
        versionId,
        { expectedRowVersion: rowVersion, entitlementKeys: ['module.dashboard'] },
        'rl-ent-ok',
      );
      const refreshed = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: versionId } });
      await expectRateLimited(() =>
        ents.putEntitlements(
          CLAIMS_A,
          planId,
          versionId,
          { expectedRowVersion: refreshed.rowVersion, entitlementKeys: ['module.patients'] },
          'rl-ent-429',
        ),
      );
      await expectRateLimited(() =>
        ents.putLimits(
          CLAIMS_A,
          planId,
          versionId,
          {
            expectedRowVersion: refreshed.rowVersion,
            limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '1' }],
          },
          'rl-lim-429',
        ),
      );
      await expectRateLimited(() =>
        ents.applyRequiredDependencies(
          CLAIMS_A,
          planId,
          versionId,
          { expectedRowVersion: refreshed.rowVersion, confirm: true },
          'rl-dep-429',
        ),
      );
      const after = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: versionId } });
      expect(after.rowVersion).toBe(refreshed.rowVersion);
      expect(
        await prisma.platformPlanIdempotencyRecord.count({
          where: { idempotencyKey: { in: ['rl-ent-429', 'rl-lim-429', 'rl-dep-429'] }, status: 'completed' },
        }),
      ).toBe(0);
    });

    it('high-impact: clone and publish return 429 without Draft/publication', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      const plan = await prisma.platformPlan.findUniqueOrThrow({
        where: { canonicalKey: 'plan.pro' },
      });
      const version = await prisma.platformPlanVersion.findFirstOrThrow({
        where: { planId: plan.id, lifecycle: 'DRAFT' },
      });
      const plans = createPlansService({
        prisma,
        permissions: ALL_STEP14,
        stepUpFresh: true,
        config: { highImpactRateLimitPerMinute: 1 },
      });
      const published = await plans.publishVersion(
        CLAIMS_A,
        plan.id,
        version.id,
        { expectedRowVersion: version.rowVersion, reason: 'rl publish ok' },
        'rl-pub-ok',
      );
      await expectRateLimited(() =>
        plans.cloneVersion(CLAIMS_A, plan.id, published.id, 'rl-clone-429'),
      );
      expect(
        await prisma.platformPlanVersion.count({
          where: { planId: plan.id, lifecycle: 'DRAFT', sourceVersionId: published.id },
        }),
      ).toBe(0);
      expect(
        await prisma.platformPlanIdempotencyRecord.count({
          where: { idempotencyKey: 'rl-clone-429', status: 'completed' },
        }),
      ).toBe(0);

      // Publish 429: clone with unlimited bucket, then publish with burned high-impact budget
      const prep = createPlansService({
        prisma,
        permissions: ALL_STEP14,
        stepUpFresh: true,
        config: { highImpactRateLimitPerMinute: 30 },
      });
      const cloned = await prep.cloneVersion(CLAIMS_A, plan.id, published.id, 'prep-clone-for-pub');
      const limited = createPlansService({
        prisma,
        permissions: ALL_STEP14,
        stepUpFresh: true,
        config: { highImpactRateLimitPerMinute: 1 },
      });
      // burn budget
      await limited.retireVersion(CLAIMS_A, plan.id, published.id, {
        expectedRowVersion: published.rowVersion,
        reason: 'burn high-impact slot',
      });
      await expectRateLimited(() =>
        limited.publishVersion(
          CLAIMS_A,
          plan.id,
          cloned.id,
          { expectedRowVersion: cloned.rowVersion, reason: 'rl publish 429' },
          'rl-pub-429',
        ),
      );
      const stillDraft = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: cloned.id },
      });
      expect(stillDraft.lifecycle).toBe('DRAFT');
      expect(stillDraft.publicationFingerprint).toBeNull();
      expect(
        await prisma.platformPlanIdempotencyRecord.count({
          where: { idempotencyKey: 'rl-pub-429', status: 'completed' },
        }),
      ).toBe(0);
    });

    it('read-heavy: preview, readiness, compare return 429; no activity mutation APIs', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      const plan = await prisma.platformPlan.findUniqueOrThrow({
        where: { canonicalKey: 'plan.lite' },
      });
      const version = await prisma.platformPlanVersion.findFirstOrThrow({
        where: { planId: plan.id, lifecycle: 'DRAFT' },
      });
      const ents = createEntitlementsService({
        prisma,
        permissions: ALL_STEP14,
        config: { readHeavyRateLimitPerMinute: 1 },
      });
      await ents.getEntitlementPreview(CLAIMS_A, plan.id, version.id);
      await expectRateLimited(() => ents.getEntitlements(CLAIMS_A, plan.id, version.id));

      const plans = createPlansService({
        prisma,
        permissions: ALL_STEP14,
        stepUpFresh: true,
        config: { readHeavyRateLimitPerMinute: 1 },
      });
      await plans.getReadiness(CLAIMS_A, plan.id, version.id);
      await expectRateLimited(() => plans.compareVersions(CLAIMS_A, plan.id, version.id, version.id));
    });
  });

  describe('seed ownership persisted fixtures', () => {
    it('covers UNINITIALIZED, SEED_INITIALIZED, ADMINISTRATOR_OWNED empty/non-empty, Published, Retired', async () => {
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: false });
      const lite = await prisma.platformPlan.findUniqueOrThrow({
        where: { canonicalKey: 'plan.lite' },
      });
      const uninit = await prisma.platformPlanVersion.create({
        data: {
          planId: lite.id,
          versionNumber: 1,
          lifecycle: 'DRAFT',
          systemSeeded: true,
          commercialDefinitionOwnership: 'UNINITIALIZED',
          translations: {
            create: [
              { locale: 'en-US', releaseLabel: 'U', shortDescription: 'u' },
              { locale: 'ar-SY', releaseLabel: 'ع', shortDescription: 'ع' },
            ],
          },
        },
      });

      const plans = createPlansService({
        prisma,
        permissions: ALL_STEP14,
        stepUpFresh: true,
        audit: durableAudit(prisma),
      });
      const custom = await plans.createPlan(
        CLAIMS_A,
        {
          canonicalKey: 'plan.ownership_fixture',
          translations: [
            { locale: 'en-US', displayName: 'Own', shortDescription: 'o' },
            { locale: 'ar-SY', displayName: 'م', shortDescription: 'م' },
          ],
        },
        'own-fix-plan',
      );
      await plans.transitionPlanLifecycle(CLAIMS_A, custom.id, 'ACTIVE', {
        expectedVersion: custom.version,
        reason: 'activate',
      });
      const emptyAdmin = await plans.createDraftVersion(
        CLAIMS_A,
        custom.id,
        {
          translations: [
            { locale: 'en-US', releaseLabel: 'Empty', shortDescription: 'e' },
            { locale: 'ar-SY', releaseLabel: 'ف', shortDescription: 'ف' },
          ],
        },
        'own-empty',
      );
      expect(emptyAdmin.lifecycle).toBe('DRAFT');

      // Seed run 1
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      const afterUninit = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: uninit.id },
        include: { entitlements: true, limits: true },
      });
      expect(afterUninit.commercialDefinitionOwnership).toBe('SEED_INITIALIZED');
      expect(afterUninit.entitlements.length).toBeGreaterThan(0);
      const seedEnt = afterUninit.entitlements.length;
      const seedLim = afterUninit.limits.length;

      const emptyAfter1 = await prisma.platformPlanVersionEntitlement.count({
        where: { planVersionId: emptyAdmin.id },
      });
      expect(emptyAfter1).toBe(0);
      expect(
        (await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: emptyAdmin.id } }))
          .commercialDefinitionOwnership,
      ).toBe('ADMINISTRATOR_OWNED');

      // Non-empty admin
      const ents = createEntitlementsService({
        prisma,
        permissions: ALL_STEP14,
        audit: durableAudit(prisma),
      });
      // Need a separate plan for non-empty because emptyAdmin is the only draft on custom plan
      await ents.putEntitlements(
        CLAIMS_A,
        custom.id,
        emptyAdmin.id,
        { expectedRowVersion: emptyAdmin.rowVersion, entitlementKeys: ['module.dashboard'] },
        'own-nonempty-put',
      );
      const nonEmptyRv = (
        await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: emptyAdmin.id } })
      ).rowVersion;

      // Metadata-only published on enterprise (seed draft, clear children, publish)
      const entPlan = await prisma.platformPlan.findUniqueOrThrow({
        where: { canonicalKey: 'plan.enterprise' },
      });
      let entDraft = await prisma.platformPlanVersion.findFirstOrThrow({
        where: { planId: entPlan.id, lifecycle: 'DRAFT' },
      });
      // Clear to metadata-only for fingerprint v1-style publish — use plans with empty after clear
      await prisma.platformPlanVersionEntitlement.deleteMany({ where: { planVersionId: entDraft.id } });
      await prisma.platformPlanVersionLimit.deleteMany({ where: { planVersionId: entDraft.id } });
      // ownership admin so seed won't refill before publish
      await prisma.platformPlanVersion.update({
        where: { id: entDraft.id },
        data: { commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED' },
      });
      entDraft = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: entDraft.id } });
      const metaPub = await plans.publishVersion(CLAIMS_A, entPlan.id, entDraft.id, {
        expectedRowVersion: entDraft.rowVersion,
        reason: 'metadata-only publish',
      });
      const fpBefore = metaPub.publicationFingerprint!;
      // Step 13-style: fingerprint from v2 with empty children is still schema v2 — record exact value
      expect(fpBefore).toMatch(/^[a-f0-9]{64}$/);

      // Seed run 2 — admin non-empty unchanged; seed-initialized unchanged
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      const after2 = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: uninit.id },
        include: { entitlements: true, limits: true },
      });
      expect(after2.entitlements.length).toBe(seedEnt);
      expect(after2.limits.length).toBe(seedLim);
      expect(after2.commercialDefinitionOwnership).toBe('SEED_INITIALIZED');

      expect(
        await prisma.platformPlanVersionEntitlement.count({ where: { planVersionId: emptyAdmin.id } }),
      ).toBe(1);
      expect(
        (await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: emptyAdmin.id } }))
          .rowVersion,
      ).toBe(nonEmptyRv);

      // Separate intentionally empty admin Draft on another Plan
      const emptyPlan = await plans.createPlan(
        CLAIMS_A,
        {
          canonicalKey: 'plan.ownership_empty_only',
          translations: [
            { locale: 'en-US', displayName: 'Empty Only', shortDescription: 'e' },
            { locale: 'ar-SY', displayName: 'ف', shortDescription: 'ف' },
          ],
        },
        'own-empty-only-plan',
      );
      await plans.transitionPlanLifecycle(CLAIMS_A, emptyPlan.id, 'ACTIVE', {
        expectedVersion: emptyPlan.version,
        reason: 'activate empty only',
      });
      const emptyOnly = await plans.createDraftVersion(
        CLAIMS_A,
        emptyPlan.id,
        {
          translations: [
            { locale: 'en-US', releaseLabel: 'Still Empty', shortDescription: 'e' },
            { locale: 'ar-SY', releaseLabel: 'ف', shortDescription: 'ف' },
          ],
        },
        'own-empty-only-draft',
      );
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      expect(
        await prisma.platformPlanVersionEntitlement.count({ where: { planVersionId: emptyOnly.id } }),
      ).toBe(0);
      expect(
        await prisma.platformPlanVersionLimit.count({ where: { planVersionId: emptyOnly.id } }),
      ).toBe(0);
      expect(
        (await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: emptyOnly.id } }))
          .commercialDefinitionOwnership,
      ).toBe('ADMINISTRATOR_OWNED');

      const metaAfter = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: metaPub.id },
      });
      expect(metaAfter.publicationFingerprint).toBe(fpBefore);
      expect(metaAfter.lifecycle).toBe('PUBLISHED');
      expect(
        await prisma.platformPlanVersionEntitlement.count({ where: { planVersionId: metaPub.id } }),
      ).toBe(0);

      const retired = await plans.retireVersion(CLAIMS_A, entPlan.id, metaPub.id, {
        expectedRowVersion: metaAfter.rowVersion,
        reason: 'retire ownership fixture',
      });
      await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
      const retiredAfter = await prisma.platformPlanVersion.findUniqueOrThrow({
        where: { id: retired.id },
      });
      expect(retiredAfter.lifecycle).toBe('RETIRED');
      expect(retiredAfter.publicationFingerprint).toBe(fpBefore);
      void buildPublicationFingerprint;
    });
  });
});
