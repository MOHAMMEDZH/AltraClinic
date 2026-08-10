/**
 * Step 13 evidence — audit matrix, per-op idempotency, retention,
 * rate limits, and cross-session/user step-up isolation.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
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

const run = platformDbSecurityEnabled();
const ACTOR = '00000000-0000-4000-8000-000000000081';
const ACTOR_B = '00000000-0000-4000-8000-000000000082';
const SESSION_A = '11111111-1111-4111-8111-111111111101';
const SESSION_B = '11111111-1111-4111-8111-111111111102';
const SESSION_B_USER_B = '11111111-1111-4111-8111-111111111103';
const CLAIMS_A = { sub: ACTOR, sessionId: SESSION_A } as JwtClaimsVO;
const CLAIMS_B_SAME_USER = { sub: ACTOR, sessionId: SESSION_B } as JwtClaimsVO;
const CLAIMS_B_OTHER_USER = { sub: ACTOR_B, sessionId: SESSION_B_USER_B } as JwtClaimsVO;

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

async function expectRateLimited(run: () => Promise<unknown>): Promise<void> {
  let caught: unknown;
  try {
    await run();
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(HttpException);
  expect((caught as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
}

const SENSITIVE_PATTERN = /Gate desc|مسودة|releaseNotes|Bearer |sessionId|password|PHI_SENTINEL|SELECT \*|stack/i;

function durableAudit(prisma: PrismaClient) {
  const wrapper = createPlansPrismaWrapper(prisma);
  return new AuditTrailPlatformPlansAuditLog({
    withPlatformBypass: wrapper.withPlatformBypass,
  } as unknown as PrismaService);
}

function planTranslations() {
  return [
    { locale: 'en-US', displayName: 'Evidence Plan', shortDescription: 'Gate desc' },
    { locale: 'ar-SY', displayName: 'خطة دليل', shortDescription: 'وصف دليل' },
  ];
}

function versionTranslations(label = 'Evidence Draft') {
  return [
    { locale: 'en-US', releaseLabel: label, shortDescription: 'Draft en' },
    { locale: 'ar-SY', releaseLabel: `${label}-ar`, shortDescription: 'مسودة' },
  ];
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

describe('platform plans evidence (postgres)', () => {
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

  (run ? it : it.skip)(
    'complete audit matrix: one durable row per lifecycle action without sensitive payloads',
    async () => {
      const audit = durableAudit(prisma);
      const service = createPlansService({
        prisma,
        permissions: ALL_MANAGE,
        audit,
        stepUpFresh: true,
      });

      const created = await service.createPlan(
        CLAIMS_A,
        { canonicalKey: 'plan.evidence_matrix', translations: planTranslations() },
        'evidence-audit-create',
      );
      expect(await auditCount(prisma, 'platform_plan.created', created.id)).toBe(1);

      const updated = await service.updatePlan(CLAIMS_A, created.id, {
        expectedVersion: created.version,
        translations: planTranslations(),
      });
      expect(await auditCount(prisma, 'platform_plan.updated', created.id)).toBe(1);

      const activated = await service.transitionPlanLifecycle(CLAIMS_A, created.id, 'ACTIVE', {
        expectedVersion: updated.version,
        reason: 'activate for evidence',
      });
      expect(await auditCount(prisma, 'platform_plan.activated', created.id)).toBe(1);

      const archived = await service.transitionPlanLifecycle(CLAIMS_A, created.id, 'ARCHIVED', {
        expectedVersion: activated.version,
        reason: 'archive for evidence',
      });
      expect(await auditCount(prisma, 'platform_plan.archived', created.id)).toBe(1);

      const reactivated = await service.transitionPlanLifecycle(CLAIMS_A, created.id, 'ACTIVE', {
        expectedVersion: archived.version,
        reason: 'reactivate for evidence',
      });
      expect(await auditCount(prisma, 'platform_plan.reactivated', created.id)).toBe(1);

      await service.addAlias(CLAIMS_A, created.id, {
        aliasValue: 'evidence_alias',
        sourceNamespace: 'api_plan_code',
        expectedVersion: reactivated.version,
        idempotencyKey: 'evidence-audit-alias',
      });
      expect(await auditCount(prisma, 'platform_plan.alias.added', created.id)).toBe(1);

      const afterAlias = await service.getPlan(CLAIMS_A, created.id);
      const aliasId = afterAlias.aliases.find((a) => a.aliasValue === 'evidence_alias')!.id;
      await service.retireAlias(CLAIMS_A, created.id, aliasId, {
        expectedVersion: afterAlias.version,
        reason: 'retire alias for evidence',
      });
      expect(await auditCount(prisma, 'platform_plan.alias.retired', created.id)).toBe(1);

      const draft = await service.createDraftVersion(
        CLAIMS_A,
        created.id,
        { translations: versionTranslations('Matrix v1') },
        'evidence-audit-draft',
      );
      expect(await auditCount(prisma, 'platform_plan_version.created', draft.id)).toBe(1);

      const draftUpdated = await service.updateDraftVersion(CLAIMS_A, created.id, draft.id, {
        expectedRowVersion: draft.rowVersion,
        translations: versionTranslations('Matrix v1 edited'),
      });
      expect(await auditCount(prisma, 'platform_plan_version.updated', draft.id)).toBe(1);

      const published = await service.publishVersion(
        CLAIMS_A,
        created.id,
        draft.id,
        { expectedRowVersion: draftUpdated.rowVersion, reason: 'publish for evidence' },
        'evidence-audit-publish',
      );
      expect(await auditCount(prisma, 'platform_plan_version.published', draft.id)).toBe(1);

      const cloned = await service.cloneVersion(
        CLAIMS_A,
        created.id,
        published.id,
        'evidence-audit-clone',
      );
      expect(await auditCount(prisma, 'platform_plan_version.cloned', cloned.id)).toBe(1);

      await service.retireVersion(CLAIMS_A, created.id, published.id, {
        expectedRowVersion: published.rowVersion,
        reason: 'retire published source',
      });
      expect(await auditCount(prisma, 'platform_plan_version.retired', published.id)).toBe(1);

      const expectedActions = [
        'platform_plan.created',
        'platform_plan.updated',
        'platform_plan.activated',
        'platform_plan.archived',
        'platform_plan.reactivated',
        'platform_plan.alias.added',
        'platform_plan.alias.retired',
        'platform_plan_version.created',
        'platform_plan_version.updated',
        'platform_plan_version.published',
        'platform_plan_version.cloned',
        'platform_plan_version.retired',
      ];
      for (const action of expectedActions) {
        const rows = await prisma.auditEntry.findMany({
          where: { action, tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
        });
        expect(rows.length).toBeGreaterThanOrEqual(1);
        assertNoSensitivePayload(JSON.stringify(rows));
      }
      void afterAlias;
    },
  );

  (run ? describe : describe.skip)('plan create idempotency', () => {
    (run ? it : it.skip)('replay, conflict, service recreation, actor isolation, failed dup, bad keys', async () => {
      const service1 = createPlansService({ prisma, permissions: ALL_MANAGE });
      const created = await service1.createPlan(
        CLAIMS_A,
        { canonicalKey: 'plan.idem_evidence', translations: planTranslations() },
        'plan-create-key',
      );
      const service2 = createPlansService({ prisma, permissions: ALL_MANAGE });
      const replay = await service2.createPlan(
        CLAIMS_A,
        { canonicalKey: 'plan.idem_evidence', translations: planTranslations() },
        'plan-create-key',
      );
      expect(replay.id).toBe(created.id);

      await expect(
        service2.createPlan(
          CLAIMS_A,
          { canonicalKey: 'plan.idem_other', translations: planTranslations() },
          'plan-create-key',
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      const actorBPlan = await service2.createPlan(
        CLAIMS_B_OTHER_USER,
        { canonicalKey: 'plan.idem_actor_b', translations: planTranslations() },
        'plan-create-key',
      );
      expect(actorBPlan.id).not.toBe(created.id);

      await createPlansSeedService(prisma).seedAll();
      await expect(
        service2.createPlan(
          CLAIMS_A,
          { canonicalKey: 'plan.lite', translations: planTranslations() },
          'fail-dup-plan-key',
        ),
      ).rejects.toThrow();
      expect(
        await prisma.platformPlanIdempotencyRecord.findFirst({
          where: { idempotencyKey: 'fail-dup-plan-key', status: 'completed' },
        }),
      ).toBeNull();

      await expect(
        service2.createPlan(
          CLAIMS_A,
          { canonicalKey: 'plan.bad_key', translations: planTranslations() },
          '!!!invalid!!!',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service2.createPlan(
          CLAIMS_A,
          { canonicalKey: 'plan.oversized_key', translations: planTranslations() },
          'k'.repeat(129),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  (run ? describe : describe.skip)('draft create idempotency', () => {
    (run ? it : it.skip)('replay, conflict, service recreation, concurrent single draft', async () => {
      await createPlansSeedService(prisma).seedAll();
      const plan = await prisma.platformPlan.findUniqueOrThrow({
        where: { canonicalKey: 'plan.lite' },
      });
      const service1 = createPlansService({ prisma, permissions: ALL_MANAGE });
      const draft = await service1.createDraftVersion(
        CLAIMS_A,
        plan.id,
        { translations: versionTranslations('Draft A') },
        'draft-create-key',
      );
      const service2 = createPlansService({ prisma, permissions: ALL_MANAGE });
      const replay = await service2.createDraftVersion(
        CLAIMS_A,
        plan.id,
        { translations: versionTranslations('Draft A') },
        'draft-create-key',
      );
      expect(replay.id).toBe(draft.id);

      await expect(
        service2.createDraftVersion(
          CLAIMS_A,
          plan.id,
          { translations: versionTranslations('Draft B') },
          'draft-create-key',
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      const pro = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.pro' } });
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          service2.createDraftVersion(
            CLAIMS_A,
            pro.id,
            { translations: versionTranslations('Concurrent') },
            'draft-concurrent-key',
          ),
        ),
      );
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      const draftIds = new Set(
        fulfilled.map((r) => (r as PromiseFulfilledResult<{ id: string }>).value.id),
      );
      expect(draftIds.size).toBe(1);
    });
  });

  (run ? describe : describe.skip)('clone idempotency', () => {
    (run ? it : it.skip)('replay, conflict, service recreation', async () => {
      const service1 = createPlansService({ prisma, permissions: ALL_MANAGE, stepUpFresh: true });
      await createPlansSeedService(prisma).seedAll();
      const plan = await prisma.platformPlan.findUniqueOrThrow({
        where: { canonicalKey: 'plan.lite' },
      });
      const draft = await service1.createDraftVersion(CLAIMS_A, plan.id, {
        translations: versionTranslations('Clone source'),
      });
      const published = await service1.publishVersion(
        CLAIMS_A,
        plan.id,
        draft.id,
        { expectedRowVersion: draft.rowVersion, reason: 'publish for clone idem' },
      );
      const cloned = await service1.cloneVersion(
        CLAIMS_A,
        plan.id,
        published.id,
        'clone-key',
      );
      const service2 = createPlansService({ prisma, permissions: ALL_MANAGE, stepUpFresh: true });
      const replay = await service2.cloneVersion(CLAIMS_A, plan.id, published.id, 'clone-key');
      expect(replay.id).toBe(cloned.id);

      const ent = await prisma.platformPlan.findUniqueOrThrow({
        where: { canonicalKey: 'plan.enterprise' },
      });
      const entDraft = await service2.createDraftVersion(CLAIMS_A, ent.id, {
        translations: versionTranslations('Other publish'),
      });
      const entPublished = await service2.publishVersion(
        CLAIMS_A,
        ent.id,
        entDraft.id,
        { expectedRowVersion: entDraft.rowVersion, reason: 'second published source' },
      );
      await expect(
        service2.cloneVersion(CLAIMS_A, ent.id, entPublished.id, 'clone-key'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  (run ? describe : describe.skip)('publish idempotency', () => {
    (run ? it : it.skip)(
      'replay, conflict, recreation; no completed record without step-up or stale version',
      async () => {
        const service1 = createPlansService({ prisma, permissions: ALL_MANAGE, stepUpFresh: true });
        await createPlansSeedService(prisma).seedAll();
        const plan = await prisma.platformPlan.findUniqueOrThrow({
          where: { canonicalKey: 'plan.pro' },
        });
        const draft = await service1.createDraftVersion(
          CLAIMS_A,
          plan.id,
          { translations: versionTranslations('Publish idem') },
          'publish-draft-setup',
        );
        const published = await service1.publishVersion(
          CLAIMS_A,
          plan.id,
          draft.id,
          { expectedRowVersion: draft.rowVersion, reason: 'publish idem test' },
          'publish-key',
        );
        const service2 = createPlansService({ prisma, permissions: ALL_MANAGE, stepUpFresh: true });
        const replay = await service2.publishVersion(
          CLAIMS_A,
          plan.id,
          draft.id,
          { expectedRowVersion: draft.rowVersion, reason: 'publish idem test' },
          'publish-key',
        );
        expect(replay.id).toBe(published.id);

        await expect(
          service2.publishVersion(
            CLAIMS_A,
            plan.id,
            draft.id,
            { expectedRowVersion: draft.rowVersion, reason: 'different reason' },
            'publish-key',
          ),
        ).rejects.toBeInstanceOf(ConflictException);

        const ent = await prisma.platformPlan.findUniqueOrThrow({
          where: { canonicalKey: 'plan.enterprise' },
        });
        const noStepDraft = await service1.createDraftVersion(CLAIMS_A, ent.id, {
          translations: versionTranslations('No step up'),
        });
        const noStepUp = createPlansService({ prisma, permissions: ALL_MANAGE, stepUpFresh: false });
        await expect(
          noStepUp.publishVersion(
            CLAIMS_A,
            ent.id,
            noStepDraft.id,
            { expectedRowVersion: noStepDraft.rowVersion, reason: 'no step up' },
            'publish-no-step-key',
          ),
        ).rejects.toThrow();
        expect(
          await prisma.platformPlanIdempotencyRecord.findFirst({
            where: { idempotencyKey: 'publish-no-step-key', status: 'completed' },
          }),
        ).toBeNull();

        const lite = await prisma.platformPlan.findUniqueOrThrow({
          where: { canonicalKey: 'plan.lite' },
        });
        const staleDraft = await service1.createDraftVersion(CLAIMS_A, lite.id, {
          translations: versionTranslations('Stale row'),
        });
        await expect(
          service1.publishVersion(
            CLAIMS_A,
            lite.id,
            staleDraft.id,
            { expectedRowVersion: staleDraft.rowVersion + 99, reason: 'stale version' },
            'publish-stale-key',
          ),
        ).rejects.toThrow();
        expect(
          await prisma.platformPlanIdempotencyRecord.findFirst({
            where: { idempotencyKey: 'publish-stale-key', status: 'completed' },
          }),
        ).toBeNull();
      },
    );
  });

  (run ? it : it.skip)('idempotency retention: purgeExpired removes expired; unexpired remains', async () => {
    const service = createPlansService({ prisma, permissions: ALL_MANAGE });
    await service.createPlan(
      CLAIMS_A,
      { canonicalKey: 'plan.retention', translations: planTranslations() },
      'retention-key',
    );
    await service.createPlan(
      CLAIMS_A,
      { canonicalKey: 'plan.retention_b', translations: planTranslations() },
      'retention-fresh-key',
    );
    await prisma.platformPlanIdempotencyRecord.updateMany({
      where: { idempotencyKey: 'retention-key' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const wrapper = createPlansPrismaWrapper(prisma);
    const idem = new PlanIdempotencyService(wrapper as never);
    const purged = await idem.purgeExpired(new Date());
    expect(purged).toBeGreaterThanOrEqual(1);
    const fresh = await prisma.platformPlanIdempotencyRecord.findFirst({
      where: { idempotencyKey: 'retention-fresh-key' },
    });
    expect(fresh).not.toBeNull();
    expect(fresh!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  (run ? it : it.skip)('rate limits: mutation, highImpact, readHeavy buckets enforce 429', async () => {
    const limit2 = {
      mutationRateLimitPerMinute: 2,
      highImpactRateLimitPerMinute: 2,
      readHeavyRateLimitPerMinute: 1,
    };
    const mutationService = createPlansService({
      prisma,
      permissions: ALL_MANAGE,
      audit: durableAudit(prisma),
      config: limit2,
    });
    await mutationService.createPlan(
      CLAIMS_A,
      { canonicalKey: 'plan.rate_a', translations: planTranslations() },
    );
    await mutationService.createPlan(
      CLAIMS_A,
      { canonicalKey: 'plan.rate_b', translations: planTranslations() },
    );
    await expectRateLimited(() =>
      mutationService.createPlan(
        CLAIMS_A,
        { canonicalKey: 'plan.rate_c', translations: planTranslations() },
      ),
    );
    expect(await prisma.platformPlan.count({ where: { canonicalKey: { startsWith: 'plan.rate_' } } })).toBe(2);
    const planA = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.rate_a' } });
    const planB = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.rate_b' } });
    expect(
      await prisma.auditEntry.count({
        where: { action: 'platform_plan.created', resourceId: planA.id },
      }),
    ).toBe(1);
    expect(
      await prisma.auditEntry.count({
        where: { action: 'platform_plan.created', resourceId: planB.id },
      }),
    ).toBe(1);
    expect(await prisma.platformPlan.findUnique({ where: { canonicalKey: 'plan.rate_c' } })).toBeNull();

    const highImpactService = createPlansService({
      prisma,
      permissions: ALL_MANAGE,
      stepUpFresh: true,
      config: { highImpactRateLimitPerMinute: 1 },
    });
    await createPlansSeedService(prisma).seedAll();
    const lite = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.lite' } });
    const pro = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.pro' } });
    const liteDraft = await highImpactService.createDraftVersion(CLAIMS_A, lite.id, {
      translations: versionTranslations('Rate lite'),
    });
    const proDraft = await highImpactService.createDraftVersion(CLAIMS_A, pro.id, {
      translations: versionTranslations('Rate pro'),
    });
    await highImpactService.publishVersion(
      CLAIMS_A,
      lite.id,
      liteDraft.id,
      { expectedRowVersion: liteDraft.rowVersion, reason: 'first publish' },
    );
    await expectRateLimited(() =>
      highImpactService.publishVersion(
        CLAIMS_A,
        pro.id,
        proDraft.id,
        { expectedRowVersion: proDraft.rowVersion, reason: 'second publish blocked' },
      ),
    );
    const proRow = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: proDraft.id } });
    expect(proRow.lifecycle).toBe('DRAFT');

    const readService = createPlansService({
      prisma,
      permissions: ALL_MANAGE,
      stepUpFresh: true,
      config: { readHeavyRateLimitPerMinute: 1 },
    });
    const cmpDraft = await readService.createDraftVersion(CLAIMS_A, lite.id, {
      translations: versionTranslations('Cmp draft'),
    });
    const cmpPublished = await readService.publishVersion(
      CLAIMS_A,
      lite.id,
      cmpDraft.id,
      { expectedRowVersion: cmpDraft.rowVersion, reason: 'compare seed publish' },
    );
    const cmpCloned = await readService.cloneVersion(CLAIMS_A, lite.id, cmpPublished.id);
    await readService.compareVersions(CLAIMS_A, lite.id, cmpPublished.id, cmpCloned.id);
    await expectRateLimited(() =>
      readService.compareVersions(CLAIMS_A, lite.id, cmpPublished.id, cmpCloned.id),
    );
  });

  (run ? it : it.skip)(
    'cross-session step-up: fresh session A ok; stale session B rejected without archive audit',
    async () => {
      const service = createPlansService({
        prisma,
        permissions: ALL_MANAGE,
        stepUpBySessionId: { [SESSION_A]: true, [SESSION_B]: false },
      });
      const created = await service.createPlan(CLAIMS_A, {
        canonicalKey: 'plan.session_isolation',
        translations: planTranslations(),
      });
      const activated = await service.transitionPlanLifecycle(CLAIMS_A, created.id, 'ACTIVE', {
        expectedVersion: created.version,
        reason: 'activate with fresh session',
      });
      const archiveAuditBefore = await auditCount(
        prisma,
        'platform_plan.archived',
        created.id,
      );
      await expect(
        service.transitionPlanLifecycle(CLAIMS_B_SAME_USER, created.id, 'ARCHIVED', {
          expectedVersion: activated.version,
          reason: 'archive without step up',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      const row = await prisma.platformPlan.findUniqueOrThrow({ where: { id: created.id } });
      expect(row.lifecycle).toBe('ACTIVE');
      expect(await auditCount(prisma, 'platform_plan.archived', created.id)).toBe(
        archiveAuditBefore,
      );
    },
  );

  (run ? it : it.skip)(
    'cross-user step-up: user B publish rejected; draft unchanged despite user A fresh session',
    async () => {
      const service = createPlansService({
        prisma,
        permissions: ALL_MANAGE,
        stepUpBySessionId: { [SESSION_A]: true, [SESSION_B_USER_B]: false },
      });
      await createPlansSeedService(prisma).seedAll();
      const plan = await prisma.platformPlan.findUniqueOrThrow({
        where: { canonicalKey: 'plan.lite' },
      });
      const draft = await service.createDraftVersion(CLAIMS_A, plan.id, {
        translations: versionTranslations('User B blocked'),
      });
      await expect(
        service.publishVersion(
          CLAIMS_B_OTHER_USER,
          plan.id,
          draft.id,
          { expectedRowVersion: draft.rowVersion, reason: 'user B publish attempt' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      const row = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: draft.id } });
      expect(row.lifecycle).toBe('DRAFT');
    },
  );
});
