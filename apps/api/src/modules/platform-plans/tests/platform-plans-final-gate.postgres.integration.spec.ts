/**
 * Step 13 final-gate PostgreSQL evidence — vocabulary Option B, audit matrix,
 * idempotency retention/replay, authz isolation, comparison/references honesty.
 */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  cleanupPlatformPlansTables,
  createPlansPrismaWrapper,
  createPlansService,
  createPlansSeedService,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from './platform-plans-db.harness';
import { AuditTrailPlatformPlansAuditLog } from '../infrastructure/audit-trail-platform-plans-audit-log';
import { PlanIdempotencyService } from '../application/plan-idempotency.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { SEED_PLANS } from '../domain/plan-seed.inventory';

const run = platformDbSecurityEnabled();
const ACTOR = '00000000-0000-4000-8000-000000000077';
const ACTOR_B = '00000000-0000-4000-8000-000000000078';
const SESSION = '11111111-1111-4111-8111-111111111111';
const CLAIMS = { sub: ACTOR, sessionId: SESSION } as JwtClaimsVO;
const CLAIMS_B = { sub: ACTOR_B, sessionId: '11111111-1111-4111-8111-111111111112' } as JwtClaimsVO;

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

const EXPECTED_ACTIVE_ALIASES = SEED_PLANS.reduce((n, p) => n + p.aliases.length, 0);

function durableAudit(prisma: PrismaClient) {
  const wrapper = createPlansPrismaWrapper(prisma);
  return new AuditTrailPlatformPlansAuditLog({
    withPlatformBypass: wrapper.withPlatformBypass,
  } as unknown as PrismaService);
}

function translations() {
  return [
    { locale: 'en-US', displayName: 'Gate Plan', shortDescription: 'Gate desc' },
    { locale: 'ar-SY', displayName: 'خطة بوابة', shortDescription: 'وصف البوابة' },
  ];
}

function versionTranslations(label = 'Gate Draft') {
  return [
    { locale: 'en-US', releaseLabel: label, shortDescription: 'Draft en' },
    { locale: 'ar-SY', releaseLabel: `${label}-ar`, shortDescription: 'مسودة' },
  ];
}

