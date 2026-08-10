/**
 * Step 12 final-gate PostgreSQL evidence — seed inventory, durable audit matrix,
 * idempotency recreation/retention, alias/rule concurrency, rollback orphans.
 */
import { PrismaClient } from '@prisma/client';
import {
  ALL_SEED_ITEMS,
  SEED_COMPATIBILITY_RULES,
} from '../domain/catalog-seed.inventory';
import {
  cleanupHealthcareCatalogTables,
  createCatalogPrismaWrapper,
  createCatalogService,
  createPlatformDbSecurityClient,
  createSeedService,
  platformDbSecurityEnabled,
} from './platform-healthcare-catalog-db.harness';
import { AuditTrailHealthcareCatalogAuditLog } from '../infrastructure/audit-trail-healthcare-catalog-audit-log';
import { CatalogIdempotencyService } from '../application/catalog-idempotency.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { buildCatalogDriftReport } from '../application/catalog-drift.detector';

const run = platformDbSecurityEnabled();
const ACTOR = '00000000-0000-4000-8000-000000000077';
const SESSION = '11111111-1111-4111-8111-111111111111';
const CLAIMS = { sub: ACTOR, sessionId: SESSION } as JwtClaimsVO;
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

const EXPECTED_BY_KIND: Record<string, number> = {
  FACILITY_TYPE: 7,
  SPECIALTY: 7,
  MODULE: 21,
  FEATURE: 21,
  LIMIT: 12,
};
const EXPECTED_ITEMS = 68;
const EXPECTED_TRANSLATIONS = 136;
const EXPECTED_ALIASES = 68;
const EXPECTED_RULES = 13;

function durableAudit(prisma: PrismaClient) {
  const wrapper = createCatalogPrismaWrapper(prisma);
  return new AuditTrailHealthcareCatalogAuditLog({
    withPlatformBypass: wrapper.withPlatformBypass,
  } as unknown as PrismaService);
}

