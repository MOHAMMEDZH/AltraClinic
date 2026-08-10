/**
 * Step 15 persisted audit + serialized redaction matrix (PostgreSQL Source of Record).
 */
import type { PrismaClient } from '@prisma/client';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';
import { AuditTrailPlatformAddonsAuditLog } from '../infrastructure/audit-trail-platform-addons-audit-log';
import { assertAddonAuditSerializedClean } from '../application/addon-audit-redaction';
import {
  cleanupPlatformAddonsTables,
  createAddonsPrismaWrapper,
  createAddonsService,
  createOverridesService,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from './platform-addons-db.harness';

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

const PROHIBITED = [
  'translations',
  'displayName',
  'shortDescription',
  'releaseLabel',
  'reasonNote',
  'Idempotency-Key',
  'Bearer',
  'password',
  'accessToken',
  'refreshToken',
  'sessionId',
  'mfa',
  'catalogItemIds',
  'planCanonicalKeys',
  'requestBody',
  'stack',
  'SELECT ',
];

function tr(name: string) {
  return [
    { locale: 'en-US', displayName: name, shortDescription: `${name}-secret-desc` },
    { locale: 'ar-SY', displayName: name, shortDescription: `${name}-وصف-سري` },
  ];
}
function vtr(label: string) {
  return [
    { locale: 'en-US', releaseLabel: label, shortDescription: `${label}-secret` },
    { locale: 'ar-SY', releaseLabel: `${label}-ar`, shortDescription: `${label}-سري` },
  ];
}

function durableAudit(prisma: PrismaClient) {
  const wrapper = createAddonsPrismaWrapper(prisma);
  return new AuditTrailPlatformAddonsAuditLog({
    withPlatformBypass: wrapper.withPlatformBypass,
  } as unknown as PrismaService);
}

async function assertCleanAudit(prisma: PrismaClient, action: string, resourceId: string) {
  const rows = await prisma.auditEntry.findMany({ where: { action, resourceId } });
  expect(rows.length).toBeGreaterThanOrEqual(1);
  const latest = rows[rows.length - 1];
  const serialized = JSON.stringify(latest.details ?? {});
  for (const p of PROHIBITED) {
    expect(serialized.toLowerCase()).not.toContain(p.toLowerCase());
  }
  expect(serialized).not.toContain('secret');
  expect(serialized).not.toContain('سري');
  assertAddonAuditSerializedClean(serialized);
  return latest;
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

describeDb('Step 15 audit persistence + serialized redaction matrix', () => {
  let prisma: PrismaClient;
  let moduleItem: { id: string };
  let limitItem: { id: string };

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient(DEFAULT_PLATFORM_DB_SECURITY_URL);
    await prisma.$connect();
    await ensureCatalogAndPlans(prisma);
    moduleItem = await prisma.healthcareCatalogItem.findUniqueOrThrow({
      where: { canonicalKey: 'module.dashboard' },
    });
    limitItem = await prisma.healthcareCatalogItem.findFirstOrThrow({ where: { kind: 'LIMIT' } });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    await cleanupPlatformAddonsTables(prisma);
  });

  it('covers identity, version, and override event families with clean serialized details', async () => {
    const audit = durableAudit(prisma);
    const addons = createAddonsService({
      prisma,
      permissions: ALL,
      stepUpFresh: true,
      audit,
    });
    const overrides = createOverridesService({
      prisma,
      permissions: ALL,
      stepUpFresh: true,
      audit,
    });

    const created = await addons.createAddOn(
      CREATOR_CLAIMS,
      { canonicalKey: 'addon.audit_matrix', translations: tr('Audit Matrix') },
      'idem-audit-create',
    );
    await assertCleanAudit(prisma, 'platform_addon.created', created.id);

    const updated = await addons.updateAddOn(
      CREATOR_CLAIMS,
      created.id,
      { expectedRowVersion: created.rowVersion, translations: tr('Audit Updated') },
      'idem-audit-update',
    );
    await assertCleanAudit(prisma, 'platform_addon.updated', created.id);

    const activated = await addons.transitionAddOnLifecycle(
      CREATOR_CLAIMS,
      created.id,
      'ACTIVE',
      { expectedRowVersion: updated.rowVersion, reason: 'activate for audit' },
      'idem-audit-act',
    );
    await assertCleanAudit(prisma, 'platform_addon.activated', created.id);

    const archived = await addons.transitionAddOnLifecycle(
      CREATOR_CLAIMS,
      created.id,
      'ARCHIVED',
      { expectedRowVersion: activated.rowVersion, reason: 'archive for audit' },
      'idem-audit-arch',
    );
    await assertCleanAudit(prisma, 'platform_addon.archived', created.id);

    const reactivated = await addons.transitionAddOnLifecycle(
      CREATOR_CLAIMS,
      created.id,
      'ACTIVE',
      { expectedRowVersion: archived.rowVersion, reason: 'reactivate for audit' },
      'idem-audit-react',
    );
    await assertCleanAudit(prisma, 'platform_addon.reactivated', created.id);

    const draft = await addons.createDraftVersion(
      CREATOR_CLAIMS,
      created.id,
      { translations: vtr('am') },
      'idem-audit-draft',
    );
    await assertCleanAudit(prisma, 'platform_addon_version.created', draft.id);

    let ver = draft;
    ver = await addons.replaceEntitlements(
      CREATOR_CLAIMS,
      created.id,
      draft.id,
      { expectedRowVersion: ver.rowVersion, catalogItemIds: [moduleItem.id] },
      'idem-audit-ent',
    );
    await assertCleanAudit(prisma, 'platform_addon_version.entitlements_replaced', draft.id);

    ver = await addons.replaceLimitEffects(
      CREATOR_CLAIMS,
      created.id,
      draft.id,
      {
        expectedRowVersion: ver.rowVersion,
        effects: [{ catalogItemId: limitItem.id, effectType: 'INCREASE_BY', valueText: '3' }],
      },
      'idem-audit-lim',
    );
    await assertCleanAudit(prisma, 'platform_addon_version.limit_effects_replaced', draft.id);

    const plan = await prisma.platformPlan.findFirstOrThrow();
    ver = await addons.replaceApplicability(
      CREATOR_CLAIMS,
      created.id,
      draft.id,
      { expectedRowVersion: ver.rowVersion, planCanonicalKeys: [plan.canonicalKey] },
      'idem-audit-app',
    );
    await assertCleanAudit(prisma, 'platform_addon_version.applicability_replaced', draft.id);

    const published = await addons.publishVersion(
      CREATOR_CLAIMS,
      created.id,
      draft.id,
      { expectedRowVersion: ver.rowVersion, reason: 'publish for audit' },
      'idem-audit-pub',
    );
    const pubAudit = await assertCleanAudit(prisma, 'platform_addon_version.published', draft.id);
    expect(JSON.stringify(pubAudit.details)).toContain('fingerprint');

    const cloned = await addons.cloneVersion(
      CREATOR_CLAIMS,
      created.id,
      draft.id,
      {},
      'idem-audit-clone',
    );
    await assertCleanAudit(prisma, 'platform_addon_version.cloned', cloned.id);

    await addons.retireVersion(
      CREATOR_CLAIMS,
      created.id,
      draft.id,
      { expectedRowVersion: published.rowVersion, reason: 'retire for audit' },
      'idem-audit-ret',
    );
    await assertCleanAudit(prisma, 'platform_addon_version.retired', draft.id);

    const ov = await overrides.createOverride(
      CREATOR_CLAIMS,
      {
        reasonCode: 'SALES_CONCESSION',
        reasonNote: 'free-form note must not appear in audit',
        effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
      },
      'idem-audit-ov-create',
    );
    await assertCleanAudit(prisma, 'platform_override.created', ov.id);

    const ovUpd = await overrides.updateDraft(
      CREATOR_CLAIMS,
      ov.id,
      {
        expectedRowVersion: ov.rowVersion,
        reasonNote: 'updated free-form note secret',
        effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
      },
      'idem-audit-ov-upd',
    );
    await assertCleanAudit(prisma, 'platform_override.updated', ov.id);

    const submitted = await overrides.submit(
      CREATOR_CLAIMS,
      ov.id,
      { expectedRowVersion: ovUpd.rowVersion },
      'idem-audit-ov-sub',
    );
    await assertCleanAudit(prisma, 'platform_override.submitted', ov.id);

    const approved = await overrides.approve(
      APPROVER_CLAIMS,
      ov.id,
      { expectedRowVersion: submitted.rowVersion },
      'idem-audit-ov-appr',
    );
    await assertCleanAudit(prisma, 'platform_override.approved', ov.id);

    await overrides.revoke(
      APPROVER_CLAIMS,
      ov.id,
      { expectedRowVersion: approved.rowVersion, reason: 'revoke free-form secret' },
      'idem-audit-ov-rev',
    );
    await assertCleanAudit(prisma, 'platform_override.revoked', ov.id);

    const successor = await overrides.supersede(
      CREATOR_CLAIMS,
      ov.id,
      {
        reasonCode: 'SUPPORT_WAIVER',
        reasonNote: 'supersede free-form note secret',
        effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
      },
      'idem-audit-ov-sup',
    );
    await assertCleanAudit(prisma, 'platform_override.superseded', successor.id);

    const rejectOv = await overrides.createOverride(CREATOR_CLAIMS, {
      reasonCode: 'OTHER',
      reasonNote: 'reject path free-form',
      effects: [{ effectKind: 'ENTITLEMENT_GRANT', catalogItemId: moduleItem.id }],
    });
    const rejectSub = await overrides.submit(CREATOR_CLAIMS, rejectOv.id, {
      expectedRowVersion: rejectOv.rowVersion,
    });
    const rejectAppr = createOverridesService({
      prisma,
      permissions: ['override.view', 'override.approve'],
      stepUpFresh: true,
      audit,
    });
    await rejectAppr.reject(APPROVER_CLAIMS, rejectOv.id, {
      expectedRowVersion: rejectSub.rowVersion,
      reason: 'reject free-form secret',
    });
    await assertCleanAudit(prisma, 'platform_override.rejected', rejectOv.id);

    // Replay must not duplicate created audit
    await addons.createAddOn(
      CREATOR_CLAIMS,
      { canonicalKey: 'addon.audit_matrix', translations: tr('Audit Matrix') },
      'idem-audit-create',
    );
    expect(
      await prisma.auditEntry.count({
        where: { action: 'platform_addon.created', resourceId: created.id },
      }),
    ).toBe(1);
    void reactivated;
  });

  it('redaction strips injected prohibited keys at adapter boundary', async () => {
    const audit = durableAudit(prisma);
    await audit.record({
      tenantId: '00000000-0000-4000-8000-000000000047',
      action: 'platform_addon.created',
      resourceId: '00000000-0000-4000-8000-000000000099',
      actorId: CREATOR,
      actorRoles: ['platform'],
      locale: null,
      descriptionEn: 'test',
      descriptionAr: 'اختبار',
      details: {
        result: 'success',
        canonicalKey: 'addon.x',
        translations: 'SHOULD_NOT_PERSIST',
        reasonNote: 'free form',
        accessToken: 'tok',
        effects: '[{}]',
        password: 'x',
      } as never,
      correlationId: null,
    });
    const row = await prisma.auditEntry.findFirstOrThrow({
      where: {
        action: 'platform_addon.created',
        resourceId: '00000000-0000-4000-8000-000000000099',
      },
      orderBy: { createdAt: 'desc' },
    });
    const serialized = JSON.stringify(row.details);
    expect(serialized).not.toContain('SHOULD_NOT_PERSIST');
    expect(serialized).not.toContain('free form');
    expect(serialized).not.toContain('tok');
    expect(serialized).toContain('addon.x');
    assertAddonAuditSerializedClean(serialized);
  });

  it('serialized redaction covers every distinct Step 15 metadata shape', async () => {
    const audit = durableAudit(prisma);
    const shapes: Array<{ action: string; resourceId: string; allow: Record<string, string> }> = [
      {
        action: 'platform_addon.created',
        resourceId: '00000000-0000-4000-8000-000000000201',
        allow: { result: 'success', canonicalKey: 'addon.shape_created' },
      },
      {
        action: 'platform_addon.updated',
        resourceId: '00000000-0000-4000-8000-000000000202',
        allow: {
          result: 'success',
          expectedVersion: '1',
          resultingVersion: '2',
          lifecycle: 'ACTIVE',
        },
      },
      {
        action: 'platform_addon.activated',
        resourceId: '00000000-0000-4000-8000-000000000203',
        allow: {
          result: 'success',
          lifecycleBefore: 'DRAFT',
          lifecycleAfter: 'ACTIVE',
          reasonCode: 'lifecycle_transition',
        },
      },
      {
        action: 'platform_addon_version.entitlements_replaced',
        resourceId: '00000000-0000-4000-8000-000000000204',
        allow: { result: 'success', count: '2' },
      },
      {
        action: 'platform_addon_version.limit_effects_replaced',
        resourceId: '00000000-0000-4000-8000-000000000205',
        allow: { result: 'success', count: '1', effectType: 'INCREASE_BY' },
      },
      {
        action: 'platform_addon_version.applicability_replaced',
        resourceId: '00000000-0000-4000-8000-000000000206',
        allow: { result: 'success', count: '1' },
      },
      {
        action: 'platform_addon_version.published',
        resourceId: '00000000-0000-4000-8000-000000000207',
        allow: {
          result: 'success',
          fingerprint: 'abc',
          runtimeChanged: 'false',
          addOnId: '00000000-0000-4000-8000-000000000210',
        },
      },
      {
        action: 'platform_addon_version.retired',
        resourceId: '00000000-0000-4000-8000-000000000208',
        allow: {
          result: 'success',
          reasonCode: 'retirement',
          lifecycleBefore: 'PUBLISHED',
          lifecycleAfter: 'RETIRED',
        },
      },
      {
        action: 'platform_addon_version.cloned',
        resourceId: '00000000-0000-4000-8000-000000000209',
        allow: {
          result: 'success',
          sourceVersionClassification: 'published_source',
        },
      },
      {
        action: 'platform_override.updated',
        resourceId: '00000000-0000-4000-8000-000000000211',
        allow: { result: 'success', expectedVersion: '1', reasonCode: 'SALES_CONCESSION' },
      },
      {
        action: 'platform_override.submitted',
        resourceId: '00000000-0000-4000-8000-000000000212',
        allow: { result: 'success' },
      },
      {
        action: 'platform_override.approved',
        resourceId: '00000000-0000-4000-8000-000000000213',
        allow: { result: 'success', creatorApproverSeparated: 'true' },
      },
      {
        action: 'platform_override.rejected',
        resourceId: '00000000-0000-4000-8000-000000000214',
        allow: { result: 'success', reasonCode: 'rejection' },
      },
      {
        action: 'platform_override.revoked',
        resourceId: '00000000-0000-4000-8000-000000000215',
        allow: { result: 'success', reasonCode: 'revocation', runtimeChanged: 'false' },
      },
      {
        action: 'platform_override.superseded',
        resourceId: '00000000-0000-4000-8000-000000000216',
        allow: {
          result: 'success',
          predecessorClassification: 'approved_or_revoked_predecessor',
          successorClassification: 'draft_successor',
        },
      },
    ];

    const prohibited = {
      translations: '[{"locale":"en-US","displayName":"Secret"}]',
      displayName: 'SecretName',
      shortDescription: 'SecretDesc',
      releaseLabel: 'SecretLabel',
      reasonNote: 'free-form note secret',
      catalogItemIds: '["a","b"]',
      planCanonicalKeys: '["plan.lite"]',
      effects: '[{"effectKind":"ENTITLEMENT_GRANT"}]',
      requestBody: '{"raw":true}',
      idempotencyKey: 'idem-secret',
      accessToken: 'access-secret',
      refreshToken: 'refresh-secret',
      stepUpToken: 'stepup-secret',
      sessionId: 'session-secret',
      mfaCode: '123456',
      actorEmail: 'actor@example.com',
      tenantContents: 'tenant-secret',
      subscriptionContents: 'sub-secret',
      licensingPayload: 'lic-secret',
      cacheKey: 'cache-secret',
      sql: 'SELECT * FROM secrets',
      prismaError: 'P2002',
      stack: 'Error: stack',
      phi: 'patient-secret',
      auditSentinel: '00000000-0000-4000-8000-000000000047',
    };

    for (const shape of shapes) {
      await audit.record({
        tenantId: '00000000-0000-4000-8000-000000000047',
        action: shape.action,
        resourceId: shape.resourceId,
        actorId: CREATOR,
        actorRoles: ['platform'],
        locale: null,
        descriptionEn: 'shape test',
        descriptionAr: 'اختبار',
        details: { ...shape.allow, ...prohibited } as never,
        correlationId: null,
      });
      const row = await prisma.auditEntry.findFirstOrThrow({
        where: { action: shape.action, resourceId: shape.resourceId },
        orderBy: { createdAt: 'desc' },
      });
      const serialized = JSON.stringify(row.details ?? {});
      for (const [k, v] of Object.entries(prohibited)) {
        expect(serialized).not.toContain(v);
      }
      const detailsObj = (row.details as Record<string, unknown>) ?? {};
      for (const banned of Object.keys(prohibited)) {
        expect(Object.keys(detailsObj)).not.toContain(banned);
      }
      for (const [k, v] of Object.entries(shape.allow)) {
        expect(serialized).toContain(v);
        expect(Object.keys(detailsObj)).toContain(k);
      }
      assertAddonAuditSerializedClean(serialized);
    }
  });
});
