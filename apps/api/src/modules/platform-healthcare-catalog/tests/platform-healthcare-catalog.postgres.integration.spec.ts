/**
 * Step 12 healthcare catalog PostgreSQL integration tests.
 */
import { PrismaClient } from '@prisma/client';
import {
  cleanupHealthcareCatalogTables,
  createCatalogPrismaWrapper,
  createCatalogService,
  createPlatformDbSecurityClient,
  createSeedService,
  platformDbSecurityEnabled,
} from './platform-healthcare-catalog-db.harness';
import { AuditTrailHealthcareCatalogAuditLog } from '../infrastructure/audit-trail-healthcare-catalog-audit-log';
import { FakeCatalogAuditLog } from './support/fake-catalog-audit-log';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  evaluateCompatibilitySelection,
} from '../domain/compatibility.evaluator';
import { buildCatalogDriftReport } from '../application/catalog-drift.detector';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { PrismaService } from '../../../infrastructure/prisma.service';

const run = platformDbSecurityEnabled();
const ACTOR = '00000000-0000-4000-8000-000000000077';
const CLAIMS = { sub: ACTOR, sessionId: '11111111-1111-4111-8111-111111111111' } as JwtClaimsVO;
const ALL_MANAGE = [
  'facility-type.view',
  'facility-type.manage',
  'specialty.view',
  'specialty.manage',
  'module.view',
  'module.manage',
  'feature.view',
  'feature.manage',
  'limit.view',
  'limit.manage',
  'compatibility-rule.view',
  'compatibility-rule.manage',
];