describe('platform healthcare catalog final gate (postgres)', () => {
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

  (run ? it : it.skip)('reconciles exact seed inventory and translation counts on clean DB', async () => {
    expect(ALL_SEED_ITEMS.length).toBe(EXPECTED_ITEMS);
    expect(Object.values(EXPECTED_BY_KIND).reduce((a, b) => a + b, 0)).toBe(EXPECTED_ITEMS);

    const seed = createSeedService(prisma);
    const first = await seed.seedAll();
    const second = await seed.seedAll();

    expect(first.items).toBe(EXPECTED_ITEMS);
    expect(second.items).toBe(EXPECTED_ITEMS);
    expect(first.persisted).toEqual(second.persisted);
    expect(first.persisted.items).toBe(EXPECTED_ITEMS);
    expect(first.persisted.translations).toBe(EXPECTED_TRANSLATIONS);
    expect(first.persisted.translationsEnUs).toBe(EXPECTED_ITEMS);
    expect(first.persisted.translationsArSy).toBe(EXPECTED_ITEMS);
    expect(first.persisted.aliases).toBe(EXPECTED_ALIASES);
    expect(first.persisted.byKind).toEqual(EXPECTED_BY_KIND);
    expect(SEED_COMPATIBILITY_RULES.length).toBe(EXPECTED_RULES);
    expect(first.rules).toBe(EXPECTED_RULES);
    expect(first.persisted.rules).toBe(EXPECTED_RULES);

    const aliasDupKeys = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
      `SELECT COUNT(*)::int AS c FROM healthcare_catalog_aliases
       GROUP BY "sourceNamespace", "aliasValue" HAVING COUNT(*) > 1`,
    );
    expect(aliasDupKeys).toEqual([]);
    const keyDups = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
      `SELECT COUNT(*)::int AS c FROM healthcare_catalog_items
       GROUP BY "canonicalKey" HAVING COUNT(*) > 1`,
    );
    expect(keyDups).toEqual([]);

    const missingEn = await prisma.$queryRawUnsafe<Array<{ canonicalKey: string }>>(
      `SELECT i."canonicalKey" FROM healthcare_catalog_items i
       WHERE NOT EXISTS (
         SELECT 1 FROM healthcare_catalog_translations t
         WHERE t."itemId"=i.id AND t.locale='en-US')`,
    );
    const missingAr = await prisma.$queryRawUnsafe<Array<{ canonicalKey: string }>>(
      `SELECT i."canonicalKey" FROM healthcare_catalog_items i
       WHERE NOT EXISTS (
         SELECT 1 FROM healthcare_catalog_translations t
         WHERE t."itemId"=i.id AND t.locale='ar-SY')`,
    );
    const dups = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
      `SELECT COUNT(*)::int AS c FROM healthcare_catalog_translations
       GROUP BY "itemId", locale HAVING COUNT(*) > 1`,
    );
    expect(missingEn).toEqual([]);
    expect(missingAr).toEqual([]);
    expect(dups).toEqual([]);

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
    expect(items.length).toBe(EXPECTED_ITEMS);
  });

  (run ? it : it.skip)('persists durable audit for every applicable mutation family', async () => {
    const audit = durableAudit(prisma);
    const service = createCatalogService({
      prisma,
      permissions: ALL_MANAGE,
      audit,
      stepUpFresh: true,
    });

    const SENTINEL_TRANSLATION = 'REDACT_TRANSLATION_SENTINEL_FINAL';
    const SENTINEL_DESC = 'REDACT_DESCRIPTION_SENTINEL_FINAL';
    const SENTINEL_ALIAS_NOTE = 'REDACT_ALIAS_NOTE_SENTINEL_FINAL';
    const SENTINEL_TOKEN = 'REDACT_TOKEN_SENTINEL_FINAL';

    const created = await service.createItem(CLAIMS, {
      kind: 'LIMIT',
      canonicalKey: 'limit.audit_matrix_probe',
      translations: [
        {
          locale: 'en-US',
          displayName: SENTINEL_TRANSLATION,
          shortDescription: SENTINEL_DESC,
        },
        { locale: 'ar-SY', displayName: 'حد', shortDescription: 'وصف' },
      ],
      limit: {
        valueType: 'COUNT',
        unit: 'count',
        zeroValid: true,
        unlimitedSupported: true,
      },
    });

    const afterEn = await service.updateItem(CLAIMS, created.id, {
      expectedVersion: created.version,
      translations: [
        {
          locale: 'en-US',
          displayName: 'Limit EN',
          shortDescription: 'updated en',
        },
        { locale: 'ar-SY', displayName: 'حد محدث', shortDescription: 'وصف محدث' },
      ],
    });

    const afterLimit = await service.updateItem(CLAIMS, afterEn.id, {
      expectedVersion: afterEn.version,
      limit: {
        valueType: 'INTEGER',
        unit: 'count',
        min: 1,
        max: 100,
        zeroValid: false,
        unlimitedSupported: false,
      },
    });

    const activated = await service.transitionLifecycle(CLAIMS, afterLimit.id, 'ACTIVE', {
      expectedVersion: afterLimit.version,
      reason: 'activate for audit matrix',
    });
    const deprecated = await service.transitionLifecycle(CLAIMS, activated.id, 'DEPRECATED', {
      expectedVersion: activated.version,
      reason: 'deprecate for audit matrix',
    });
    const retired = await service.transitionLifecycle(CLAIMS, deprecated.id, 'RETIRED', {
      expectedVersion: deprecated.version,
      reason: 'retire for audit matrix',
    });
    const reactivated = await service.transitionLifecycle(CLAIMS, retired.id, 'ACTIVE', {
      expectedVersion: retired.version,
      reason: 'reactivate for audit matrix',
    });

    const withAlias = await service.addAlias(CLAIMS, reactivated.id, {
      aliasValue: 'audit_matrix_alias',
      sourceNamespace: 'plan_limits_key',
      reason: SENTINEL_ALIAS_NOTE,
      expectedVersion: reactivated.version,
    });
    const afterAliasRetire = await service.retireAlias(
      CLAIMS,
      reactivated.id,
      withAlias.aliases[0]!.id,
      {
        expectedVersion: withAlias.version,
        reason: 'retire alias for audit matrix',
      },
    );

    await createSeedService(prisma).seedAll();
    const rule = await service.createRule(
      CLAIMS,
      {
        ruleType: 'INCOMPATIBLE_WITH',
        subjectKey: 'module.dashboard',
        targetKey: 'module.loyalty',
        explanationEn: 'dashboard vs loyalty probe',
        explanationAr: 'لوحة مقابل ولاء',
      },
      'rule-audit-1',
    );
    const ruleActive = await service.transitionRuleLifecycle(
      CLAIMS,
      rule.id,
      'ACTIVE',
      rule.version,
      'activate rule for audit',
    );
    await service.transitionRuleLifecycle(
      CLAIMS,
      ruleActive.id,
      'RETIRED',
      ruleActive.version,
      'retire rule for audit',
    );

    // Stale update rejection audit (policy includes rejected stale version).
    await expect(
      service.updateItem(CLAIMS, afterAliasRetire.id, {
        expectedVersion: afterAliasRetire.version - 1,
        sortOrder: 1,
      }),
    ).rejects.toThrow(/Stale version/i);

    const rows = await prisma.auditEntry.findMany({
      where: {
        tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
        resourceType: 'healthcare_catalog',
        action: { startsWith: 'healthcare_catalog.' },
        OR: [
          { resourceId: created.id },
          { resourceId: rule.id },
          {
            action: {
              in: [
                'healthcare_catalog.item.update_rejected',
                'healthcare_catalog.item.create_rejected',
              ],
            },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    const forItem = rows.filter(
      (r) =>
        r.resourceId === created.id ||
        (r.action === 'healthcare_catalog.item.update_rejected' &&
          (r.details as Record<string, string> | null)?.canonicalKey ===
            'limit.audit_matrix_probe'),
    );
    const forRule = rows.filter((r) => r.resourceId === rule.id);
    const actions = [...forItem, ...forRule].map((r) => r.action);
    const required = [
      'healthcare_catalog.item.created',
      'healthcare_catalog.item.updated',
      'healthcare_catalog.item.active',
      'healthcare_catalog.item.deprecated',
      'healthcare_catalog.item.retired',
      'healthcare_catalog.alias.added',
      'healthcare_catalog.alias.retired',
      'healthcare_catalog.rule.created',
      'healthcare_catalog.rule.active',
      'healthcare_catalog.rule.retired',
      'healthcare_catalog.item.update_rejected',
    ];
    for (const action of required) {
      expect(actions.filter((a) => a === action).length).toBeGreaterThanOrEqual(1);
    }

    // Reactivate emits healthcare_catalog.item.active a second time.
    expect(actions.filter((a) => a === 'healthcare_catalog.item.active').length).toBeGreaterThanOrEqual(
      2,
    );

    const scoped = [...forItem, ...forRule];
    const serialized = JSON.stringify(scoped);
    expect(serialized).not.toContain(SENTINEL_TRANSLATION);
    expect(serialized).not.toContain(SENTINEL_DESC);
    expect(serialized).not.toContain(SENTINEL_ALIAS_NOTE);
    expect(serialized).not.toContain(SENTINEL_TOKEN);
    expect(serialized).not.toContain(SESSION);
    expect(serialized.toLowerCase()).not.toContain('authorization');
    expect(serialized.toLowerCase()).not.toContain('bearer');
    expect(serialized).not.toContain('postgresql://');
    expect(scoped.every((r) => r.tenantId === PLATFORM_AUDIT_SENTINEL_TENANT_ID)).toBe(true);
    expect(scoped.every((r) => r.actorId === ACTOR)).toBe(true);

    const createRow = forItem.find((r) => r.action === 'healthcare_catalog.item.created')!;
    expect(createRow.resourceId).toBe(created.id);
    const details = createRow.details as Record<string, string>;
    expect(details.canonicalKey).toBe('limit.audit_matrix_probe');
    expect(details.kind).toBe('LIMIT');
  });

  (run ? it : it.skip)('Model A: audit write failure rolls back Catalog mutation', async () => {
    const failingAudit = {
      record: jest.fn(async () => {
        throw new Error('audit_write_failed');
      }),
      recordInTransaction: jest.fn(async () => {
        throw new Error('audit_write_failed');
      }),
    };
    const service = createCatalogService({
      prisma,
      permissions: ALL_MANAGE,
      audit: failingAudit,
    });
    await expect(
      service.createItem(CLAIMS, {
        kind: 'SPECIALTY',
        canonicalKey: 'specialty.audit_fail_probe',
        translations: [
          { locale: 'en-US', displayName: 'x', shortDescription: 'x' },
          { locale: 'ar-SY', displayName: 'س', shortDescription: 'س' },
        ],
      }),
    ).rejects.toThrow(/audit_write_failed/);
    expect(
      await prisma.healthcareCatalogItem.count({
        where: { canonicalKey: 'specialty.audit_fail_probe' },
      }),
    ).toBe(0);
    expect(failingAudit.recordInTransaction).toHaveBeenCalled();
  });

  (run ? it : it.skip)('idempotency survives service recreation; failed TX leaves no completed record', async () => {
    const body = {
      kind: 'FEATURE' as const,
      canonicalKey: 'feature.idem_recreate_probe',
      translations: [
        { locale: 'en-US', displayName: 'Idem', shortDescription: 'probe' },
        { locale: 'ar-SY', displayName: 'تكرار', shortDescription: 'فحص' },
      ],
    };

    const firstService = createCatalogService({ prisma, permissions: ALL_MANAGE });
    const first = await firstService.createItem(CLAIMS, body, 'recreate-key-1');

    // Reconstruct services (clears any process-local state; durable PG remains).
    const secondService = createCatalogService({ prisma, permissions: ALL_MANAGE });
    const replay = await secondService.createItem(CLAIMS, body, 'recreate-key-1');
    expect(replay.id).toBe(first.id);
    expect(
      await prisma.healthcareCatalogItem.count({
        where: { canonicalKey: 'feature.idem_recreate_probe' },
      }),
    ).toBe(1);

    // Same actor, different operation may reuse the same key.
    await createSeedService(prisma).seedAll();
    const rule = await secondService.createRule(
      CLAIMS,
      {
        ruleType: 'INCOMPATIBLE_WITH',
        subjectKey: 'module.dashboard',
        targetKey: 'module.commission',
        explanationEn: 'op scope probe',
        explanationAr: 'نطاق العملية',
      },
      'recreate-key-1',
    );
    expect(rule.id).toBeTruthy();

    // Failed create (duplicate canonical) with new key leaves no completed idempotency row.
    const beforeFailed = await prisma.healthcareCatalogIdempotencyRecord.count();
    await expect(
      secondService.createItem(CLAIMS, body, 'failed-tx-key-1'),
    ).rejects.toThrow(/already exists/i);
    expect(await prisma.healthcareCatalogIdempotencyRecord.count()).toBe(beforeFailed);
    expect(
      await prisma.healthcareCatalogIdempotencyRecord.count({
        where: { idempotencyKey: 'failed-tx-key-1', status: 'completed' },
      }),
    ).toBe(0);

    // Retention: expired ignored; purge deletes only expired.
    const idem = new CatalogIdempotencyService(createCatalogPrismaWrapper(prisma) as never);
    await prisma.healthcareCatalogIdempotencyRecord.create({
      data: {
        actorId: ACTOR,
        operation: 'catalog.createItem',
        idempotencyKey: 'expired-key-1',
        requestHash: 'abc',
        resultResourceType: 'item',
        resultResourceId: first.id,
        status: 'completed',
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    const unexpiredBefore = await prisma.healthcareCatalogIdempotencyRecord.count({
      where: { expiresAt: { gt: new Date() } },
    });
    const purged = await idem.purgeExpired();
    expect(purged).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.healthcareCatalogIdempotencyRecord.count({
        where: { idempotencyKey: 'expired-key-1' },
      }),
    ).toBe(0);
    expect(
      await prisma.healthcareCatalogIdempotencyRecord.count({
        where: { expiresAt: { gt: new Date() } },
      }),
    ).toBe(unexpiredBefore);
  });

  (run ? it : it.skip)('concurrent alias and rule creates have one winner; stale rule rejected', async () => {
    const service = createCatalogService({
      prisma,
      permissions: ALL_MANAGE,
      stepUpFresh: true,
    });
    const created = await service.createItem(CLAIMS, {
      kind: 'MODULE',
      canonicalKey: 'module.alias_race_probe',
      translations: [
        { locale: 'en-US', displayName: 'AliasRace', shortDescription: 'probe' },
        { locale: 'ar-SY', displayName: 'سباق', shortDescription: 'فحص' },
      ],
    });

    const aliasResults = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        service.addAlias(CLAIMS, created.id, {
          aliasValue: 'alias_race_value',
          sourceNamespace: 'licensed_module_id',
          expectedVersion: created.version,
        }),
      ),
    );
    expect(aliasResults.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(aliasResults.filter((r) => r.status === 'rejected').length).toBe(4);
    expect(
      await prisma.healthcareCatalogAlias.count({
        where: { aliasValue: 'alias_race_value', sourceNamespace: 'licensed_module_id' },
      }),
    ).toBe(1);

    await createSeedService(prisma).seedAll();
    const rulePayload = {
      ruleType: 'INCOMPATIBLE_WITH' as const,
      subjectKey: 'module.dashboard',
      targetKey: 'module.media',
      explanationEn: 'rule race',
      explanationAr: 'سباق قاعدة',
    };
    const ruleResults = await Promise.allSettled(
      Array.from({ length: 5 }, () => service.createRule(CLAIMS, rulePayload)),
    );
    expect(ruleResults.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(ruleResults.filter((r) => r.status === 'rejected').length).toBe(4);
    expect(
      await prisma.healthcareCatalogCompatibilityRule.count({
        where: {
          subject: { canonicalKey: 'module.dashboard' },
          target: { canonicalKey: 'module.media' },
          ruleType: 'INCOMPATIBLE_WITH',
        },
      }),
    ).toBe(1);

    const winner = (ruleResults.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{
      id: string;
      version: number;
    }>).value;
    await service.transitionRuleLifecycle(CLAIMS, winner.id, 'ACTIVE', winner.version, 'activate');
    await expect(
      service.transitionRuleLifecycle(CLAIMS, winner.id, 'RETIRED', winner.version, 'stale retire'),
    ).rejects.toThrow(/Stale version/i);
  });

  (run ? it : it.skip)('update-versus-retire is deterministic; failed create leaves no orphans', async () => {
    const service = createCatalogService({
      prisma,
      permissions: ALL_MANAGE,
      stepUpFresh: true,
    });
    const created = await service.createItem(CLAIMS, {
      kind: 'FEATURE',
      canonicalKey: 'feature.update_vs_retire',
      translations: [
        { locale: 'en-US', displayName: 'Race', shortDescription: 'probe' },
        { locale: 'ar-SY', displayName: 'سباق', shortDescription: 'فحص' },
      ],
    });
    const activated = await service.transitionLifecycle(CLAIMS, created.id, 'ACTIVE', {
      expectedVersion: created.version,
      reason: 'activate before race',
    });

    const race = await Promise.allSettled([
      service.updateItem(CLAIMS, activated.id, {
        expectedVersion: activated.version,
        sortOrder: 42,
      }),
      service.transitionLifecycle(CLAIMS, activated.id, 'DEPRECATED', {
        expectedVersion: activated.version,
        reason: 'retire race',
      }),
    ]);
    expect(race.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(race.filter((r) => r.status === 'rejected')).toHaveLength(1);
    const after = await prisma.healthcareCatalogItem.findUniqueOrThrow({
      where: { id: activated.id },
    });
    expect(after.version).toBe(activated.version + 1);
    // Exactly one of metadata update or lifecycle won.
    expect(
      after.lifecycle === 'DEPRECATED' || (after.lifecycle === 'ACTIVE' && after.sortOrder === 42),
    ).toBe(true);

    // Failed duplicate create leaves no orphan translations/aliases/idempotency.
    const beforeT = await prisma.healthcareCatalogTranslation.count();
    const beforeA = await prisma.healthcareCatalogAlias.count();
    const beforeI = await prisma.healthcareCatalogIdempotencyRecord.count();
    await expect(
      service.createItem(
        CLAIMS,
        {
          kind: 'FEATURE',
          canonicalKey: 'feature.update_vs_retire',
          translations: [
            { locale: 'en-US', displayName: 'orphan', shortDescription: 'should not persist' },
            { locale: 'ar-SY', displayName: 'يتيم', shortDescription: 'لا' },
          ],
        },
        'orphan-idem-key',
      ),
    ).rejects.toThrow(/already exists/i);
    expect(await prisma.healthcareCatalogTranslation.count()).toBe(beforeT);
    expect(await prisma.healthcareCatalogAlias.count()).toBe(beforeA);
    expect(await prisma.healthcareCatalogIdempotencyRecord.count()).toBe(beforeI);
  });

  (run ? it : it.skip)('lifecycle unchanged without fresh step-up; concurrent retire one winner', async () => {
    const fresh = createCatalogService({
      prisma,
      permissions: ALL_MANAGE,
      stepUpFresh: true,
    });
    const stale = createCatalogService({
      prisma,
      permissions: ALL_MANAGE,
      stepUpFresh: false,
    });
    const created = await fresh.createItem(CLAIMS, {
      kind: 'MODULE',
      canonicalKey: 'module.lifecycle_stepup_probe',
      translations: [
        { locale: 'en-US', displayName: 'Step', shortDescription: 'probe' },
        { locale: 'ar-SY', displayName: 'خطوة', shortDescription: 'فحص' },
      ],
    });
    const activated = await fresh.transitionLifecycle(CLAIMS, created.id, 'ACTIVE', {
      expectedVersion: created.version,
      reason: 'activate with step-up',
    });

    await expect(
      stale.transitionLifecycle(CLAIMS, activated.id, 'DEPRECATED', {
        expectedVersion: activated.version,
        reason: 'missing step-up',
      }),
    ).rejects.toThrow(/Step-up verification is required/i);
    const unchanged = await prisma.healthcareCatalogItem.findUniqueOrThrow({
      where: { id: activated.id },
    });
    expect(unchanged.lifecycle).toBe('ACTIVE');
    expect(unchanged.version).toBe(activated.version);

    const deprecated = await fresh.transitionLifecycle(CLAIMS, activated.id, 'DEPRECATED', {
      expectedVersion: activated.version,
      reason: 'deprecate before concurrent retire',
    });
    const retireRace = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        fresh.transitionLifecycle(CLAIMS, deprecated.id, 'RETIRED', {
          expectedVersion: deprecated.version,
          reason: 'concurrent retire',
        }),
      ),
    );
    expect(retireRace.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(retireRace.filter((r) => r.status === 'rejected')).toHaveLength(3);
  });
});
