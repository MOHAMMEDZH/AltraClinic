/**
 * Step 15 lifecycle concurrency matrix — real PostgreSQL races.
 */
import { ConflictException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';
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

function settledWinnerLoser(results: PromiseSettledResult<unknown>[]) {
  const ok = results.filter((r) => r.status === 'fulfilled');
  const bad = results.filter((r) => r.status === 'rejected');
  expect(ok.length + bad.length).toBe(2);
  return { ok, bad };
}

function expectConflictOrUnique(reason: unknown) {
  const msg = String((reason as Error)?.message ?? reason ?? '');
  expect(
    reason instanceof ConflictException ||
      /Stale version/i.test(msg) ||
      /already exists/i.test(msg) ||
      /open Draft/i.test(msg) ||
      /Unique constraint/i.test(msg) ||
      /P2002/i.test(msg) ||
      (typeof reason === 'object' &&
        reason !== null &&
        'code' in reason &&
        (reason as { code?: string }).code === 'P2002'),
  ).toBe(true);
}

describeDb('Step 15 lifecycle concurrency matrix (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let moduleItem: { id: string };
  let featureItem: { id: string };

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
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    await cleanupPlatformAddonsTables(prisma);
  });

  it('identity: update vs update — one OCC winner', async () => {
    const audit = new FakeAddonAuditLog();
    const svc = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true, audit });
    const addon = await svc.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_upd',
      translations: tr('Race Upd'),
    });
    const rv = addon.rowVersion;
    const results = await Promise.allSettled([
      svc.updateAddOn(CREATOR_CLAIMS, addon.id, {
        expectedRowVersion: rv,
        translations: tr('A'),
      }),
      svc.updateAddOn(CREATOR_CLAIMS, addon.id, {
        expectedRowVersion: rv,
        translations: tr('B'),
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect((bad[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    const final = await prisma.platformAddOn.findUniqueOrThrow({ where: { id: addon.id } });
    expect(final.rowVersion).toBe(rv + 1);
    expect(audit.records.filter((r) => r.action === 'platform_addon.updated').length).toBe(1);
  });

  it('identity: activate vs archive from DRAFT — one winner', async () => {
    const audit = new FakeAddonAuditLog();
    const svc = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true, audit });
    const addon = await svc.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_act_arch',
      translations: tr('Race ActArch'),
    });
    const rv = addon.rowVersion;
    const results = await Promise.allSettled([
      svc.transitionAddOnLifecycle(CREATOR_CLAIMS, addon.id, 'ACTIVE', {
        expectedRowVersion: rv,
        reason: 'activate race',
      }),
      svc.transitionAddOnLifecycle(CREATOR_CLAIMS, addon.id, 'ARCHIVED', {
        expectedRowVersion: rv,
        reason: 'archive race',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    const final = await prisma.platformAddOn.findUniqueOrThrow({ where: { id: addon.id } });
    expect(['ACTIVE', 'ARCHIVED']).toContain(final.lifecycle);
    expect(final.rowVersion).toBe(rv + 1);
  });

  it('identity: archive vs create Draft Version', async () => {
    const svc = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const addon = await svc.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_arch_draft',
      translations: tr('Race ArchDraft'),
    });
    // Activate first so archive is a high-impact race against draft creation.
    const active = await svc.transitionAddOnLifecycle(CREATOR_CLAIMS, addon.id, 'ACTIVE', {
      expectedRowVersion: addon.rowVersion,
      reason: 'activate before archive/draft race',
    });
    const rv = active.rowVersion;
    const results = await Promise.allSettled([
      svc.transitionAddOnLifecycle(CREATOR_CLAIMS, addon.id, 'ARCHIVED', {
        expectedRowVersion: rv,
        reason: 'archive vs draft',
      }),
      svc.createDraftVersion(CREATOR_CLAIMS, addon.id, { translations: vtr('d1') }),
    ]);
    // Archive uses identity OCC; createDraft does not — typically both succeed.
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBeGreaterThanOrEqual(1);
    if (results[0]!.status === 'rejected' && results[1]!.status === 'rejected') {
      throw new Error(
        `both ops failed: ${String((results[0] as PromiseRejectedResult).reason)} | ${String(
          (results[1] as PromiseRejectedResult).reason,
        )}`,
      );
    }
    const final = await prisma.platformAddOn.findUniqueOrThrow({ where: { id: addon.id } });
    if (results[0]!.status === 'fulfilled') {
      expect(final.lifecycle).toBe('ARCHIVED');
    }
  });

  it('version: entitlements vs publish — publish wins only if ready; OCC on loser', async () => {
    const svc = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const addon = await svc.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_ent_pub',
      translations: tr('Race EntPub'),
    });
    const draft = await svc.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: vtr('ep'),
    });
    await svc.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: draft.rowVersion,
      catalogItemIds: [moduleItem.id],
    });
    const ver = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    const rv = ver.rowVersion;
    const results = await Promise.allSettled([
      svc.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: rv,
        catalogItemIds: [featureItem.id],
      }),
      svc.publishVersion(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: rv,
        reason: 'publish vs grants',
      }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const bad = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    const final = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(final.rowVersion).toBe(rv + 1);
  });

  it('version: two equivalent publish requests share one PUBLISHED + fingerprint', async () => {
    const audit = new FakeAddonAuditLog();
    const svc = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true, audit });
    const addon = await svc.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_eq_pub',
      translations: tr('Race EqPub'),
    });
    const draft = await svc.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: vtr('eqp'),
    });
    await svc.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: draft.rowVersion,
      catalogItemIds: [moduleItem.id],
    });
    const ver = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    const key = 'idem-eq-publish';
    const body = { expectedRowVersion: ver.rowVersion, reason: 'eq publish' };
    const [a, b] = await Promise.all([
      svc.publishVersion(CREATOR_CLAIMS, addon.id, draft.id, body, key),
      svc.publishVersion(CREATOR_CLAIMS, addon.id, draft.id, body, key),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.lifecycle).toBe('PUBLISHED');
    expect(a.publicationFingerprint).toBe(b.publicationFingerprint);
    expect(
      await prisma.platformCommercialIdempotencyRecord.count({
        where: { idempotencyKey: key, status: 'completed' },
      }),
    ).toBe(1);
    expect(audit.records.filter((r) => r.action === 'platform_addon_version.published').length).toBe(
      1,
    );
  });

  it('version: two conflicting publish requests — one success, one 409, no second completed', async () => {
    const svcA = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const svcB = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const addon = await svcA.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_cf_pub',
      translations: tr('Race CfPub'),
    });
    const draft = await svcA.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: vtr('cfp'),
    });
    await svcA.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: draft.rowVersion,
      catalogItemIds: [moduleItem.id],
    });
    const ver = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    const results = await Promise.allSettled([
      svcA.publishVersion(
        CREATOR_CLAIMS,
        addon.id,
        draft.id,
        { expectedRowVersion: ver.rowVersion, reason: 'publish A' },
        'idem-cf-pub-a',
      ),
      svcB.publishVersion(
        CREATOR_CLAIMS,
        addon.id,
        draft.id,
        { expectedRowVersion: ver.rowVersion, reason: 'publish B' },
        'idem-cf-pub-b',
      ),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const bad = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect(
      await prisma.platformCommercialIdempotencyRecord.count({
        where: {
          status: 'completed',
          idempotencyKey: { in: ['idem-cf-pub-a', 'idem-cf-pub-b'] },
        },
      }),
    ).toBe(1);
    const final = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(final.lifecycle).toBe('PUBLISHED');
    expect(final.publicationFingerprint).toBeTruthy();
  });

  it('version: publish vs retire on PUBLISHED — retire OCC winner', async () => {
    const svc = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const addon = await svc.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_pub_ret',
      translations: tr('Race PubRet'),
    });
    const draft = await svc.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: vtr('pr'),
    });
    const withEnt = await svc.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: draft.rowVersion,
      catalogItemIds: [moduleItem.id],
    });
    const published = await svc.publishVersion(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: withEnt.rowVersion,
      reason: 'seed publish',
    });
    const rv = published.rowVersion;
    const results = await Promise.allSettled([
      svc.retireVersion(CREATOR_CLAIMS, addon.id, published.id, {
        expectedRowVersion: rv,
        reason: 'retire race a',
      }),
      svc.retireVersion(CREATOR_CLAIMS, addon.id, published.id, {
        expectedRowVersion: rv,
        reason: 'retire race b',
      }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBe(1);
    const final = await prisma.platformAddOnVersion.findUniqueOrThrow({
      where: { id: published.id },
    });
    expect(final.lifecycle).toBe('RETIRED');
  });

  it('override: approve vs reject — one winner', async () => {
    const req = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      stepUpFresh: true,
    });
    const created = await req.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'approve vs reject',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
    });
    const submitted = await req.submit(CREATOR_CLAIMS, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    const audit = new FakeAddonAuditLog();
    const appr = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.approve'],
      stepUpFresh: true,
      audit,
    });
    const results = await Promise.allSettled([
      appr.approve(APPROVER_CLAIMS, created.id, { expectedRowVersion: submitted.rowVersion }),
      appr.reject(APPROVER_CLAIMS, created.id, {
        expectedRowVersion: submitted.rowVersion,
        reason: 'reject race',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    const final = await prisma.platformCommercialOverride.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(['APPROVED', 'REJECTED']).toContain(final.lifecycle);
    expect(final.rowVersion).toBe(submitted.rowVersion + 1);
  });

  it('override: two equivalent approve share one APPROVED + one completed row', async () => {
    const req = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      stepUpFresh: true,
    });
    const created = await req.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'eq approve',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
    });
    const submitted = await req.submit(CREATOR_CLAIMS, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    const audit = new FakeAddonAuditLog();
    const appr = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.approve'],
      stepUpFresh: true,
      audit,
    });
    const key = 'idem-eq-approve';
    const body = { expectedRowVersion: submitted.rowVersion };
    const [a, b] = await Promise.all([
      appr.approve(APPROVER_CLAIMS, created.id, body, key),
      appr.approve(APPROVER_CLAIMS, created.id, body, key),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.lifecycle).toBe('APPROVED');
    expect(
      await prisma.platformCommercialIdempotencyRecord.count({
        where: { idempotencyKey: key, status: 'completed' },
      }),
    ).toBe(1);
    expect(audit.records.filter((r) => r.action === 'platform_override.approved').length).toBe(1);
  });

  it('override: edit vs submit — one OCC winner', async () => {
    const audit = new FakeAddonAuditLog();
    const svc = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      stepUpFresh: true,
      audit,
    });
    const created = await svc.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'edit vs submit',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
    });
    const rv = created.rowVersion;
    const results = await Promise.allSettled([
      svc.updateDraft(CREATOR_CLAIMS, created.id, {
        expectedRowVersion: rv,
        reasonNote: 'edited note',
      }),
      svc.submit(CREATOR_CLAIMS, created.id, { expectedRowVersion: rv }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    const final = await prisma.platformCommercialOverride.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(final.rowVersion).toBe(rv + 1);
  });

  it('override: approve vs revoke after approve race on APPROVED', async () => {
    const req = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      stepUpFresh: true,
    });
    const created = await req.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'approve then revoke race setup',
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
    const rv = approved.rowVersion;
    const results = await Promise.allSettled([
      appr.revoke(APPROVER_CLAIMS, created.id, {
        expectedRowVersion: rv,
        reason: 'revoke A',
      }),
      appr.revoke(APPROVER_CLAIMS, created.id, {
        expectedRowVersion: rv,
        reason: 'revoke B',
      }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBeGreaterThanOrEqual(1);
    const final = await prisma.platformCommercialOverride.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(final.lifecycle).toBe('REVOKED');
  });

  it('identity: archive vs reactivate (ACTIVE→ARCHIVED vs concurrent race then reactivate OCC)', async () => {
    const svc = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const addon = await svc.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_react',
      translations: tr('Race React'),
    });
    const active = await svc.transitionAddOnLifecycle(CREATOR_CLAIMS, addon.id, 'ACTIVE', {
      expectedRowVersion: addon.rowVersion,
      reason: 'to active',
    });
    const archived = await svc.transitionAddOnLifecycle(CREATOR_CLAIMS, addon.id, 'ARCHIVED', {
      expectedRowVersion: active.rowVersion,
      reason: 'to archived',
    });
    const rv = archived.rowVersion;
    const results = await Promise.allSettled([
      svc.transitionAddOnLifecycle(CREATOR_CLAIMS, addon.id, 'ACTIVE', {
        expectedRowVersion: rv,
        reason: 'reactivate A',
      }),
      svc.transitionAddOnLifecycle(CREATOR_CLAIMS, addon.id, 'ACTIVE', {
        expectedRowVersion: rv,
        reason: 'reactivate B',
      }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok).toHaveLength(1);
    const final = await prisma.platformAddOn.findUniqueOrThrow({ where: { id: addon.id } });
    expect(final.lifecycle).toBe('ACTIVE');
  });

  it('version: grants vs limit-effects concurrent OCC', async () => {
    const limitItem = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { kind: 'LIMIT' },
    });
    const svc = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const addon = await svc.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_gl',
      translations: tr('Race GL'),
    });
    const draft = await svc.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: vtr('gl'),
    });
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      svc.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: rv,
        catalogItemIds: [moduleItem.id],
      }),
      svc.replaceLimitEffects(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: rv,
        effects: [{ catalogItemId: limitItem.id, effectType: 'INCREASE_BY', valueText: '5' }],
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    const final = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(final.rowVersion).toBe(rv + 1);
  });

  it('override: two conflicting approve — one success one fail, one completed row', async () => {
    const req = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      stepUpFresh: true,
    });
    const created = await req.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'cf approve',
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
    const results = await Promise.allSettled([
      appr.approve(
        APPROVER_CLAIMS,
        created.id,
        { expectedRowVersion: submitted.rowVersion },
        'idem-cf-appr-a',
      ),
      appr.approve(
        APPROVER_CLAIMS,
        created.id,
        { expectedRowVersion: submitted.rowVersion },
        'idem-cf-appr-b',
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(
      await prisma.platformCommercialIdempotencyRecord.count({ where: { status: 'completed' } }),
    ).toBe(1);
  });

  it('identity: reactivate vs create Draft Version from ARCHIVED', async () => {
    const svc = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const addon = await svc.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_react_draft',
      translations: tr('Race ReactDraft'),
    });
    const active = await svc.transitionAddOnLifecycle(CREATOR_CLAIMS, addon.id, 'ACTIVE', {
      expectedRowVersion: addon.rowVersion,
      reason: 'activate before archive',
    });
    const archived = await svc.transitionAddOnLifecycle(CREATOR_CLAIMS, addon.id, 'ARCHIVED', {
      expectedRowVersion: active.rowVersion,
      reason: 'archive before reactivate/draft race',
    });
    const rv = archived.rowVersion;
    const results = await Promise.allSettled([
      svc.transitionAddOnLifecycle(CREATOR_CLAIMS, addon.id, 'ACTIVE', {
        expectedRowVersion: rv,
        reason: 'reactivate vs draft',
      }),
      svc.createDraftVersion(CREATOR_CLAIMS, addon.id, { translations: vtr('rd') }),
    ]);
    // Reactivate uses identity OCC; createDraft does not — typically both succeed.
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBeGreaterThanOrEqual(1);
    if (results[0]!.status === 'rejected' && results[1]!.status === 'rejected') {
      throw new Error(
        `both ops failed: ${String((results[0] as PromiseRejectedResult).reason)} | ${String(
          (results[1] as PromiseRejectedResult).reason,
        )}`,
      );
    }
    const final = await prisma.platformAddOn.findUniqueOrThrow({ where: { id: addon.id } });
    if (results[0]!.status === 'fulfilled') {
      expect(final.lifecycle).toBe('ACTIVE');
    }
  });

  it('version: two conflicting limit-effects — one OCC winner', async () => {
    const limitItem = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { kind: 'LIMIT' },
    });
    const svc = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const addon = await svc.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_cf_lim',
      translations: tr('Race CfLim'),
    });
    const draft = await svc.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: vtr('cfl'),
    });
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      svc.replaceLimitEffects(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: rv,
        effects: [{ catalogItemId: limitItem.id, effectType: 'INCREASE_BY', valueText: '3' }],
      }),
      svc.replaceLimitEffects(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: rv,
        effects: [{ catalogItemId: limitItem.id, effectType: 'INCREASE_BY', valueText: '9' }],
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expectConflictOrUnique((bad[0] as PromiseRejectedResult).reason);
    const final = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(final.rowVersion).toBe(rv + 1);
  });

  it('version: two conflicting applicability — one OCC winner', async () => {
    const plans = await prisma.platformPlan.findMany({
      take: 2,
      orderBy: { canonicalKey: 'asc' },
    });
    expect(plans.length).toBeGreaterThanOrEqual(2);
    const svc = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const addon = await svc.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_cf_app',
      translations: tr('Race CfApp'),
    });
    const draft = await svc.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: vtr('cfa'),
    });
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      svc.replaceApplicability(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: rv,
        planCanonicalKeys: [plans[0]!.canonicalKey],
      }),
      svc.replaceApplicability(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: rv,
        planCanonicalKeys: [plans[1]!.canonicalKey],
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect((bad[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    const final = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(final.rowVersion).toBe(rv + 1);
  });

  it('version: grants vs applicability concurrent OCC', async () => {
    const plan = await prisma.platformPlan.findFirstOrThrow();
    const svc = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const addon = await svc.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_gr_app',
      translations: tr('Race GrApp'),
    });
    const draft = await svc.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: vtr('ga'),
    });
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      svc.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: rv,
        catalogItemIds: [moduleItem.id],
      }),
      svc.replaceApplicability(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: rv,
        planCanonicalKeys: [plan.canonicalKey],
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect((bad[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    const final = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(final.rowVersion).toBe(rv + 1);
  });

  it('version: limit-effects vs applicability concurrent OCC', async () => {
    const limitItem = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { kind: 'LIMIT' },
    });
    const plan = await prisma.platformPlan.findFirstOrThrow();
    const svc = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const addon = await svc.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_lim_app',
      translations: tr('Race LimApp'),
    });
    const draft = await svc.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: vtr('la'),
    });
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      svc.replaceLimitEffects(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: rv,
        effects: [{ catalogItemId: limitItem.id, effectType: 'INCREASE_BY', valueText: '4' }],
      }),
      svc.replaceApplicability(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: rv,
        planCanonicalKeys: [plan.canonicalKey],
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect((bad[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    const final = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(final.rowVersion).toBe(rv + 1);
  });

  it('version: limit-effects vs publish — one OCC winner', async () => {
    const limitItem = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { kind: 'LIMIT' },
    });
    const svc = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const addon = await svc.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_lim_pub',
      translations: tr('Race LimPub'),
    });
    const draft = await svc.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: vtr('lp'),
    });
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      svc.replaceLimitEffects(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: rv,
        effects: [{ catalogItemId: limitItem.id, effectType: 'INCREASE_BY', valueText: '7' }],
      }),
      svc.publishVersion(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: rv,
        reason: 'publish vs limits',
      }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const bad = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    const final = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(final.rowVersion).toBe(rv + 1);
  });

  it('version: applicability vs publish — one OCC winner', async () => {
    const plan = await prisma.platformPlan.findFirstOrThrow();
    const svc = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const addon = await svc.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_app_pub',
      translations: tr('Race AppPub'),
    });
    const draft = await svc.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: vtr('ap'),
    });
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      svc.replaceApplicability(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: rv,
        planCanonicalKeys: [plan.canonicalKey],
      }),
      svc.publishVersion(CREATOR_CLAIMS, addon.id, draft.id, {
        expectedRowVersion: rv,
        reason: 'publish vs applicability',
      }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const bad = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    const final = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    expect(final.rowVersion).toBe(rv + 1);
  });

  it('version: clone vs create Draft Version on published source — one open draft', async () => {
    const svc = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const addon = await svc.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_clone_draft',
      translations: tr('Race CloneDraft'),
    });
    const draft = await svc.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: vtr('cl'),
    });
    await svc.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: draft.rowVersion,
      catalogItemIds: [moduleItem.id],
    });
    const ver = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    const published = await svc.publishVersion(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: ver.rowVersion,
      reason: 'seed publish for clone/createDraft race',
    });
    const results = await Promise.allSettled([
      svc.cloneVersion(CREATOR_CLAIMS, addon.id, published.id, {}),
      svc.createDraftVersion(CREATOR_CLAIMS, addon.id, { translations: vtr('cd2') }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expectConflictOrUnique((bad[0] as PromiseRejectedResult).reason);
    expect(
      await prisma.platformAddOnVersion.count({
        where: { addOnId: addon.id, lifecycle: 'DRAFT' },
      }),
    ).toBe(1);
  });

  it('version: two equivalent retire share one RETIRED + one completed row', async () => {
    const audit = new FakeAddonAuditLog();
    const svc = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true, audit });
    const addon = await svc.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_eq_ret',
      translations: tr('Race EqRet'),
    });
    const draft = await svc.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: vtr('eqr'),
    });
    await svc.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: draft.rowVersion,
      catalogItemIds: [moduleItem.id],
    });
    const ver = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    const published = await svc.publishVersion(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: ver.rowVersion,
      reason: 'seed publish for eq retire',
    });
    const key = 'idem-eq-retire';
    const body = { expectedRowVersion: published.rowVersion, reason: 'eq retire' };
    const [a, b] = await Promise.all([
      svc.retireVersion(CREATOR_CLAIMS, addon.id, published.id, body, key),
      svc.retireVersion(CREATOR_CLAIMS, addon.id, published.id, body, key),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.lifecycle).toBe('RETIRED');
    expect(
      await prisma.platformCommercialIdempotencyRecord.count({
        where: { idempotencyKey: key, status: 'completed' },
      }),
    ).toBe(1);
    expect(audit.records.filter((r) => r.action === 'platform_addon_version.retired').length).toBe(
      1,
    );
  });

  it('version: two conflicting retire — one success, one 409, no second completed', async () => {
    const svcA = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const svcB = createAddonsService({ prisma, permissions: ALL, stepUpFresh: true });
    const addon = await svcA.createAddOn(CREATOR_CLAIMS, {
      canonicalKey: 'addon.race_cf_ret',
      translations: tr('Race CfRet'),
    });
    const draft = await svcA.createDraftVersion(CREATOR_CLAIMS, addon.id, {
      translations: vtr('cfr'),
    });
    await svcA.replaceEntitlements(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: draft.rowVersion,
      catalogItemIds: [moduleItem.id],
    });
    const ver = await prisma.platformAddOnVersion.findUniqueOrThrow({ where: { id: draft.id } });
    const published = await svcA.publishVersion(CREATOR_CLAIMS, addon.id, draft.id, {
      expectedRowVersion: ver.rowVersion,
      reason: 'seed publish for cf retire',
    });
    const results = await Promise.allSettled([
      svcA.retireVersion(
        CREATOR_CLAIMS,
        addon.id,
        published.id,
        { expectedRowVersion: published.rowVersion, reason: 'retire A' },
        'idem-cf-ret-a',
      ),
      svcB.retireVersion(
        CREATOR_CLAIMS,
        addon.id,
        published.id,
        { expectedRowVersion: published.rowVersion, reason: 'retire B' },
        'idem-cf-ret-b',
      ),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const bad = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    expect(
      await prisma.platformCommercialIdempotencyRecord.count({
        where: {
          status: 'completed',
          idempotencyKey: { in: ['idem-cf-ret-a', 'idem-cf-ret-b'] },
        },
      }),
    ).toBe(1);
    const final = await prisma.platformAddOnVersion.findUniqueOrThrow({
      where: { id: published.id },
    });
    expect(final.lifecycle).toBe('RETIRED');
  });

  it('override: revoke vs supersede on APPROVED', async () => {
    const req = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      stepUpFresh: true,
    });
    const created = await req.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'revoke vs supersede',
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
    const results = await Promise.allSettled([
      appr.revoke(APPROVER_CLAIMS, created.id, {
        expectedRowVersion: approved.rowVersion,
        reason: 'revoke vs supersede',
      }),
      req.supersede(CREATOR_CLAIMS, created.id, {
        reasonCode: 'CONTRACTUAL_EXCEPTION',
        reasonNote: 'supersede vs revoke successor',
        effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: featureItem.id }],
      }),
    ]);
    // Revoke mutates predecessor; supersede creates successor — typically both succeed.
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBeGreaterThanOrEqual(1);
    if (results[0]!.status === 'rejected' && results[1]!.status === 'rejected') {
      throw new Error(
        `both ops failed: ${String((results[0] as PromiseRejectedResult).reason)} | ${String(
          (results[1] as PromiseRejectedResult).reason,
        )}`,
      );
    }
    const final = await prisma.platformCommercialOverride.findUniqueOrThrow({
      where: { id: created.id },
    });
    if (results[0]!.status === 'fulfilled') {
      expect(final.lifecycle).toBe('REVOKED');
    } else {
      expect(final.lifecycle).toBe('APPROVED');
    }
    if (results[1]!.status === 'fulfilled') {
      expect(
        await prisma.platformCommercialOverride.count({
          where: { predecessorId: created.id },
        }),
      ).toBe(1);
    }
  });

  it('override: two equivalent revoke share one REVOKED + one completed row', async () => {
    const req = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      stepUpFresh: true,
    });
    const created = await req.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'eq revoke',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
    });
    const submitted = await req.submit(CREATOR_CLAIMS, created.id, {
      expectedRowVersion: created.rowVersion,
    });
    const audit = new FakeAddonAuditLog();
    const appr = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.approve'],
      stepUpFresh: true,
      audit,
    });
    const approved = await appr.approve(APPROVER_CLAIMS, created.id, {
      expectedRowVersion: submitted.rowVersion,
    });
    const key = 'idem-eq-revoke';
    const body = { expectedRowVersion: approved.rowVersion, reason: 'eq revoke' };
    const [a, b] = await Promise.all([
      appr.revoke(APPROVER_CLAIMS, created.id, body, key),
      appr.revoke(APPROVER_CLAIMS, created.id, body, key),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.lifecycle).toBe('REVOKED');
    expect(
      await prisma.platformCommercialIdempotencyRecord.count({
        where: { idempotencyKey: key, status: 'completed' },
      }),
    ).toBe(1);
    expect(audit.records.filter((r) => r.action === 'platform_override.revoked').length).toBe(1);
  });

  it('override: two conflicting revoke — one success one fail, one completed row', async () => {
    const req = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.request'],
      stepUpFresh: true,
    });
    const created = await req.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'cf revoke',
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
    const results = await Promise.allSettled([
      appr.revoke(
        APPROVER_CLAIMS,
        created.id,
        { expectedRowVersion: approved.rowVersion, reason: 'revoke A' },
        'idem-cf-rev-a',
      ),
      appr.revoke(
        APPROVER_CLAIMS,
        created.id,
        { expectedRowVersion: approved.rowVersion, reason: 'revoke B' },
        'idem-cf-rev-b',
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(
      await prisma.platformCommercialIdempotencyRecord.count({
        where: {
          status: 'completed',
          idempotencyKey: { in: ['idem-cf-rev-a', 'idem-cf-rev-b'] },
        },
      }),
    ).toBe(1);
    const final = await prisma.platformCommercialOverride.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(final.lifecycle).toBe('REVOKED');
  });
});
