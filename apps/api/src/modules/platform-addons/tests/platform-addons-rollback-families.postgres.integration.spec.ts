/**
 * Step 15 injected transaction rollback by family (test-only failure hook).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import type { PrismaClient } from '@prisma/client';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';
import {
  PLATFORM_ADDONS_TX_FAILURE_HOOK,
  type AddonTxFailurePoint,
} from '../platform-addons.tokens';
import {
  cleanupPlatformAddonsTables,
  createAddonsService,
  createOverridesService,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from './platform-addons-db.harness';
import { FakeAddonAuditLog } from './support/fake-addon-audit-log';

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

const ALL = [
  'addon.view',
  'addon.manage',
  'override.view',
  'override.request',
  'override.approve',
  'plan.view',
];

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

function tr(name: string) {
  return [
    { locale: 'en-US', displayName: name, shortDescription: `${name} d` },
    { locale: 'ar-SY', displayName: name, shortDescription: `${name} ع` },
  ];
}
function vtr(label: string) {
  return [
    { locale: 'en-US', releaseLabel: label, shortDescription: `${label} en` },
    { locale: 'ar-SY', releaseLabel: `${label}-ar`, shortDescription: `${label} ع` },
  ];
}

function failAt(point: AddonTxFailurePoint) {
  return async (p: AddonTxFailurePoint) => {
    if (p === point) throw new Error(`injected ${point}`);
  };
}

async function ensureCatalogAndPlans(prisma: PrismaClient) {
  const dash = await prisma.healthcareCatalogItem.findUnique({
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
  }
  if ((await prisma.platformPlan.count()) === 0) {
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
  }
}

describe('Step 15 production failure-hook absence', () => {
  it('PlatformAddonsModule does not register PLATFORM_ADDONS_TX_FAILURE_HOOK', () => {
    const moduleSrc = readFileSync(join(__dirname, '../platform-addons.module.ts'), 'utf8');
    expect(moduleSrc).not.toContain('PLATFORM_ADDONS_TX_FAILURE_HOOK');
    expect(moduleSrc).not.toMatch(/provide:\s*PLATFORM_ADDONS_TX_FAILURE_HOOK/);
    expect(PLATFORM_ADDONS_TX_FAILURE_HOOK.description).toContain('PLATFORM_ADDONS_TX_FAILURE_HOOK');
  });
});

describeDb('Step 15 rollback injection by transaction family', () => {
  let prisma: PrismaClient;
  let moduleItem: { id: string };
  let featureItem: { id: string };
  let limitItem: { id: string };
  let planKey: string;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient(DEFAULT_PLATFORM_DB_SECURITY_URL);
    await prisma.$connect();
    await ensureCatalogAndPlans(prisma);
    moduleItem = await prisma.healthcareCatalogItem.findUniqueOrThrow({
      where: { canonicalKey: 'module.dashboard' },
    });
    featureItem = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { kind: 'FEATURE' },
    });
    limitItem = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { kind: 'LIMIT' },
    });
    const plan = await prisma.platformPlan.findFirstOrThrow();
    planKey = plan.canonicalKey;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    await cleanupPlatformAddonsTables(prisma);
  });

  async function seedDraft(key: string) {
    const bare = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const addon = await bare.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: key,
      translations: tr(key),
    });
    const draft = await bare.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: vtr('d'),
    });
    return { addon, draft };
  }

  it('A. entitlement partial insert rolls back', async () => {
    const { addon, draft } = await seedDraft('addon.rb_ent');
    await createAddonsService({ prisma, permissions: ALL, stepUpFresh: true }).replaceEntitlements(
      CREATOR_CLAIMS,
      addon.id,
      draft.id,
      { expectedRowVersion: draft.rowVersion, catalogItemIds: [moduleItem.id] },
    );
    const ver = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    const before = await prisma.platformAddOnVersionEntitlement.count({
      where: { addOnVersionId: draft.id },
    });
    const audit = new FakeAddonAuditLog();
    const failing = createAddonsService({
      prisma,
      permissions: ALL,
      stepUpFresh: true,
      audit,
      failureHook: failAt('after_entitlement_partial_insert'),
    });
    await expect(
      failing.replaceEntitlements(
        CREATOR_CLAIMS,
        addon.id,
        draft.id,
        {
          expectedRowVersion: ver.rowVersion,
          catalogItemIds: [moduleItem.id, featureItem.id],
        },
        'idem-rb-ent',
      ),
    ).rejects.toThrow(/after_entitlement_partial_insert/);
    const after = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(after.rowVersion).toBe(ver.rowVersion);
    expect(
      await prisma.platformAddOnVersionEntitlement.count({ where: { addOnVersionId: draft.id } }),
    ).toBe(before);
    expect(
      await prisma.platformCommercialIdempotencyRecord.count({
        where: { idempotencyKey: 'idem-rb-ent' },
      }),
    ).toBe(0);
    expect(
      audit.records.filter((r) => r.action === 'platform_addon_version.entitlements_replaced')
        .length,
    ).toBe(0);
  });

  it('B. limit-effect partial insert rolls back', async () => {
    const { addon, draft } = await seedDraft('addon.rb_lim');
    const audit = new FakeAddonAuditLog();
    const failing = createAddonsService({
      prisma,
      permissions: ALL,
      stepUpFresh: true,
      audit,
      failureHook: failAt('after_limit_effect_partial_insert'),
    });
    await expect(
      failing.replaceLimitEffects(
        CREATOR_CLAIMS,
        addon.id,
        draft.id,
        {
          expectedRowVersion: draft.rowVersion,
          effects: [
            { catalogItemId: limitItem.id, effectType: 'INCREASE_BY', valueText: '1' },
            {
              catalogItemId: (
                await prisma.healthcareCatalogItem.findFirstOrThrow({
                  where: { kind: 'LIMIT', id: { not: limitItem.id } },
                })
              ).id,
              effectType: 'INCREASE_BY',
              valueText: '2',
            },
          ],
        },
        'idem-rb-lim',
      ),
    ).rejects.toThrow(/after_limit_effect_partial_insert/);
    const after = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(after.rowVersion).toBe(draft.rowVersion);
    expect(
      await prisma.platformAddOnVersionLimitEffect.count({ where: { addOnVersionId: draft.id } }),
    ).toBe(0);
    expect(
      await prisma.platformCommercialIdempotencyRecord.count({
        where: { idempotencyKey: 'idem-rb-lim' },
      }),
    ).toBe(0);
  });

  it('C. applicability partial insert rolls back', async () => {
    const { addon, draft } = await seedDraft('addon.rb_app');
    const otherPlan = await prisma.platformPlan.findFirst({
      where: { canonicalKey: { not: planKey } },
    });
    const keys = otherPlan ? [planKey, otherPlan.canonicalKey] : [planKey, planKey];
    // Need two distinct keys for partial split — plant a second plan key if needed
    const planKeys =
      otherPlan != null
        ? [planKey, otherPlan.canonicalKey]
        : [planKey];
    if (planKeys.length < 2) {
      // single key still hits delete + row bump paths via after_applicability_delete
      const failing = createAddonsService({
        prisma,
        permissions: ALL,
        stepUpFresh: true,
        failureHook: failAt('after_applicability_delete'),
      });
      await expect(
        failing.replaceApplicability(
          CREATOR_CLAIMS,
          addon.id,
          draft.id,
          { expectedRowVersion: draft.rowVersion, planCanonicalKeys: [planKey] },
          'idem-rb-app',
        ),
      ).rejects.toThrow(/after_applicability_delete/);
    } else {
      const failing = createAddonsService({
        prisma,
        permissions: ALL,
        stepUpFresh: true,
        failureHook: failAt('after_applicability_partial_insert'),
      });
      await expect(
        failing.replaceApplicability(
          CREATOR_CLAIMS,
          addon.id,
          draft.id,
          { expectedRowVersion: draft.rowVersion, planCanonicalKeys: planKeys },
          'idem-rb-app',
        ),
      ).rejects.toThrow(/after_applicability_partial_insert/);
    }
    const after = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(after.rowVersion).toBe(draft.rowVersion);
    expect(
      await prisma.platformCommercialIdempotencyRecord.count({
        where: { idempotencyKey: 'idem-rb-app' },
      }),
    ).toBe(0);
  });

  it('D. clone entitlement partial rolls back — no orphan draft', async () => {
    const bare = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const { addon, draft } = await seedDraft('addon.rb_clone');
    let rv = draft.rowVersion;
    await bare.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: rv,
      catalogItemIds: [moduleItem.id, featureItem.id],
    });
    rv = (await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } }))
      .rowVersion;
    await bare.publishVersion(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: rv,
      reason: 'seed for clone rollback',
    });
    const failing = createAddonsService({
      prisma,
      permissions: ALL,
      stepUpFresh: true,
      failureHook: failAt('after_clone_entitlement_partial'),
    });
    await expect(
      failing.cloneVersion(CREATOR_CLAIMS, addon.id, draft.id, {}, 'idem-rb-clone'),
    ).rejects.toThrow(/after_clone_entitlement_partial/);
    expect(await prisma.platformAddOnVersion.count({ where: { addOnId: addon.id } })).toBe(1);
    expect(
      await prisma.platformCommercialIdempotencyRecord.count({
        where: { idempotencyKey: 'idem-rb-clone' },
      }),
    ).toBe(0);
  });

  it('E. publish after fingerprint rolls back — stays DRAFT', async () => {
    const { addon, draft } = await seedDraft('addon.rb_pub');
    const bare = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    await bare.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: draft.rowVersion,
      catalogItemIds: [moduleItem.id],
    });
    const ver = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    const failing = createAddonsService({
      prisma,
      permissions: ALL,
      stepUpFresh: true,
      failureHook: failAt('after_publish_lifecycle_update'),
    });
    await expect(
      failing.publishVersion(
        CREATOR_CLAIMS,
        addon.id,
        draft.id,
        { expectedRowVersion: ver.rowVersion, reason: 'rb publish' },
        'idem-rb-pub',
      ),
    ).rejects.toThrow(/after_publish_lifecycle_update/);
    const after = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(after.lifecycle).toBe('DRAFT');
    expect(after.publicationFingerprint).toBeNull();
    expect(after.rowVersion).toBe(ver.rowVersion);
    expect(
      await prisma.platformCommercialIdempotencyRecord.count({
        where: { idempotencyKey: 'idem-rb-pub' },
      }),
    ).toBe(0);
  });

  it('F. retire lifecycle update rolls back — stays PUBLISHED', async () => {
    const { addon, draft } = await seedDraft('addon.rb_ret');
    const bare = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    await bare.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: draft.rowVersion,
      catalogItemIds: [moduleItem.id],
    });
    const published = await bare.publishVersion(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: (
        await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } })
      ).rowVersion,
      reason: 'seed retire rb',
    });
    const failing = createAddonsService({
      prisma,
      permissions: ALL,
      stepUpFresh: true,
      failureHook: failAt('after_retire_lifecycle_update'),
    });
    await expect(
      failing.retireVersion(
        CREATOR_CLAIMS,
        addon.id,
        draft.id,
        { expectedRowVersion: published.rowVersion, reason: 'rb retire' },
        'idem-rb-ret',
      ),
    ).rejects.toThrow(/after_retire_lifecycle_update/);
    const after = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(after.lifecycle).toBe('PUBLISHED');
    expect(after.rowVersion).toBe(published.rowVersion);
  });

  it('G. override effect partial rolls back', async () => {
    const req = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      stepUpFresh: true,
    });
    const created = await req.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'rb override draft',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
    });
    const failing = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      stepUpFresh: true,
      failureHook: failAt('after_override_effect_partial'),
    });
    await expect(
      failing.updateDraft(
        CREATOR_CLAIMS,
        created.id,
        {
          expectedRowVersion: created.rowVersion,
          effects: [
            { effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id },
            { effectKind: 'ENTITLEMENT_GRANT', catalogItemId: featureItem.id },
          ],
        },
        'idem-rb-ov-upd',
      ),
    ).rejects.toThrow(/after_override_effect_partial/);
    const after = await prisma.platformCommercialOverride.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(after.rowVersion).toBe(created.rowVersion);
    expect(
      await prisma.platformCommercialOverrideEffect.count({ where: { overrideId: created.id } }),
    ).toBe(1);
  });

  it('H. submit lifecycle rolls back', async () => {
    const req = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      stepUpFresh: true,
      failureHook: failAt('after_submit_lifecycle'),
    });
    const created = await req.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'rb submit',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
    });
    // recreate with hook only on submit
    const failing = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      stepUpFresh: true,
      failureHook: failAt('before_submit_commit'),
    });
    await expect(
      failing.submit(
        CREATOR_CLAIMS,
        created.id,
        { expectedRowVersion: created.rowVersion },
        'idem-rb-sub',
      ),
    ).rejects.toThrow(/before_submit_commit/);
    const after = await prisma.platformCommercialOverride.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(after.lifecycle).toBe('DRAFT');
  });

  it('I. approve rolls back', async () => {
    const req = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      stepUpFresh: true,
    });
    const created = await req.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'rb approve',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
    });
    const submitted = await req.submit(CREATOR_CLAIMS, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    const failing = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.approve'],
      stepUpFresh: true,
      failureHook: failAt('before_approve_commit'),
    });
    await expect(
      failing.approve(
        APPROVER_CLAIMS,
        created.id,
        { expectedRowVersion: submitted.rowVersion },
        'idem-rb-appr',
      ),
    ).rejects.toThrow(/before_approve_commit/);
    const after = await prisma.platformCommercialOverride.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(after.lifecycle).toBe('PENDING_APPROVAL');
    expect(after.approvedByPlatformUserId).toBeNull();
  });

  it('J. reject rolls back', async () => {
    const req = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      stepUpFresh: true,
    });
    const created = await req.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'rb reject',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
    });
    const submitted = await req.submit(CREATOR_CLAIMS, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    const failing = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.approve'],
      stepUpFresh: true,
      failureHook: failAt('before_reject_commit'),
    });
    await expect(
      failing.reject(
        APPROVER_CLAIMS,
        created.id,
        { expectedRowVersion: submitted.rowVersion, reason: 'rb reject' },
        'idem-rb-rej',
      ),
    ).rejects.toThrow(/before_reject_commit/);
    const after = await prisma.platformCommercialOverride.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(after.lifecycle).toBe('PENDING_APPROVAL');
  });

  it('K. revoke rolls back', async () => {
    const req = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      stepUpFresh: true,
    });
    const created = await req.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'rb revoke',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
    });
    const submitted = await req.submit(CREATOR_CLAIMS, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    const appr = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.approve'],
      stepUpFresh: true,
    });
    const approved = await appr.approve(APPROVER_CLAIMS, created.id, {
      expectedRowVersion: submitted.rowVersion,
    });
    const failing = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.approve'],
      stepUpFresh: true,
      failureHook: failAt('before_revoke_commit'),
    });
    await expect(
      failing.revoke(
        APPROVER_CLAIMS,
        created.id,
        { expectedRowVersion: approved.rowVersion, reason: 'rb revoke' },
        'idem-rb-rev',
      ),
    ).rejects.toThrow(/before_revoke_commit/);
    const after = await prisma.platformCommercialOverride.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(after.lifecycle).toBe('APPROVED');
  });

  it('L. supersede partial effect copy rolls back — no successor orphan', async () => {
    const req = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      stepUpFresh: true,
    });
    const created = await req.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'rb supersede pred',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
    });
    const submitted = await req.submit(CREATOR_CLAIMS, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    const appr = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.approve'],
      stepUpFresh: true,
    });
    await appr.approve(APPROVER_CLAIMS, created.id, {
      expectedRowVersion: submitted.rowVersion,
    });
    const beforeCount = await prisma.platformCommercialOverride.count();
    const failing = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      stepUpFresh: true,
      failureHook: failAt('after_supersede_partial_effects'),
    });
    await expect(
      failing.supersede(
        CREATOR_CLAIMS,
        created.id,
        {
          reasonCode: 'CONTRACTUAL_EXCEPTION',
          reasonNote: 'rb supersede successor',
          effects: [
            { effectKind: 'ENTITLEMENT_GRANT', catalogItemId: featureItem.id },
            { effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id },
          ],
        },
        'idem-rb-sup',
      ),
    ).rejects.toThrow(/after_supersede_partial_effects/);
    expect(await prisma.platformCommercialOverride.count()).toBe(beforeCount);
    expect(
      await prisma.platformCommercialIdempotencyRecord.count({
        where: { idempotencyKey: 'idem-rb-sup', status: 'completed' },
      }),
    ).toBe(0);
    const pred = await prisma.platformCommercialOverride.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(pred.lifecycle).toBe('APPROVED');
  });
});