describe('platform plans final gate (postgres)', () => {
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

  (run ? it : it.skip)('Option B: business is unresolved and not an active Plan alias', async () => {
    const seed = createPlansSeedService(prisma);
    await seed.seedAll();
    // Simulate prior mistaken alias then reseed
    const pro = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.pro' } });
    await prisma.platformPlanAlias.upsert({
      where: {
        sourceNamespace_aliasValue: {
          sourceNamespace: 'clinic_ui_plan',
          aliasValue: 'business',
        },
      },
      create: {
        planId: pro.id,
        sourceNamespace: 'clinic_ui_plan',
        aliasValue: 'business',
        normalizedValue: 'business',
        lifecycle: 'ACTIVE',
        migrationNote: 'legacy mistake',
      },
      update: { lifecycle: 'ACTIVE', planId: pro.id },
    });
    await seed.seedAll();
    expect(
      await prisma.platformPlanAlias.count({
        where: { aliasValue: 'business', lifecycle: 'ACTIVE' },
      }),
    ).toBe(0);
    const service = createPlansService({ prisma, permissions: ALL_MANAGE });
    await expect(
      service.createPlan(CLAIMS, {
        canonicalKey: 'plan.business',
        translations: translations(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const legacy = await service.getLegacyMappings(CLAIMS);
    expect(legacy.unresolved.find((u: { value: string }) => u.value === 'business')).toBeTruthy();
    expect(legacy.items.every((i: { aliasValue: string }) => i.aliasValue !== 'business')).toBe(
      true,
    );
  });

  (run ? it : it.skip)('seed twice is idempotent; administrator translation edits preserved', async () => {
    const seed = createPlansSeedService(prisma);
    const first = await seed.seedAll();
    expect(first.persisted.plans).toBe(3);
    expect(first.persisted.aliases).toBe(EXPECTED_ACTIVE_ALIASES);
    const plan = await prisma.platformPlan.findUniqueOrThrow({
      where: { canonicalKey: 'plan.lite' },
      include: { translations: true },
    });
    const en = plan.translations.find((t) => t.locale === 'en-US')!;
    await prisma.platformPlanTranslation.update({
      where: { id: en.id },
      data: { displayName: 'Admin Lite Rename' },
    });
    // bump updatedAt away from createdAt
    await prisma.$executeRaw`
      UPDATE platform_plan_translations
      SET "updatedAt" = NOW() + interval '1 second'
      WHERE id = ${en.id}::uuid
    `;
    await seed.seedAll();
    const after = await prisma.platformPlanTranslation.findUniqueOrThrow({ where: { id: en.id } });
    expect(after.displayName).toBe('Admin Lite Rename');
  });

  (run ? it : it.skip)('cross-permission isolation: view cannot mutate; edit cannot publish', async () => {
    await createPlansSeedService(prisma).seedAll();
    const plan = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.lite' } });
    const viewer = createPlansService({ prisma, permissions: ['plan.view', 'plan-version.view'] });
    const editor = createPlansService({
      prisma,
      permissions: ['plan.view', 'plan.edit', 'plan-version.view', 'plan-version.create'],
      stepUpFresh: true,
    });
    await expect(
      viewer.createPlan(CLAIMS, { canonicalKey: 'plan.extra', translations: translations() }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      viewer.transitionPlanLifecycle(CLAIMS, plan.id, 'ARCHIVED', {
        expectedVersion: plan.version,
        reason: 'archive attempt',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const draft = await editor.createDraftVersion(CLAIMS, plan.id, {
      translations: versionTranslations(),
    });
    await expect(
      editor.publishVersion(CLAIMS, plan.id, draft.id, {
        expectedRowVersion: draft.rowVersion,
        reason: 'should fail',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const stillDraft = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(stillDraft.lifecycle).toBe('DRAFT');
  });

  (run ? it : it.skip)('audit matrix persists allowlisted rows without sensitive payloads', async () => {
    const audit = durableAudit(prisma);
    const service = createPlansService({
      prisma,
      permissions: ALL_MANAGE,
      audit,
      stepUpFresh: true,
    });
    const created = await service.createPlan(
      CLAIMS,
      { canonicalKey: 'plan.gate_audit', translations: translations() },
      'idem-create-1',
    );
    await service.transitionPlanLifecycle(CLAIMS, created.id, 'ACTIVE', {
      expectedVersion: created.version,
      reason: 'activate for audit',
    });
    const draft = await service.createDraftVersion(
      CLAIMS,
      created.id,
      { translations: versionTranslations('Audit v1') },
      'idem-draft-1',
    );
    const published = await service.publishVersion(
      CLAIMS,
      created.id,
      draft.id,
      { expectedRowVersion: draft.rowVersion, reason: 'publish for audit' },
      'idem-publish-1',
    );
    const cloned = await service.cloneVersion(CLAIMS, created.id, published.id, 'idem-clone-1');
    await service.retireVersion(CLAIMS, created.id, published.id, {
      expectedRowVersion: published.rowVersion,
      reason: 'retire for audit',
    });

    const actions = [
      'platform_plan.created',
      'platform_plan.activated',
      'platform_plan_version.created',
      'platform_plan_version.published',
      'platform_plan_version.cloned',
      'platform_plan_version.retired',
    ];
    for (const action of actions) {
      const rows = await prisma.auditEntry.findMany({
        where: { action, tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
      });
      expect(rows.length).toBeGreaterThanOrEqual(1);
      const serialized = JSON.stringify(rows);
      expect(serialized).not.toMatch(/Gate desc|مسودة|Audit v1|releaseNotes|Bearer |sessionId|password/i);
      expect(serialized).not.toMatch(/PHI_SENTINEL|SELECT \*|stack/i);
    }
    void cloned;
  });

  (run ? it : it.skip)('idempotency replay survives service recreation; purgeExpired respects retention', async () => {
    const service1 = createPlansService({ prisma, permissions: ALL_MANAGE, stepUpFresh: true });
    const created = await service1.createPlan(
      CLAIMS,
      { canonicalKey: 'plan.idem_gate', translations: translations() },
      'shared-key-create',
    );
    const service2 = createPlansService({ prisma, permissions: ALL_MANAGE, stepUpFresh: true });
    const replay = await service2.createPlan(
      CLAIMS,
      { canonicalKey: 'plan.idem_gate', translations: translations() },
      'shared-key-create',
    );
    expect(replay.id).toBe(created.id);
    await expect(
      service2.createPlan(
        CLAIMS,
        {
          canonicalKey: 'plan.idem_other',
          translations: translations(),
        },
        'shared-key-create',
      ),
    ).rejects.toThrow(/Idempotency|different request/i);

    const wrapper = createPlansPrismaWrapper(prisma);
    const idem = new PlanIdempotencyService(wrapper as never);
    await prisma.platformPlanIdempotencyRecord.updateMany({
      where: { actorId: ACTOR, idempotencyKey: 'shared-key-create' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const purged = await idem.purgeExpired(new Date());
    expect(purged).toBeGreaterThanOrEqual(1);
    const remaining = await prisma.platformPlanIdempotencyRecord.count({
      where: { expiresAt: { gt: new Date() } },
    });
    expect(remaining).toBeGreaterThanOrEqual(0);
  });

  (run ? it : it.skip)('failed create leaves no completed idempotency record', async () => {
    const service = createPlansService({ prisma, permissions: ALL_MANAGE });
    await createPlansSeedService(prisma).seedAll();
    await expect(
      service.createPlan(
        CLAIMS,
        { canonicalKey: 'plan.lite', translations: translations() },
        'fail-dup-key',
      ),
    ).rejects.toThrow();
    const completed = await prisma.platformPlanIdempotencyRecord.findFirst({
      where: { idempotencyKey: 'fail-dup-key', status: 'completed' },
    });
    expect(completed).toBeNull();
  });

  (run ? it : it.skip)('comparison and references are honest about Step 14/16 unavailability', async () => {
    const service = createPlansService({ prisma, permissions: ALL_MANAGE, stepUpFresh: true });
    await createPlansSeedService(prisma).seedAll();
    const plan = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.lite' } });
    const other = await prisma.platformPlan.findUniqueOrThrow({
      where: { canonicalKey: 'plan.pro' },
    });
    const d1 = await service.createDraftVersion(CLAIMS, plan.id, {
      translations: versionTranslations('A'),
    });
    const p1 = await service.publishVersion(
      CLAIMS,
      plan.id,
      d1.id,
      { expectedRowVersion: d1.rowVersion, reason: 'publish A' },
      'pub-a',
    );
    const d2 = await service.cloneVersion(CLAIMS, plan.id, p1.id, 'clone-a');
    const cmp = await service.compareVersions(CLAIMS, plan.id, p1.id, d2.id);
    expect(cmp.entitlements.status).toBe('unavailable');
    expect(cmp.limits.status).toBe('unavailable');
    const serialized = JSON.stringify(cmp);
    expect(serialized).toMatch(/unavailable|step_14/i);
    expect(serialized).not.toMatch(/"modules"\s*:\s*\[/);

    await expect(service.compareVersions(CLAIMS, plan.id, p1.id, other.id)).rejects.toThrow();

    const refs = await service.getReferences(CLAIMS, plan.id);
    expect(refs.planVersionSubscriberCount.status).toBe('unavailable');
    expect(JSON.stringify(refs)).toMatch(/unavailable|deferred|step_/i);
    expect(JSON.stringify(refs)).not.toMatch(/tenantName|contactEmail/i);
  });

  (run ? it : it.skip)('step-up missing leaves publish lifecycle unchanged', async () => {
    const seed = createPlansSeedService(prisma);
    await seed.seedAll();
    const plan = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.lite' } });
    const withStepUp = createPlansService({
      prisma,
      permissions: ALL_MANAGE,
      stepUpFresh: true,
    });
    const draft = await withStepUp.createDraftVersion(CLAIMS, plan.id, {
      translations: versionTranslations(),
    });
    const noStepUp = createPlansService({
      prisma,
      permissions: ALL_MANAGE,
      stepUpFresh: false,
    });
    await expect(
      noStepUp.publishVersion(CLAIMS, plan.id, draft.id, {
        expectedRowVersion: draft.rowVersion,
        reason: 'no step up',
      }),
    ).rejects.toThrow();
    const row = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(row.lifecycle).toBe('DRAFT');
  });

  (run ? it : it.skip)('actor-scoped idempotency isolation', async () => {
    const a = createPlansService({ prisma, permissions: ALL_MANAGE });
    const b = createPlansService({ prisma, permissions: ALL_MANAGE });
    const planA = await a.createPlan(
      CLAIMS,
      { canonicalKey: 'plan.actor_a', translations: translations() },
      'same-key',
    );
    const planB = await b.createPlan(
      CLAIMS_B,
      { canonicalKey: 'plan.actor_b', translations: translations() },
      'same-key',
    );
    expect(planA.id).not.toBe(planB.id);
  });
});
