/**
 * Step 13 Platform Plans PostgreSQL integration tests.
 */
import { PrismaClient } from '@prisma/client';
import {
  cleanupPlatformPlansTables,
  createPlansPrismaWrapper,
  createPlansService,
  createPlatformDbSecurityClient,
  createPlansSeedService,
  platformDbSecurityEnabled,
} from './platform-plans-db.harness';
import { AuditTrailPlatformPlansAuditLog } from '../infrastructure/audit-trail-platform-plans-audit-log';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { PrismaService } from '../../../infrastructure/prisma.service';

const run = platformDbSecurityEnabled();
const ACTOR = '00000000-0000-4000-8000-000000000077';
const CLAIMS = { sub: ACTOR, sessionId: '11111111-1111-4111-8111-111111111111' } as JwtClaimsVO;
const ALL_MANAGE = [
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

describe('platform plans (postgres)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    if (!run) return;
    prisma = createPlatformDbSecurityClient();
  });

  afterAll(async () => {
    if (!run || !prisma) return;
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    if (!run) return;
    await cleanupPlatformPlansTables(prisma);
  });

  (run ? it : it.skip)('seeds three canonical plans with proven aliases only', async () => {
    const seed = createPlansSeedService(prisma);
    const first = await seed.seedAll();
    const second = await seed.seedAll();
    expect(first.plans).toBe(3);
    expect(second.persisted).toEqual(first.persisted);
    expect(await prisma.platformPlan.count()).toBe(3);
    expect(await prisma.platformPlan.findUnique({ where: { canonicalKey: 'plan.business' } })).toBeNull();
    const business = await prisma.platformPlanAlias.findFirst({
      where: { sourceNamespace: 'clinic_ui_plan', aliasValue: 'business', lifecycle: 'ACTIVE' },
    });
    expect(business).toBeNull();
    const mappings = await createPlansService({
      prisma,
      permissions: ALL_MANAGE,
    }).getLegacyMappings(CLAIMS);
    expect(mappings.unresolved.some((u: { value: string }) => u.value === 'business')).toBe(true);
    expect(mappings.items.every((i: { aliasValue: string }) => i.aliasValue !== 'business')).toBe(
      true,
    );
  });

  (run ? it : it.skip)('publishes with step-up; published versions are immutable', async () => {
    const service = createPlansService({ prisma, permissions: ALL_MANAGE, stepUpFresh: true });
    await createPlansSeedService(prisma).seedAll();
    const plan = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.lite' } });
    const draft = await service.createDraftVersion(CLAIMS, plan.id, {
      translations: [
        { locale: 'en-US', releaseLabel: 'Lite v1', shortDescription: 'First draft' },
        { locale: 'ar-SY', releaseLabel: 'لايت ١', shortDescription: 'مسودة أولى' },
      ],
    });
    const published = await service.publishVersion(CLAIMS, plan.id, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'publish for immutability evidence',
    });
    expect(published.lifecycle).toBe('PUBLISHED');
    expect(published.immutable).toBe(true);
    expect(published.subscriptionEligibility).toBe(false);
    expect(published.runtimeEffective).toBe(false);
    expect(published.entitlementReadiness.status).toBe('unavailable');

    await expect(
      service.updateDraftVersion(CLAIMS, plan.id, draft.id, {
        expectedRowVersion: published.rowVersion,
        translations: [
          { locale: 'en-US', releaseLabel: 'Hacked', shortDescription: 'no' },
          { locale: 'ar-SY', releaseLabel: 'مخترق', shortDescription: 'لا' },
        ],
      }),
    ).rejects.toThrow(/immutable/i);
  });

  (run ? it : it.skip)('rejects publish without fresh step-up', async () => {
    const fresh = createPlansService({ prisma, permissions: ALL_MANAGE, stepUpFresh: true });
    const stale = createPlansService({ prisma, permissions: ALL_MANAGE, stepUpFresh: false });
    await createPlansSeedService(prisma).seedAll();
    const plan = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.pro' } });
    const draft = await fresh.createDraftVersion(CLAIMS, plan.id, {
      translations: [
        { locale: 'en-US', releaseLabel: 'Pro v1', shortDescription: 'draft' },
        { locale: 'ar-SY', releaseLabel: 'برو ١', shortDescription: 'مسودة' },
      ],
    });
    await expect(
      stale.publishVersion(CLAIMS, plan.id, draft.id, {
        expectedRowVersion: draft.rowVersion,
        reason: 'no step-up',
      }),
    ).rejects.toThrow(/Step-up verification is required/i);
    const after = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(after.lifecycle).toBe('DRAFT');
  });

  (run ? it : it.skip)('clones published version to a new Draft and enforces one-draft policy', async () => {
    const service = createPlansService({ prisma, permissions: ALL_MANAGE, stepUpFresh: true });
    await createPlansSeedService(prisma).seedAll();
    const plan = await prisma.platformPlan.findUniqueOrThrow({
      where: { canonicalKey: 'plan.enterprise' },
    });
    const draft = await service.createDraftVersion(CLAIMS, plan.id, {
      translations: [
        { locale: 'en-US', releaseLabel: 'Ent v1', shortDescription: 'draft' },
        { locale: 'ar-SY', releaseLabel: 'مؤسسات ١', shortDescription: 'مسودة' },
      ],
    });
    const published = await service.publishVersion(CLAIMS, plan.id, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'publish before clone',
    });
    const clone = await service.cloneVersion(CLAIMS, plan.id, published.id, 'clone-1');
    expect(clone.lifecycle).toBe('DRAFT');
    expect(clone.versionNumber).toBe(published.versionNumber + 1);
    expect(clone.sourceVersionId).toBe(published.id);
    expect(clone.publishedAt).toBeNull();
    await expect(
      service.createDraftVersion(CLAIMS, plan.id, {
        translations: [
          { locale: 'en-US', releaseLabel: 'second', shortDescription: 'no' },
          { locale: 'ar-SY', releaseLabel: 'ثاني', shortDescription: 'لا' },
        ],
      }),
    ).rejects.toThrow(/Open Draft already exists/i);
  });

  (run ? it : it.skip)('persists durable audit without translation sentinels', async () => {
    const wrapper = createPlansPrismaWrapper(prisma);
    const audit = new AuditTrailPlatformPlansAuditLog({
      withPlatformBypass: wrapper.withPlatformBypass,
    } as unknown as PrismaService);
    const service = createPlansService({
      prisma,
      permissions: ALL_MANAGE,
      audit,
      stepUpFresh: true,
    });
    const SENTINEL = 'REDACT_PLAN_TRANSLATION_SENTINEL';
    const created = await service.createPlan(CLAIMS, {
      canonicalKey: 'plan.audit_probe',
      translations: [
        { locale: 'en-US', displayName: SENTINEL, shortDescription: 'desc' },
        { locale: 'ar-SY', displayName: 'تدقيق', shortDescription: 'وصف' },
      ],
    });
    const rows = await prisma.auditEntry.findMany({
      where: {
        tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
        resourceId: created.id,
        action: 'platform_plan.created',
      },
    });
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(SENTINEL);
  });

  (run ? it : it.skip)('concurrent publish has one winner', async () => {
    const service = createPlansService({ prisma, permissions: ALL_MANAGE, stepUpFresh: true });
    await createPlansSeedService(prisma).seedAll();
    const plan = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.lite' } });
    const draft = await service.createDraftVersion(CLAIMS, plan.id, {
      translations: [
        { locale: 'en-US', releaseLabel: 'Race', shortDescription: 'draft' },
        { locale: 'ar-SY', releaseLabel: 'سباق', shortDescription: 'مسودة' },
      ],
    });
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        service.publishVersion(CLAIMS, plan.id, draft.id, {
          expectedRowVersion: draft.rowVersion,
          reason: 'concurrent publish',
        }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(3);
  });
});
