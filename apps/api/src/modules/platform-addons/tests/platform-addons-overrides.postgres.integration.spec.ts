/**
 * Step 15 — Add-ons & Commercial Overrides PostgreSQL integration.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  cleanupPlatformAddonsTables,
  createAddonsService,
  createCompositionService,
  createOverridesService,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from './platform-addons-db.harness';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';

const CREATOR = '00000000-0000-4000-8000-000000000015';
const APPROVER = '00000000-0000-4000-8000-000000000016';

const CREATOR_CLAIMS = {
  sub: CREATOR,
  sessionId: '11111111-1111-4111-8111-111111111115',
} as JwtClaimsVO;

const APPROVER_CLAIMS = {
  sub: APPROVER,
  sessionId: '11111111-1111-4111-8111-111111111116',
} as JwtClaimsVO;

const ADDON_PERMS = ['addon.view', 'addon.manage'];
const OVERRIDE_REQUEST_PERMS = ['override.view', 'override.request'];
const OVERRIDE_APPROVE_PERMS = ['override.view', 'override.approve'];
const ALL_PERMS = [
  ...ADDON_PERMS,
  ...OVERRIDE_REQUEST_PERMS,
  ...OVERRIDE_APPROVE_PERMS,
  'plan.view',
];

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

async function ensureCatalogAndPlans(prisma: PrismaClient): Promise<void> {
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
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
          return fn(tx as unknown as typeof prisma);
        }),
    } as never);
    await catalogSeed.seedAll();
    dash = await prisma.healthcareCatalogItem.findUnique({
      where: { canonicalKey: 'module.dashboard' },
    });
  }
  if (!dash) throw new Error('Healthcare Catalog seed required for Step 15 tests.');

  const planCount = await prisma.platformPlan.count();
  if (planCount === 0) {
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
  }
}

describeDb('Platform Add-ons & Overrides PostgreSQL', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient(DEFAULT_PLATFORM_DB_SECURITY_URL);
    await prisma.$connect();
    await ensureCatalogAndPlans(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupPlatformAddonsTables(prisma);
  });

  it('creates addon, draft version, grants, limit effects, publishes fingerprint, clones', async () => {
    const addons = createAddonsService({ prisma, permissions: ALL_PERMS, stepUpFresh: true });
    const moduleItem = await prisma.healthcareCatalogItem.findUniqueOrThrow({
      where: { canonicalKey: 'module.dashboard' },
    });
    const limitItem = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { kind: 'LIMIT' },
    });
    const plan = await prisma.platformPlan.findFirstOrThrow();

    const addon = await addons.createAddOn(
      CREATOR_CLAIMS,
      {
        canonicalKey: 'addon.test_pack',
        translations: [
          { locale: 'en-US', displayName: 'Test Pack', shortDescription: 'Test add-on' },
          { locale: 'ar-SY', displayName: 'حزمة اختبار', shortDescription: 'إضافة اختبار' },
        ],
      },
      'idem-addon-create-1',
    );
    expect(addon.canonicalKey).toBe('addon.test_pack');
    expect(addon.lifecycle).toBe('DRAFT');

    // Idempotency replay
    const replayed = await addons.createAddOn(
      CREATOR_CLAIMS,
      {
        canonicalKey: 'addon.test_pack',
        translations: [
          { locale: 'en-US', displayName: 'Test Pack', shortDescription: 'Test add-on' },
          { locale: 'ar-SY', displayName: 'حزمة اختبار', shortDescription: 'إضافة اختبار' },
        ],
      },
      'idem-addon-create-1',
    );
    expect(replayed.id).toBe(addon.id);

    const draft = await addons.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: [
        { locale: 'en-US', releaseLabel: 'v1', shortDescription: 'First' },
        { locale: 'ar-SY', releaseLabel: '١', shortDescription: 'أول' },
      ],
    });
    expect(draft.lifecycle).toBe('DRAFT');
    expect(draft.runtimeEffective).toBe(false);

    const withEnt = await addons.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: draft.rowVersion,
      catalogItemIds: [moduleItem.id],
    });
    expect(withEnt.entitlements).toHaveLength(1);

    const withLimits = await addons.replaceLimitEffects(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: withEnt.rowVersion,
      effects: [
        {
          catalogItemId: limitItem.id,
          effectType: 'INCREASE_BY',
          valueText: '25',
        },
      ],
    });
    expect(withLimits.limitEffects).toHaveLength(1);

    const withApp = await addons.replaceApplicability(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: withLimits.rowVersion,
      planCanonicalKeys: [plan.canonicalKey],
    });
    expect(withApp.applicability).toHaveLength(1);

    // Stale OCC on Draft publish (wrong rowVersion) → Conflict before lifecycle change
    await expect(
      addons.publishVersion(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: withApp.rowVersion - 1,
        reason: 'stale publish attempt',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const published = await addons.publishVersion(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: withApp.rowVersion,
      reason: 'publish commercial definition only',
    });
    expect(published.lifecycle).toBe('PUBLISHED');
    expect(published.publicationFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(published.runtimeEffective).toBe(false);

    // Already Published — cannot republish (lifecycle), not a stale OCC Conflict
    await expect(
      addons.publishVersion(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: published.rowVersion,
        reason: 'republish blocked',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const cloned = await addons.cloneVersion(CREATOR_CLAIMS, addon.id, draft.id, {});
    expect(cloned.lifecycle).toBe('DRAFT');
    expect(cloned.sourceVersionId).toBe(draft.id);
    expect(cloned.entitlements).toHaveLength(1);
    expect(cloned.limitEffects).toHaveLength(1);
  });

  it('override submit, SoD self-approve fail, approve success, revoke', async () => {
    const moduleItem = await prisma.healthcareCatalogItem.findUniqueOrThrow({
      where: { canonicalKey: 'module.dashboard' },
    });
    const requester = createOverridesService({
      prisma,
      permissions: OVERRIDE_REQUEST_PERMS,
      stepUpFresh: true,
    });
    const approver = createOverridesService({
      prisma,
      permissions: OVERRIDE_APPROVE_PERMS,
      stepUpFresh: true,
    });
    const selfApprover = createOverridesService({
      prisma,
      permissions: ALL_PERMS,
      stepUpFresh: true,
    });

    const created = await requester.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'Temporary concession for pilot',
      effects: [
        {
          effectKind: 'ENTITLEMENT_GRANT',
          catalogItemId: moduleItem.id,
        },
      ],
    });
    expect(created.lifecycle).toBe('DRAFT');
    expect(created.tenantAssignment).toBe('unavailable_until_step_16');

    const submitted = await requester.submit(CREATOR_CLAIMS, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    expect(submitted.lifecycle).toBe('PENDING_APPROVAL');

    // Self-approve SoD fail
    await expect(
      selfApprover.approve(CREATOR_CLAIMS, created.id, {
        expectedRowVersion: submitted.rowVersion,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const approved = await approver.approve(APPROVER_CLAIMS, created.id, {
      expectedRowVersion: submitted.rowVersion,
    });
    expect(approved.lifecycle).toBe('APPROVED');
    expect(approved.approvedByPlatformUserId).toBe(APPROVER);
    expect(approved.runtimeEffective).toBe(false);

    const revoked = await approver.revoke(APPROVER_CLAIMS, created.id, {
      expectedRowVersion: approved.rowVersion,
      reason: 'revoke after pilot ended',
    });
    expect(revoked.lifecycle).toBe('REVOKED');
  });

  it('composition preview is static commercial only — no licensing call', async () => {
    const addons = createAddonsService({ prisma, permissions: ALL_PERMS, stepUpFresh: true });
    const overrides = createOverridesService({
      prisma,
      permissions: ALL_PERMS,
      stepUpFresh: true,
    });
    const composition = createCompositionService({ prisma, permissions: ALL_PERMS });

    const moduleItem = await prisma.healthcareCatalogItem.findUniqueOrThrow({
      where: { canonicalKey: 'module.dashboard' },
    });
    // Composition preview accepts any Plan Version lifecycle (static commercial only).
    const planVersion = await prisma.platformPlanVersion.findFirstOrThrow();

    const addon = await addons.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.compose_pack',
      translations: [
        { locale: 'en-US', displayName: 'Compose', shortDescription: 'Compose test' },
        { locale: 'ar-SY', displayName: 'تركيب', shortDescription: 'اختبار' },
      ],
    });
    const draft = await addons.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: [
        { locale: 'en-US', releaseLabel: 'c1', shortDescription: 'c' },
        { locale: 'ar-SY', releaseLabel: 'ج١', shortDescription: 'ج' },
      ],
    });
    await addons.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: draft.rowVersion,
      catalogItemIds: [moduleItem.id],
    });

    const ov = await overrides.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SUPPORT_WAIVER',
      reasonNote: 'Support waiver for composition preview',
      effects: [
        {
          effectKind: 'ENTITLEMENT_SUPPRESS',
          catalogItemId: moduleItem.id,
        },
      ],
    });

    const preview = await composition.preview(CREATOR_CLAIMS, {
      planVersionId: planVersion.id,
      addonVersionIds: [draft.id],
      overrideIds: [ov.id],
    });

    expect(preview.licensingEngineCalled).toBe(false);
    expect(preview.runtimeEffective).toBe(false);
    expect(preview.disclaimer).toMatch(/LicensingEngineService/i);

    // Source-level guarantee: composition service never references LicensingEngineService
    const compositionSrc = readFileSync(
      join(__dirname, '../application/commercial-composition.service.ts'),
      'utf8',
    );
    expect(compositionSrc).not.toMatch(/LicensingEngineService/);
  });

  it('stale OCC on entitlement replace rejects', async () => {
    const addons = createAddonsService({ prisma, permissions: ALL_PERMS, stepUpFresh: true });
    const moduleItem = await prisma.healthcareCatalogItem.findUniqueOrThrow({
      where: { canonicalKey: 'module.dashboard' },
    });
    const addon = await addons.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.occ_pack',
      translations: [
        { locale: 'en-US', displayName: 'OCC', shortDescription: 'OCC test' },
        { locale: 'ar-SY', displayName: 'تزامن', shortDescription: 'اختبار' },
      ],
    });
    const draft = await addons.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: [
        { locale: 'en-US', releaseLabel: 'o1', shortDescription: 'o' },
        { locale: 'ar-SY', releaseLabel: 'و١', shortDescription: 'و' },
      ],
    });
    await addons.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: draft.rowVersion,
      catalogItemIds: [moduleItem.id],
    });
    await expect(
      addons.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: draft.rowVersion,
        catalogItemIds: [],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('empty add-on catalog is valid (no invented seed products)', async () => {
    const addons = createAddonsService({ prisma, permissions: ADDON_PERMS });
    const list = await addons.listAddOns(CREATOR_CLAIMS, {});
    expect(list.total).toBe(0);
    expect(list.emptyCatalog).toBe(true);
    expect(await prisma.platformAddOn.count()).toBe(0);
    expect(await prisma.platformPlan.count()).toBeGreaterThan(0);
  });

  it('schema keeps Step 15 definition tables free of tenant assignment columns', async () => {
    const addonCols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'platform_addons'`,
    );
    const overrideCols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'platform_commercial_overrides'`,
    );
    const names = [...addonCols, ...overrideCols].map((c) => c.column_name.toLowerCase());
    expect(names).not.toContain('tenantid');
    expect(names).not.toContain('subscriptionid');

    // Step 16 may add commercial assignment tables on the shared DB; Step 15 must not own them.
    // Fail closed on Step 17 effective-entitlement runtime tables.
    const step17 = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND (table_name ILIKE '%effective_entitlement%'
           OR table_name ILIKE '%runtime_entitlement%'
           OR table_name ILIKE '%entitlement_cache%')`,
    );
    expect(step17).toHaveLength(0);
  });

  it('mutation rate limit returns 429 without completing idempotency', async () => {
    const addons = createAddonsService({
      prisma,
      permissions: ADDON_PERMS,
      config: { mutationRateLimitPerMinute: 1 },
    });
    await addons.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.rate_one',
      translations: [
        { locale: 'en-US', displayName: 'Rate', shortDescription: 'Rate test' },
        { locale: 'ar-SY', displayName: 'معدل', shortDescription: 'اختبار' },
      ],
    });
    await expect(
      addons.createAddOn(
        CREATOR_CLAIMS,
        {
          canonicalKey: 'addon.rate_two',
          translations: [
            { locale: 'en-US', displayName: 'Rate 2', shortDescription: 'Rate test 2' },
            { locale: 'ar-SY', displayName: 'معدل ٢', shortDescription: 'اختبار ٢' },
          ],
        },
        'idem-rate-blocked',
      ),
    ).rejects.toMatchObject({ status: 429 });
    expect(await prisma.platformCommercialIdempotencyRecord.count()).toBe(0);
  });

  it('publish without fresh step-up is rejected and leaves Draft unchanged', async () => {
    const addons = createAddonsService({
      prisma,
      permissions: ALL_PERMS,
      stepUpFresh: false,
    });
    const moduleItem = await prisma.healthcareCatalogItem.findUniqueOrThrow({
      where: { canonicalKey: 'module.dashboard' },
    });
    const addon = await addons.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.stepup_pack',
      translations: [
        { locale: 'en-US', displayName: 'StepUp', shortDescription: 'Step-up test' },
        { locale: 'ar-SY', displayName: 'تحقق', shortDescription: 'اختبار' },
      ],
    });
    const draft = await addons.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: [
        { locale: 'en-US', releaseLabel: 's1', shortDescription: 's' },
        { locale: 'ar-SY', releaseLabel: 'س١', shortDescription: 'س' },
      ],
    });
    const withEnt = await addons.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: draft.rowVersion,
      catalogItemIds: [moduleItem.id],
    });
    await expect(
      addons.publishVersion(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: withEnt.rowVersion,
        reason: 'should fail without step-up',
      }),
    ).rejects.toBeInstanceOf(HttpException);
    const reloaded = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(reloaded.lifecycle).toBe('DRAFT');
    expect(reloaded.publicationFingerprint).toBeNull();
  });

  it('changed grant changes fingerprint; supersede preserves predecessor', async () => {
    const addons = createAddonsService({ prisma, permissions: ALL_PERMS, stepUpFresh: true });
    const overrides = createOverridesService({
      prisma,
      permissions: ALL_PERMS,
      stepUpFresh: true,
    });
    const moduleItem = await prisma.healthcareCatalogItem.findUniqueOrThrow({
      where: { canonicalKey: 'module.dashboard' },
    });
    const featureItem = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { kind: 'FEATURE' },
    });

    const addon = await addons.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.fp_pack',
      translations: [
        { locale: 'en-US', displayName: 'FP', shortDescription: 'Fingerprint' },
        { locale: 'ar-SY', displayName: 'بصمة', shortDescription: 'اختبار' },
      ],
    });
    const v1 = await addons.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: [
        { locale: 'en-US', releaseLabel: 'fp1', shortDescription: 'fp' },
        { locale: 'ar-SY', releaseLabel: 'ب١', shortDescription: 'ب' },
      ],
    });
    const e1 = await addons.replaceEntitlements(CREATOR_CLAIMS, addon.id, v1.id, {
      expectedRowVersion: v1.rowVersion,
      catalogItemIds: [moduleItem.id],
    });
    const p1 = await addons.publishVersion(CREATOR_CLAIMS, addon.id, v1.id, {
      expectedRowVersion: e1.rowVersion,
      reason: 'first fingerprint',
    });
    const v2 = await addons.cloneVersion(CREATOR_CLAIMS, addon.id, v1.id, {});
    const e2 = await addons.replaceEntitlements(CREATOR_CLAIMS, addon.id, v2.id, {
      expectedRowVersion: v2.rowVersion,
      catalogItemIds: [moduleItem.id, featureItem.id],
    });
    const p2 = await addons.publishVersion(CREATOR_CLAIMS, addon.id, v2.id, {
      expectedRowVersion: e2.rowVersion,
      reason: 'second fingerprint',
    });
    expect(p1.publicationFingerprint).not.toBe(p2.publicationFingerprint);

    const created = await overrides.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'CONTRACTUAL_EXCEPTION',
      reasonNote: 'Supersede predecessor test',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
    });
    const submitted = await overrides.submit(CREATOR_CLAIMS, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    const approved = await createOverridesService({
      prisma,
      permissions: OVERRIDE_APPROVE_PERMS,
      stepUpFresh: true,
    }).approve(APPROVER_CLAIMS, created.id, { expectedRowVersion: submitted.rowVersion });

    const draft2 = await overrides.supersede(CREATOR_CLAIMS, approved.id, {
      reasonCode: 'CONTRACTUAL_EXCEPTION',
      reasonNote: 'Supersede successor draft',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: featureItem.id }],
    });
    expect(draft2.lifecycle).toBe('DRAFT');
    expect(draft2.predecessorId).toBe(approved.id);
    const predecessor = await prisma.platformCommercialOverride.findUniqueOrThrow({
      where: { id: approved.id },
    });
    expect(predecessor.lifecycle).toBe('APPROVED');
  });
});