describe('platform healthcare catalog (postgres)', () => {
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
    await cleanupHealthcareCatalogTables(prisma);
  });

  (run ? it : it.skip)('seeds idempotently and enforces unique canonical keys', async () => {
    const service = createCatalogService({ prisma, permissions: ALL_MANAGE });
    const seed = createSeedService(prisma);
    const first = await seed.seedAll();
    const second = await seed.seedAll();
    expect(first.items).toBe(second.items);
    expect(first.persisted.items).toBe(second.persisted.items);
    expect(first.persisted.translations).toBe(second.persisted.translations);
    expect(await prisma.healthcareCatalogItem.count()).toBe(first.items);

    await expect(
      service.createItem(CLAIMS, {
        kind: 'FACILITY_TYPE',
        canonicalKey: 'facility_type.general_clinic',
        translations: [
          { locale: 'en-US', displayName: 'Dup', shortDescription: 'Dup' },
          { locale: 'ar-SY', displayName: 'مكرر', shortDescription: 'مكرر' },
        ],
      }),
    ).rejects.toThrow(/already exists/i);
  });

  (run ? it : it.skip)('preserves administrator-edited translations on re-seed', async () => {
    const seed = createSeedService(prisma);
    await seed.seedAll();
    const item = await prisma.healthcareCatalogItem.findUniqueOrThrow({
      where: { canonicalKey: 'facility_type.general_clinic' },
      include: { translations: true },
    });
    const en = item.translations.find((t) => t.locale === 'en-US')!;
    await prisma.$executeRawUnsafe(
      `UPDATE "healthcare_catalog_translations" SET "displayName" = 'Admin Edited Clinic', "updatedAt" = NOW() + interval '1 second' WHERE id = '${en.id}'::uuid`,
    );
    await seed.seedAll();
    const after = await prisma.healthcareCatalogTranslation.findUniqueOrThrow({
      where: { id: en.id },
    });
    expect(after.displayName).toBe('Admin Edited Clinic');
  });

  (run ? it : it.skip)('optimistic concurrency rejects stale updates and lifecycle transitions', async () => {
    const service = createCatalogService({ prisma, permissions: ALL_MANAGE, stepUpFresh: true });
    const seed = createSeedService(prisma);
    await seed.seedAll();
    const item = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { canonicalKey: 'module.dashboard' },
    });

    await service.updateItem(CLAIMS, item.id, {
      expectedVersion: item.version,
      sortOrder: 999,
    });

    await expect(
      service.updateItem(CLAIMS, item.id, {
        expectedVersion: item.version,
        sortOrder: 1,
      }),
    ).rejects.toThrow(/Stale version/i);

    const fresh = await prisma.healthcareCatalogItem.findUniqueOrThrow({ where: { id: item.id } });
    await service.transitionLifecycle(CLAIMS, item.id, 'DEPRECATED', {
      expectedVersion: fresh.version,
      reason: 'Deprecating for test',
    });
    await expect(
      service.transitionLifecycle(CLAIMS, item.id, 'RETIRED', {
        expectedVersion: fresh.version,
        reason: 'stale retire',
      }),
    ).rejects.toThrow(/Stale version/i);
  });

  (run ? it : it.skip)('rejects lifecycle without fresh step-up', async () => {
    const service = createCatalogService({ prisma, permissions: ALL_MANAGE, stepUpFresh: false });
    const seed = createSeedService(prisma);
    await seed.seedAll();
    const item = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { kind: 'MODULE', lifecycle: 'ACTIVE' },
    });
    await expect(
      service.transitionLifecycle(CLAIMS, item.id, 'DEPRECATED', {
        expectedVersion: item.version,
        reason: 'no step-up',
      }),
    ).rejects.toThrow(/Step-up verification is required/i);
    const after = await prisma.healthcareCatalogItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.lifecycle).toBe('ACTIVE');
    expect(after.version).toBe(item.version);
  });

  (run ? it : it.skip)('enforces exact kind-specific manage isolation', async () => {
    const facilityOnly = createCatalogService({
      prisma,
      permissions: ['facility-type.view', 'facility-type.manage'],
      stepUpFresh: true,
    });
    const seed = createSeedService(prisma);
    await seed.seedAll();
    const specialty = await prisma.healthcareCatalogItem.findFirstOrThrow({
      where: { kind: 'SPECIALTY' },
    });
    await expect(
      facilityOnly.updateItem(CLAIMS, specialty.id, {
        expectedVersion: specialty.version,
        sortOrder: 1,
      }),
    ).rejects.toThrow(/specialty\.manage/i);

    await expect(
      facilityOnly.createItem(CLAIMS, {
        kind: 'MODULE',
        canonicalKey: 'module.isolation_probe',
        translations: [
          { locale: 'en-US', displayName: 'x', shortDescription: 'x' },
          { locale: 'ar-SY', displayName: 'س', shortDescription: 'س' },
        ],
      }),
    ).rejects.toThrow(/module\.manage/i);
  });

  (run ? it : it.skip)('durable idempotency replays, conflicts, and rejects bad keys', async () => {
    const service = createCatalogService({
      prisma,
      permissions: ALL_MANAGE,
    });
    const body = {
      kind: 'FEATURE' as const,
      canonicalKey: 'feature.idem_probe',
      translations: [
        { locale: 'en-US', displayName: 'Idem', shortDescription: 'probe' },
        { locale: 'ar-SY', displayName: 'تكرار', shortDescription: 'فحص' },
      ],
    };
    await expect(service.createItem(CLAIMS, body, 'bad key')).rejects.toThrow(
      /Invalid Idempotency-Key/i,
    );
    await expect(service.createItem(CLAIMS, body, 'x'.repeat(129))).rejects.toThrow(
      /Invalid Idempotency-Key/i,
    );

    const first = await service.createItem(CLAIMS, body, 'idem-1');
    const second = await service.createItem(CLAIMS, body, 'idem-1');
    expect(second.id).toBe(first.id);
    expect(
      await prisma.healthcareCatalogItem.count({ where: { canonicalKey: 'feature.idem_probe' } }),
    ).toBe(1);
    expect(await prisma.healthcareCatalogIdempotencyRecord.count()).toBe(1);
    const row = await prisma.healthcareCatalogIdempotencyRecord.findFirstOrThrow();
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain('probe');
    expect(serialized).not.toContain('تكرار');
    expect(serialized).not.toContain(CLAIMS.sessionId);
    expect(serialized).not.toContain('Authorization');

    await expect(
      service.createItem(
        CLAIMS,
        { ...body, canonicalKey: 'feature.idem_probe_other' },
        'idem-1',
      ),
    ).rejects.toThrow(/Idempotency key was reused/i);

    // Different actor may reuse the same key (scoped by actorId).
    const other = {
      sub: '00000000-0000-4000-8000-000000000099',
      sessionId: '33333333-3333-4333-8333-333333333333',
    } as typeof CLAIMS;
    const otherItem = await service.createItem(
      other,
      {
        ...body,
        canonicalKey: 'feature.idem_probe_actor2',
      },
      'idem-1',
    );
    expect(otherItem.id).not.toBe(first.id);
  });

  (run ? it : it.skip)('durable rule idempotency replays and conflicts', async () => {
    const service = createCatalogService({ prisma, permissions: ALL_MANAGE });
    const seed = createSeedService(prisma);
    await seed.seedAll();
    const payload = {
      ruleType: 'INCOMPATIBLE_WITH',
      subjectKey: 'module.dashboard',
      targetKey: 'module.dental',
      explanationEn: 'dashboard vs dental',
      explanationAr: 'لوحة مقابل أسنان',
    };
    const first = await service.createRule(CLAIMS, payload, 'rule-idem-1');
    const second = await service.createRule(CLAIMS, payload, 'rule-idem-1');
    expect(second.id).toBe(first.id);
    await expect(
      service.createRule(
        CLAIMS,
        { ...payload, explanationEn: 'different explanation' },
        'rule-idem-1',
      ),
    ).rejects.toThrow(/Idempotency key was reused/i);
  });

  (run ? it : it.skip)('persists durable audit rows with redacted metadata allowlist', async () => {
    const wrapper = createCatalogPrismaWrapper(prisma);
    const prismaService = {
      withPlatformBypass: wrapper.withPlatformBypass,
    } as unknown as PrismaService;
    const durableAudit = new AuditTrailHealthcareCatalogAuditLog(prismaService);
    const service = createCatalogService({
      prisma,
      permissions: ALL_MANAGE,
      audit: durableAudit,
      stepUpFresh: true,
    });

    const SENTINEL_TRANSLATION = 'REDACT_TRANSLATION_SENTINEL_ZZ';
    const SENTINEL_TOKEN = 'REDACT_TOKEN_SENTINEL_ZZ';
    const SENTINEL_PHI = 'REDACT_PHI_PATIENT_SENTINEL_ZZ';

    const created = await service.createItem(CLAIMS, {
      kind: 'SPECIALTY',
      canonicalKey: 'specialty.audit_probe',
      translations: [
        {
          locale: 'en-US',
          displayName: SENTINEL_TRANSLATION,
          shortDescription: SENTINEL_PHI,
        },
        { locale: 'ar-SY', displayName: 'تدقيق', shortDescription: 'فحص' },
      ],
    });

    await service.transitionLifecycle(CLAIMS, created.id, 'ACTIVE', {
      expectedVersion: created.version,
      reason: 'activate for audit evidence',
    });

    const rows = await prisma.auditEntry.findMany({
      where: {
        tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
        resourceType: 'healthcare_catalog',
        resourceId: created.id,
        action: { startsWith: 'healthcare_catalog.' },
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain(SENTINEL_TRANSLATION);
    expect(serialized).not.toContain(SENTINEL_TOKEN);
    expect(serialized).not.toContain(SENTINEL_PHI);
    expect(serialized).not.toContain(CLAIMS.sessionId);
    expect(serialized.toLowerCase()).not.toContain('authorization');
    const createRow = rows.find((r) => r.action === 'healthcare_catalog.item.created');
    expect(createRow?.actorId).toBe(ACTOR);
    expect(createRow?.resourceId).toBe(created.id);
    const details = createRow?.details as Record<string, string>;
    expect(details.canonicalKey).toBe('specialty.audit_probe');
    expect(details.kind).toBe('SPECIALTY');
  });

  (run ? it : it.skip)('alias add is unique and audited; retire increments version', async () => {
    const audit = new FakeCatalogAuditLog();
    const service = createCatalogService({
      prisma,
      permissions: ALL_MANAGE,
      audit,
      stepUpFresh: true,
    });
    const created = await service.createItem(CLAIMS, {
      kind: 'MODULE',
      canonicalKey: 'module.alias_probe',
      translations: [
        { locale: 'en-US', displayName: 'Alias', shortDescription: 'probe' },
        { locale: 'ar-SY', displayName: 'اسم', shortDescription: 'فحص' },
      ],
    });
    const withAlias = await service.addAlias(CLAIMS, created.id, {
      aliasValue: 'alias_probe_v1',
      sourceNamespace: 'test_ns',
      expectedVersion: created.version,
    });
    expect(withAlias.aliases).toHaveLength(1);
    await expect(
      service.addAlias(CLAIMS, created.id, {
        aliasValue: 'alias_probe_v1',
        sourceNamespace: 'test_ns',
        expectedVersion: withAlias.version,
      }),
    ).rejects.toThrow(/Alias already exists/i);

    const retired = await service.retireAlias(CLAIMS, created.id, withAlias.aliases[0]!.id, {
      expectedVersion: withAlias.version,
      reason: 'retire alias probe',
    });
    expect(retired.aliases[0]!.lifecycle).toBe('RETIRED');
    expect(audit.records.some((r) => r.action === 'healthcare_catalog.alias.added')).toBe(true);
    expect(audit.records.some((r) => r.action === 'healthcare_catalog.alias.retired')).toBe(true);
  });

  (run ? it : it.skip)('evaluates dental and laboratory healthcare scenarios from seeded rules', async () => {
    const seed = createSeedService(prisma);
    await seed.seedAll();

    const items = await prisma.healthcareCatalogItem.findMany();
    const rules = await prisma.healthcareCatalogCompatibilityRule.findMany({
      include: { subject: true, target: true },
    });

    const catalog = items.map((i) => ({
      canonicalKey: i.canonicalKey,
      kind: i.kind,
      lifecycle: i.lifecycle as 'ACTIVE',
    }));
    const evalRules = rules.map((r) => ({
      id: r.id,
      ruleType: r.ruleType as never,
      subjectKey: r.subject.canonicalKey,
      targetKey: r.target.canonicalKey,
      anyOfGroupKey: r.anyOfGroupKey,
      lifecycle: r.lifecycle as 'ACTIVE',
    }));

    const dentalOk = evaluateCompatibilitySelection(
      {
        facilityTypeKey: 'facility_type.dental_clinic',
        moduleKeys: ['module.dental'],
        specialtyKeys: ['specialty.dentistry'],
      },
      catalog,
      evalRules,
    );
    expect(dentalOk.valid).toBe(true);

    const labBad = evaluateCompatibilitySelection(
      {
        facilityTypeKey: 'facility_type.laboratory',
        moduleKeys: ['module.dental'],
        specialtyKeys: ['specialty.dentistry'],
      },
      catalog,
      evalRules,
    );
    expect(labBad.valid).toBe(false);

    expect(items.some((i) => i.canonicalKey === 'facility_type.laboratory')).toBe(true);
    expect(items.some((i) => i.canonicalKey === 'facility_type.radiology_center')).toBe(true);
    expect(items.some((i) => i.canonicalKey === 'module.laboratory')).toBe(false);
    expect(items.some((i) => i.canonicalKey === 'module.radiology')).toBe(false);
  });

  (run ? it : it.skip)('drift report is clean after seed and does not mutate rows', async () => {
    const seed = createSeedService(prisma);
    await seed.seedAll();
    const before = await prisma.healthcareCatalogItem.count();
    const items = await prisma.healthcareCatalogItem.findMany({
      include: { translations: true, aliases: true },
    });
    const report = buildCatalogDriftReport(
      items.map((i) => ({
        canonicalKey: i.canonicalKey,
        kind: i.kind,
        lifecycle: i.lifecycle,
        locales: i.translations.map((t) => t.locale),
      })),
      items.flatMap((i) =>
        i.aliases.map((a) => ({
          canonicalKey: i.canonicalKey,
          kind: i.kind,
          aliasValue: a.aliasValue,
          sourceNamespace: a.sourceNamespace,
          lifecycle: a.lifecycle,
        })),
      ),
    );
    expect(report.summary.errors).toBe(0);
    expect(await prisma.healthcareCatalogItem.count()).toBe(before);
  });

  (run ? it : it.skip)('rejects self-reference and dependency cycles on rule create', async () => {
    const service = createCatalogService({ prisma, permissions: ALL_MANAGE });
    const seed = createSeedService(prisma);
    await seed.seedAll();

    await expect(
      service.createRule(CLAIMS, {
        ruleType: 'REQUIRES',
        subjectKey: 'module.dental',
        targetKey: 'module.dental',
        explanationEn: 'self',
        explanationAr: 'ذاتي',
      }),
    ).rejects.toThrow(/Self-reference/i);

    await service.createRule(CLAIMS, {
      ruleType: 'REQUIRES',
      subjectKey: 'module.dental',
      targetKey: 'module.emr',
      explanationEn: 'dental requires emr',
      explanationAr: 'الأسنان تتطلب السجل',
    });
    await service.createRule(CLAIMS, {
      ruleType: 'REQUIRES',
      subjectKey: 'module.emr',
      targetKey: 'module.patients',
      explanationEn: 'emr requires patients',
      explanationAr: 'السجل يتطلب المرضى',
    });
    await expect(
      service.createRule(CLAIMS, {
        ruleType: 'REQUIRES',
        subjectKey: 'module.patients',
        targetKey: 'module.dental',
        explanationEn: 'cycle',
        explanationAr: 'دورة',
      }),
    ).rejects.toThrow(/cycle/i);
  });

  (run ? it : it.skip)('validate-selection is read-only and does not grant entitlement', async () => {
    const service = createCatalogService({ prisma, permissions: ALL_MANAGE });
    const seed = createSeedService(prisma);
    await seed.seedAll();
    const before = await prisma.healthcareCatalogItem.count();
    const result = await service.validateSelection(CLAIMS, {
      facilityTypeKey: 'facility_type.general_clinic',
      moduleKeys: ['module.dashboard'],
    });
    expect(result.disclaimer.notEntitlementDecision).toBe(true);
    expect(result.disclaimer.notProvisioningDecision).toBe(true);
    expect(await prisma.healthcareCatalogItem.count()).toBe(before);
  });

  (run ? it : it.skip)('concurrent identical canonical key creates exactly one row', async () => {
    const service = createCatalogService({ prisma, permissions: ALL_MANAGE });
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        service.createItem(CLAIMS, {
          kind: 'SPECIALTY',
          canonicalKey: 'specialty.concurrent_probe',
          sortOrder: i,
          translations: [
            { locale: 'en-US', displayName: 'Concurrent', shortDescription: 'probe' },
            { locale: 'ar-SY', displayName: 'متزامن', shortDescription: 'فحص' },
          ],
        }),
      ),
    );
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(4);
    expect(
      await prisma.healthcareCatalogItem.count({
        where: { canonicalKey: 'specialty.concurrent_probe' },
      }),
    ).toBe(1);
    expect(
      await prisma.healthcareCatalogTranslation.count({
        where: { item: { canonicalKey: 'specialty.concurrent_probe' } },
      }),
    ).toBe(2);
  });

  (run ? it : it.skip)('concurrent lifecycle transitions produce one winner', async () => {
    const service = createCatalogService({
      prisma,
      permissions: ALL_MANAGE,
      stepUpFresh: true,
    });
    const created = await service.createItem(CLAIMS, {
      kind: 'FEATURE',
      canonicalKey: 'feature.lifecycle_race',
      translations: [
        { locale: 'en-US', displayName: 'Race', shortDescription: 'probe' },
        { locale: 'ar-SY', displayName: 'سباق', shortDescription: 'فحص' },
      ],
    });
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        service.transitionLifecycle(CLAIMS, created.id, 'ACTIVE', {
          expectedVersion: created.version,
          reason: 'concurrent activate',
        }),
      ),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(3);
    const after = await prisma.healthcareCatalogItem.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(after.lifecycle).toBe('ACTIVE');
    expect(after.version).toBe(created.version + 1);
  });
});
