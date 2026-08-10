#!/usr/bin/env node
/**
 * Clean-path validation for Phase 47 Step 15 Add-ons & Commercial Overrides.
 * Creates isolated booking_test_addons_clean, applies all migrations, seeds Catalog + Plans,
 * runs empty Step 15 seed twice, asserts schema + empty addon/override catalog.
 */
import { spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const cleanDb = 'booking_test_addons_clean';

const EXPECTED_CATALOG_ITEMS = 68;
const EXPECTED_CATALOG_TRANSLATIONS = 136;
const EXPECTED_CATALOG_ALIASES = 68;
const EXPECTED_CATALOG_RULES = 13;

const STEP15_TABLES = [
  'platform_addons',
  'platform_addon_translations',
  'platform_addon_versions',
  'platform_addon_version_translations',
  'platform_addon_version_entitlements',
  'platform_addon_version_limit_effects',
  'platform_addon_version_applicability',
  'platform_commercial_overrides',
  'platform_commercial_override_effects',
  'platform_commercial_idempotency',
];

const REQUIRED_UNIQUE_INDEXES = [
  'platform_addons_canonicalKey_key',
  'platform_addon_translations_addOnId_locale_key',
  'platform_addon_versions_addOnId_versionNumber_key',
  'platform_addon_versions_one_draft_per_addon',
  'platform_addon_version_translations_addOnVersionId_locale_key',
  // PostgreSQL truncates identifiers to 63 bytes — use actual persisted names:
  'platform_addon_version_entitlements_addOnVersionId_catalogItemI',
  'platform_addon_version_limit_effects_addOnVersionId_catalogItem',
  'platform_addon_version_applicability_addOnVersionId_planCanonic',
  'platform_commercial_override_effects_overrideId_catalogItemId_e',
  'platform_commercial_idempotency_actorId_operation_idempotencyKe',
];

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.RUN_PLATFORM_DB_SECURITY = 'true';
process.env.ALLOW_TEST_DATABASE_RESET = 'true';

const adminUrl =
  process.env.INTEGRATION_ADMIN_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/postgres';
const cleanUrl = `postgresql://booking:booking_test@localhost:5433/${cleanDb}?schema=public`;

function run(cmd, args, env = {}) {
  const result = spawnSync(cmd, args, {
    cwd: apiRoot,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: true,
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

async function withAdmin(fn) {
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  try {
    await admin.$connect();
    return await fn(admin);
  } finally {
    await admin.$disconnect();
  }
}

function sqlInList(values) {
  return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
}

async function main() {
  await withAdmin(async (admin) => {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${cleanDb}`);
    await admin.$executeRawUnsafe(`CREATE DATABASE ${cleanDb}`);
  });

  console.log('Clean migrate deploy (full chain including Step 15)...');
  run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: cleanUrl });

  const prisma = new PrismaClient({ datasources: { db: { url: cleanUrl } } });
  await prisma.$connect();
  try {
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

    process.env.DATABASE_URL = cleanUrl;
    run(
      'npx',
      [
        'ts-node',
        '--transpile-only',
        'src/modules/platform-healthcare-catalog/seed/run-healthcare-catalog-seed.ts',
      ],
      { DATABASE_URL: cleanUrl },
    );
    run(
      'npx',
      ['ts-node', '--transpile-only', 'src/modules/platform-plans/seed/run-platform-plans-seed.ts'],
      { DATABASE_URL: cleanUrl },
    );
    run(
      'npx',
      ['ts-node', '--transpile-only', 'src/modules/platform-plans/seed/run-platform-plans-seed.ts'],
      { DATABASE_URL: cleanUrl },
    );

    // Step 15: no invented products — empty catalog seed (idempotent second pass).
    console.log('Step 15 seed: empty catalog (0 addons) — first pass');
    run(
      'npx',
      ['ts-node', '--transpile-only', 'src/modules/platform-addons/seed/run-platform-addons-seed.ts'],
      { DATABASE_URL: cleanUrl },
    );
    console.log('Step 15 seed: empty catalog (0 addons) — second pass (idempotency)');
    run(
      'npx',
      ['ts-node', '--transpile-only', 'src/modules/platform-addons/seed/run-platform-addons-seed.ts'],
      { DATABASE_URL: cleanUrl },
    );

    // ── Catalog 68/136/68/13 ───────────────────────────────────────────────
    const catalogItems = await prisma.healthcareCatalogItem.count();
    const catalogTranslations = await prisma.healthcareCatalogTranslation.count();
    const catalogAliases = await prisma.healthcareCatalogAlias.count();
    const catalogRules = await prisma.healthcareCatalogCompatibilityRule.count();
    if (catalogItems !== EXPECTED_CATALOG_ITEMS) {
      throw new Error(`Catalog items ${catalogItems} !== ${EXPECTED_CATALOG_ITEMS}`);
    }
    if (catalogTranslations !== EXPECTED_CATALOG_TRANSLATIONS) {
      throw new Error(
        `Catalog translations ${catalogTranslations} !== ${EXPECTED_CATALOG_TRANSLATIONS}`,
      );
    }
    if (catalogAliases !== EXPECTED_CATALOG_ALIASES) {
      throw new Error(`Catalog aliases ${catalogAliases} !== ${EXPECTED_CATALOG_ALIASES}`);
    }
    if (catalogRules !== EXPECTED_CATALOG_RULES) {
      throw new Error(`Catalog rules ${catalogRules} !== ${EXPECTED_CATALOG_RULES}`);
    }

    // ── Plans / versions / entitlements / limits from Step 14 seed ─────────
    const plans = await prisma.platformPlan.count();
    const drafts = await prisma.platformPlanVersion.count({ where: { lifecycle: 'DRAFT' } });
    const entitlements = await prisma.platformPlanVersionEntitlement.count();
    const limits = await prisma.platformPlanVersionLimit.count();
    if (plans !== 3) throw new Error(`Expected 3 plans, got ${plans}`);
    if (drafts !== 3) throw new Error(`Expected 3 Draft versions, got ${drafts}`);
    if (entitlements !== 16 + 33 + 42) {
      throw new Error(`Expected 91 entitlements (16+33+42), got ${entitlements}`);
    }
    if (limits !== 36) throw new Error(`Expected 36 Limits (12*3), got ${limits}`);

    // ── Empty Step 15 catalog ──────────────────────────────────────────────
    const addons = await prisma.platformAddOn.count();
    const addonVersions = await prisma.platformAddOnVersion.count();
    const overrides = await prisma.platformCommercialOverride.count();
    if (addons !== 0) throw new Error(`Expected platform_addons=0, got ${addons}`);
    if (addonVersions !== 0) {
      throw new Error(`Expected platform_addon_versions=0, got ${addonVersions}`);
    }
    if (overrides !== 0) {
      throw new Error(`Expected platform_commercial_overrides=0, got ${overrides}`);
    }

    // ── Step 15 tables exist ───────────────────────────────────────────────
    const tables = await prisma.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'
       AND tablename IN (${sqlInList(STEP15_TABLES)})`,
    );
    const names = new Set(tables.map((t) => t.tablename));
    for (const required of STEP15_TABLES) {
      if (!names.has(required)) throw new Error(`Missing Step 15 table ${required}`);
    }

    // ── NO tenantId / subscriptionId on addon/override tables ──────────────
    const forbiddenCols = await prisma.$queryRawUnsafe(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name IN (${sqlInList(STEP15_TABLES)})
         AND column_name IN ('tenantId', 'subscriptionId')`,
    );
    if (forbiddenCols.length) {
      throw new Error(
        `Forbidden tenant/subscription columns on Step 15 tables: ${JSON.stringify(forbiddenCols)}`,
      );
    }

    // ── NO Step 16 assignment / runtime tables ─────────────────────────────
    const forbiddenTables = await prisma.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND (
         tablename LIKE '%subscription_addon%' OR
         tablename LIKE '%tenant_addon%' OR
         tablename LIKE '%addon_assignment%' OR
         tablename LIKE '%effective_entitlement%' OR
         tablename LIKE '%runtime_entitlement%'
       )`,
    );
    if (forbiddenTables.length) {
      throw new Error(`Forbidden Step 16+ tables present: ${JSON.stringify(forbiddenTables)}`);
    }

    // ── Unique constraints / indexes ───────────────────────────────────────
    const indexes = await prisma.$queryRawUnsafe(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
       AND indexname IN (${sqlInList(REQUIRED_UNIQUE_INDEXES)})`,
    );
    const indexNames = new Set(indexes.map((i) => i.indexname));
    for (const required of REQUIRED_UNIQUE_INDEXES) {
      if (!indexNames.has(required)) {
        throw new Error(`Missing unique index ${required}`);
      }
    }
    // Limit-as-entitlement is service-enforced (MODULE/FEATURE only); DB has no CHECK.
    // Unique entitlement constraint is the DB-level guarantee we assert here.
    console.log(
      'Limit kind as entitlement: service-enforced (MODULE/FEATURE only); unique entitlement index present',
    );

    // ── Duplicate canonicalKey insert must fail ────────────────────────────
    const addonId = randomUUID();
    const nowIso = new Date().toISOString();
    await prisma.$executeRawUnsafe(
      `INSERT INTO platform_addons (id, "canonicalKey", lifecycle, "rowVersion", "systemSeeded", "createdAt", "updatedAt")
       VALUES ('${addonId}'::uuid, 'addon.dup_probe', 'DRAFT', 1, false, '${nowIso}'::timestamp, '${nowIso}'::timestamp)`,
    );
    let dupFailed = false;
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO platform_addons (id, "canonicalKey", lifecycle, "rowVersion", "systemSeeded", "createdAt", "updatedAt")
         VALUES ('${randomUUID()}'::uuid, 'addon.dup_probe', 'DRAFT', 1, false, '${nowIso}'::timestamp, '${nowIso}'::timestamp)`,
      );
    } catch {
      dupFailed = true;
    }
    if (!dupFailed) {
      throw new Error('Expected duplicate platform_addons.canonicalKey insert to fail');
    }
    await prisma.$executeRawUnsafe(`DELETE FROM platform_addons WHERE id = '${addonId}'::uuid`);

    // ── Restrict FKs ───────────────────────────────────────────────────────
    const fks = await prisma.$queryRawUnsafe(
      `SELECT tc.constraint_name, tc.table_name, rc.delete_rule
       FROM information_schema.table_constraints tc
       JOIN information_schema.referential_constraints rc
         ON tc.constraint_name = rc.constraint_name
        AND tc.constraint_schema = rc.constraint_schema
       WHERE tc.constraint_schema = 'public'
         AND tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_name IN (${sqlInList(STEP15_TABLES)})`,
    );
    if (!fks.length) throw new Error('Expected Step 15 foreign keys');
    for (const fk of fks) {
      if (fk.delete_rule !== 'RESTRICT' && fk.delete_rule !== 'NO ACTION') {
        throw new Error(
          `FK ${fk.constraint_name} on ${fk.table_name} delete_rule=${fk.delete_rule} (want RESTRICT|NO ACTION)`,
        );
      }
    }

    const addonsFinal = await prisma.platformAddOn.count();
    if (addonsFinal !== 0) {
      throw new Error(`Expected empty addons after probe cleanup, got ${addonsFinal}`);
    }

    console.log(
      JSON.stringify({
        ok: true,
        cleanDb,
        catalog: {
          items: catalogItems,
          translations: catalogTranslations,
          aliases: catalogAliases,
          rules: catalogRules,
        },
        plans: { plans, drafts, entitlements, limits },
        step15: {
          platform_addons: 0,
          platform_addon_versions: 0,
          platform_commercial_overrides: 0,
          emptyCatalogDocumented: true,
          uniqueIndexes: REQUIRED_UNIQUE_INDEXES.length,
          restrictFks: fks.length,
          duplicateCanonicalKeyRejected: true,
          limitAsEntitlement: 'service-enforced',
          tenantAssignmentColumns: false,
          step16Tables: false,
        },
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
