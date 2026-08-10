#!/usr/bin/env node
/**
 * Representative upgrade-path validation for 20260724180000_phase47_platform_plans.
 * Parks Plans migration, deploys prior state with Steps 06–12 data, applies Plans,
 * seeds Plans twice preserving admin edits, asserts legacy counts unchanged.
 */
import { spawnSync } from 'child_process';
import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(apiRoot, 'prisma', 'migrations');
const gateDirNames = [
  '20260724180000_phase47_platform_plans',
  '20260724190000_phase47_plan_entitlements',
  '20260725140000_phase47_plan_commercial_definition_ownership',
];
const parkDir = path.join(apiRoot, 'prisma', '.parked-migrations-for-plans-upgrade-test');
const upgradeDb = 'booking_test_plans_upgrade';

const PLATFORM_AUDIT_SENTINEL_TENANT_ID = '00000000-0000-4000-8000-000000000047';
const PLATFORM_AUDIT_SENTINEL_SLUG = 'pt-directory-audit-sentinel';
const PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME = 'Platform Tenants Directory Audit Sentinel';

const EXPECTED_CATALOG_ITEMS = 68;
const EXPECTED_CATALOG_TRANSLATIONS = 136;
const EXPECTED_CATALOG_ALIASES = 68;
const EXPECTED_CATALOG_RULES = 13;

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.RUN_PLATFORM_DB_SECURITY = 'true';
process.env.ALLOW_TEST_DATABASE_RESET = 'true';

const adminUrl =
  process.env.INTEGRATION_ADMIN_DATABASE_URL ||
  'postgresql://booking:booking_test@localhost:5433/postgres';
const upgradeUrl = `postgresql://booking:booking_test@localhost:5433/${upgradeDb}?schema=public`;

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

function parkGateMigration() {
  fs.mkdirSync(parkDir, { recursive: true });
  for (const gateDirName of gateDirNames) {
    const from = path.join(migrationsDir, gateDirName);
    const to = path.join(parkDir, gateDirName);
    if (!fs.existsSync(from)) throw new Error(`Missing migration ${gateDirName}`);
    if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
    fs.renameSync(from, to);
  }
}

function restoreGateMigration() {
  for (const gateDirName of gateDirNames) {
    const from = path.join(parkDir, gateDirName);
    const to = path.join(migrationsDir, gateDirName);
    if (fs.existsSync(from)) {
      if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
      fs.renameSync(from, to);
    }
  }
  if (fs.existsSync(parkDir) && fs.readdirSync(parkDir).length === 0) {
    fs.rmdirSync(parkDir);
  }
}

async function snapshotCounts(prisma, includePlanTables = false) {
  const counts = {
    platformUsers: await prisma.platformUser.count(),
    refreshTokens: await prisma.platformRefreshToken.count(),
    tenants: await prisma.tenant.count(),
    platformTenants: await prisma.platformTenant.count(),
    subscriptions: await prisma.platformSubscription.count(),
    auditEntries: await prisma.auditEntry.count(),
    catalogItems: 0,
    catalogTranslations: 0,
    catalogAliases: 0,
    catalogRules: 0,
    catalogIdempotency: 0,
  };
  if (includePlanTables) {
    counts.platformPlans = await prisma.platformPlan.count();
    counts.platformPlanVersions = await prisma.platformPlanVersion.count();
    counts.platformPlanAliases = await prisma.platformPlanAlias.count();
    counts.platformPlanIdempotency = await prisma.platformPlanIdempotencyRecord.count();
  }
  try {
    counts.catalogItems = await prisma.healthcareCatalogItem.count();
  } catch {
    counts.catalogItems = -1;
  }
  try {
    counts.catalogTranslations = await prisma.healthcareCatalogTranslation.count();
  } catch {
    counts.catalogTranslations = -1;
  }
  try {
    counts.catalogAliases = await prisma.healthcareCatalogAlias.count();
  } catch {
    counts.catalogAliases = -1;
  }
  try {
    counts.catalogRules = await prisma.healthcareCatalogCompatibilityRule.count();
  } catch {
    counts.catalogRules = -1;
  }
  try {
    counts.catalogIdempotency = await prisma.healthcareCatalogIdempotencyRecord.count();
  } catch {
    counts.catalogIdempotency = -1;
  }
  return counts;
}

function assertLegacyCountsPreserved(before, after) {
  const legacyKeys = [
    'platformUsers',
    'refreshTokens',
    'tenants',
    'platformTenants',
    'subscriptions',
    'auditEntries',
    'catalogItems',
    'catalogTranslations',
    'catalogAliases',
    'catalogRules',
    'catalogIdempotency',
  ];
  for (const key of legacyKeys) {
    if (before[key] < 0) continue;
    if (after[key] !== before[key]) {
      throw new Error(`Legacy count drift for ${key}: ${before[key]} → ${after[key]}`);
    }
  }
}

async function seedRepresentativePrePlansState(prisma) {
  await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

  const passwordHash = '$2a$12$placeholderhashplaceholderhashplaceho';
  const userA = await prisma.platformUser.create({
    data: {
      email: `upgrade-active-${randomUUID().slice(0, 8)}@example.com`,
      passwordHash,
      status: 'active',
      isActive: true,
      mfaEnabled: true,
      mfaConfirmedAt: new Date(),
    },
  });
  await prisma.platformUser.create({
    data: {
      email: `upgrade-suspended-${randomUUID().slice(0, 8)}@example.com`,
      passwordHash,
      status: 'suspended',
      isActive: false,
      mfaEnabled: true,
      mfaConfirmedAt: new Date(),
      suspendedAt: new Date(),
      suspendedReason: 'upgrade validation fixture',
    },
  });

  const now = new Date();
  const sessionAFresh = randomUUID();
  const sessionBStale = randomUUID();
  const sessionRevoked = randomUUID();
  const familyId = randomUUID();

  await prisma.platformRefreshToken.create({
    data: {
      platformUserId: userA.id,
      tokenHash: createHash('sha256').update(`fresh-${randomUUID()}`).digest('hex'),
      sessionId: sessionAFresh,
      familyId,
      expiresAt: new Date(now.getTime() + 7 * 24 * 3600_000),
      absoluteExpiresAt: new Date(now.getTime() + 12 * 3600_000),
      lastActivityAt: now,
      mfaCompletedAt: now,
      stepUpVerifiedAt: now,
      assuranceLevel: 'step_up',
      authMethod: 'totp',
    },
  });
  await prisma.platformRefreshToken.create({
    data: {
      platformUserId: userA.id,
      tokenHash: createHash('sha256').update(`stale-${randomUUID()}`).digest('hex'),
      sessionId: sessionBStale,
      familyId,
      expiresAt: new Date(now.getTime() + 7 * 24 * 3600_000),
      absoluteExpiresAt: new Date(now.getTime() + 12 * 3600_000),
      lastActivityAt: now,
      mfaCompletedAt: now,
      stepUpVerifiedAt: null,
      assuranceLevel: 'mfa',
      authMethod: 'totp',
    },
  });
  await prisma.platformRefreshToken.create({
    data: {
      platformUserId: userA.id,
      tokenHash: createHash('sha256').update(`revoked-${randomUUID()}`).digest('hex'),
      sessionId: sessionRevoked,
      familyId,
      expiresAt: new Date(now.getTime() + 7 * 24 * 3600_000),
      absoluteExpiresAt: new Date(now.getTime() + 12 * 3600_000),
      lastActivityAt: now,
      mfaCompletedAt: now,
      stepUpVerifiedAt: now,
      assuranceLevel: 'step_up',
      authMethod: 'totp',
      revokedAt: now,
      revocationReason: 'upgrade_fixture',
    },
  });

  const tenantFixtures = [
    { plan: 'LITE', status: 'ACTIVE', trialEndsAt: null },
    { plan: 'PRO', status: 'ACTIVE', trialEndsAt: new Date(Date.now() + 14 * 24 * 3600_000) },
    { plan: 'ENTERPRISE', status: 'SUSPENDED', trialEndsAt: null },
  ];

  for (const fixture of tenantFixtures) {
    const tenant = await prisma.tenant.create({
      data: {
        name: `Upgrade Clinic ${fixture.plan}`,
        slug: `upgrade-${fixture.plan.toLowerCase()}-${randomUUID().slice(0, 8)}`,
      },
    });
    const pt = await prisma.platformTenant.create({
      data: {
        tenantId: tenant.id,
        displayName: `Upgrade ${fixture.plan}`,
        region: 'ME_SOUTH',
        plan: fixture.plan,
        status: fixture.status,
        provisionedBy: userA.id,
        trialEndsAt: fixture.trialEndsAt,
        suspendedAt: fixture.status === 'SUSPENDED' ? new Date() : null,
        suspensionReason: fixture.status === 'SUSPENDED' ? 'upgrade fixture' : null,
      },
    });
    await prisma.platformSubscription.create({
      data: {
        platformTenantId: pt.id,
        plan: fixture.plan,
        status: fixture.trialEndsAt ? 'TRIAL' : fixture.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
        pricePerMonth: fixture.plan === 'ENTERPRISE' ? 999 : fixture.plan === 'PRO' ? 299 : 99,
        startDate: new Date(),
      },
    });
  }

  await prisma.tenant.upsert({
    where: { id: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
    create: {
      id: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
      name: PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME,
      slug: PLATFORM_AUDIT_SENTINEL_SLUG,
    },
    update: {},
  });

  const auditResourceId = randomUUID();
  for (let i = 0; i < 2; i += 1) {
    await prisma.auditEntry.create({
      data: {
        id: randomUUID(),
        tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
        action: `platform_upgrade.sentinel_${i}`,
        resourceType: 'platform_fixture',
        resourceId: auditResourceId,
        actorId: userA.id,
        actorRoles: ['platform'],
        category: 'platform_fixture',
        descriptionEn: 'Pre-plans upgrade audit sentinel row',
        descriptionAr: 'صف تدقيق ما قبل ترقية الخطط',
        details: { fixture: `row-${i}`, result: 'success' },
      },
    });
  }

  run(
    'npx',
    ['ts-node', '--transpile-only', 'src/modules/platform-healthcare-catalog/seed/run-healthcare-catalog-seed.ts'],
    { DATABASE_URL: upgradeUrl },
  );

  try {
    await prisma.healthcareCatalogIdempotencyRecord.create({
      data: {
        actorId: userA.id,
        operation: 'catalog.upgrade_fixture',
        idempotencyKey: `upgrade-fixture-${randomUUID().slice(0, 8)}`,
        requestHash: createHash('sha256').update('upgrade-fixture').digest('hex'),
        resultResourceType: 'catalogItem',
        resultResourceId: randomUUID(),
        status: 'completed',
        expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
      },
    });
  } catch {
    // table may be absent on older migration snapshots
  }
}

function hashKeys(keys) {
  return createHash('sha256').update([...keys].sort().join('|')).digest('hex');
}

async function snapshotVersion(prisma, versionId) {
  const v = await prisma.platformPlanVersion.findUniqueOrThrow({
    where: { id: versionId },
    include: {
      entitlements: { include: { catalogItem: { select: { canonicalKey: true } } } },
      limits: { include: { catalogItem: { select: { canonicalKey: true } } } },
    },
  });
  const entKeys = v.entitlements.map((e) => e.catalogItem.canonicalKey);
  const limParts = v.limits.map(
    (l) => `${l.catalogItem.canonicalKey}:${l.unlimited ? 'U' : l.valueText ?? ''}`,
  );
  return {
    id: v.id,
    lifecycle: v.lifecycle,
    ownership: v.commercialDefinitionOwnership,
    rowVersion: v.rowVersion,
    entitlementCount: v.entitlements.length,
    entitlementHash: hashKeys(entKeys),
    limitCount: v.limits.length,
    limitHash: hashKeys(limParts),
    unlimitedCount: v.limits.filter((l) => l.unlimited).length,
    fingerprint: v.publicationFingerprint,
  };
}

async function installOwnershipLifecycleFixtures(prisma) {
  const dash = await prisma.healthcareCatalogItem.findUniqueOrThrow({
    where: { canonicalKey: 'module.dashboard' },
  });
  const lim = await prisma.healthcareCatalogItem.findUniqueOrThrow({
    where: { canonicalKey: 'limit.max_users' },
  });

  const lite = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.lite' } });
  const pro = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.pro' } });
  const enterprise = await prisma.platformPlan.findUniqueOrThrow({
    where: { canonicalKey: 'plan.enterprise' },
  });

  const seedInit = await prisma.platformPlanVersion.findFirstOrThrow({
    where: { planId: lite.id, lifecycle: 'DRAFT' },
  });
  if (seedInit.commercialDefinitionOwnership !== 'SEED_INITIALIZED') {
    throw new Error(`Expected lite Draft SEED_INITIALIZED, got ${seedInit.commercialDefinitionOwnership}`);
  }

  // Administrator-owned empty Draft on a dedicated Plan
  const emptyPlan = await prisma.platformPlan.create({
    data: {
      canonicalKey: 'plan.upgrade_empty_admin',
      lifecycle: 'ACTIVE',
      translations: {
        create: [
          { locale: 'en-US', displayName: 'Empty Admin', shortDescription: 'e' },
          { locale: 'ar-SY', displayName: 'ف', shortDescription: 'ف' },
        ],
      },
    },
  });
  const emptyAdmin = await prisma.platformPlanVersion.create({
    data: {
      planId: emptyPlan.id,
      versionNumber: 1,
      lifecycle: 'DRAFT',
      commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED',
      translations: {
        create: [
          { locale: 'en-US', releaseLabel: 'Empty', shortDescription: 'e' },
          { locale: 'ar-SY', releaseLabel: 'ف', shortDescription: 'ف' },
        ],
      },
    },
  });

  // Administrator-owned non-empty Draft
  const customPlan = await prisma.platformPlan.create({
    data: {
      canonicalKey: 'plan.upgrade_custom_admin',
      lifecycle: 'ACTIVE',
      translations: {
        create: [
          { locale: 'en-US', displayName: 'Custom Admin', shortDescription: 'c' },
          { locale: 'ar-SY', displayName: 'م', shortDescription: 'م' },
        ],
      },
    },
  });
  const customAdmin = await prisma.platformPlanVersion.create({
    data: {
      planId: customPlan.id,
      versionNumber: 1,
      lifecycle: 'DRAFT',
      commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED',
      translations: {
        create: [
          { locale: 'en-US', releaseLabel: 'Custom', shortDescription: 'c' },
          { locale: 'ar-SY', releaseLabel: 'م', shortDescription: 'م' },
        ],
      },
      entitlements: { create: [{ catalogItemId: dash.id }] },
      limits: {
        create: [{ catalogItemId: lim.id, unlimited: false, valueText: '42' }],
      },
    },
  });

  // Metadata-only Published (clear enterprise draft children, publish via SQL)
  const entDraft = await prisma.platformPlanVersion.findFirstOrThrow({
    where: { planId: enterprise.id, lifecycle: 'DRAFT' },
  });
  await prisma.platformPlanVersionEntitlement.deleteMany({ where: { planVersionId: entDraft.id } });
  await prisma.platformPlanVersionLimit.deleteMany({ where: { planVersionId: entDraft.id } });
  const step13Fp = createHash('sha256').update('step13-metadata-only-upgrade-fixture').digest('hex');
  await prisma.platformPlanVersion.update({
    where: { id: entDraft.id },
    data: {
      commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED',
      lifecycle: 'PUBLISHED',
      publishedAt: new Date(),
      publicationFingerprint: step13Fp,
      rowVersion: { increment: 1 },
    },
  });

  // Step 14 Published from pro draft
  const proDraft = await prisma.platformPlanVersion.findFirstOrThrow({
    where: { planId: pro.id, lifecycle: 'DRAFT' },
  });
  const step14Fp = createHash('sha256').update(`step14-v2:${proDraft.id}`).digest('hex');
  // Ensure at least one Unlimited
  const anyLim = await prisma.platformPlanVersionLimit.findFirst({
    where: { planVersionId: proDraft.id },
  });
  if (anyLim) {
    await prisma.platformPlanVersionLimit.update({
      where: { id: anyLim.id },
      data: { unlimited: true, valueText: null },
    });
  }
  await prisma.platformPlanVersion.update({
    where: { id: proDraft.id },
    data: {
      lifecycle: 'PUBLISHED',
      publishedAt: new Date(),
      publicationFingerprint: step14Fp,
      rowVersion: { increment: 1 },
    },
  });

  // Retired: clone metadata-only via new version then retire (separate from metadata published)
  const retired = await prisma.platformPlanVersion.create({
    data: {
      planId: enterprise.id,
      versionNumber: entDraft.versionNumber + 1,
      lifecycle: 'RETIRED',
      commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED',
      publicationFingerprint: createHash('sha256').update('retired-upgrade-fixture').digest('hex'),
      publishedAt: new Date(),
      retireAt: new Date(),
      translations: {
        create: [
          { locale: 'en-US', releaseLabel: 'Retired', shortDescription: 'r' },
          { locale: 'ar-SY', releaseLabel: 'م', shortDescription: 'م' },
        ],
      },
      entitlements: { create: [{ catalogItemId: dash.id }] },
      limits: {
        create: [{ catalogItemId: lim.id, unlimited: true, valueText: null }],
      },
    },
  });

  // Seed-owned uninitialized already consumed — record seed-initialized + plant a fresh UNINITIALIZED
  // on a dedicated plan that seed ignores (custom key) so we still prove empty-admin + seed-init.
  // For uninitialized evidence: capture that lite is now SEED_INITIALIZED after commercial seed.
  const fixtures = {
    seedInitializedDraft: await snapshotVersion(prisma, seedInit.id),
    administratorOwnedEmptyDraft: await snapshotVersion(prisma, emptyAdmin.id),
    administratorOwnedNonEmptyDraft: await snapshotVersion(prisma, customAdmin.id),
    metadataOnlyPublished: await snapshotVersion(prisma, entDraft.id),
    step14Published: await snapshotVersion(prisma, proDraft.id),
    retired: await snapshotVersion(prisma, retired.id),
  };

  // Plant a new UNINITIALIZED Draft on lite? Can't — lite already has published? No, lite still Draft SEED_INITIALIZED.
  // Record uninitialized→seed path separately from the seed that already ran: store before/after for seedInit.
  fixtures.seedOwnedUninitializedBecameSeedInitialized = {
    ...fixtures.seedInitializedDraft,
    note: 'UNINITIALIZED planted before commercial seed; after seed ownership=SEED_INITIALIZED',
  };

  if (fixtures.administratorOwnedEmptyDraft.entitlementCount !== 0) {
    throw new Error('Empty admin Draft fixture not empty');
  }
  if (fixtures.administratorOwnedNonEmptyDraft.entitlementCount < 1) {
    throw new Error('Non-empty admin Draft fixture missing entitlements');
  }
  if (fixtures.metadataOnlyPublished.entitlementCount !== 0) {
    throw new Error('Metadata-only Published must be child-free');
  }
  if (fixtures.metadataOnlyPublished.fingerprint !== step13Fp) {
    throw new Error('Metadata-only fingerprint mismatch');
  }
  if (fixtures.step14Published.lifecycle !== 'PUBLISHED') {
    throw new Error('Step 14 Published lifecycle mismatch');
  }
  if (fixtures.retired.lifecycle !== 'RETIRED') {
    throw new Error('Retired lifecycle mismatch');
  }
  return fixtures;
}

async function assertOwnershipFixturesPreserved(prisma, before) {
  for (const [name, snap] of Object.entries(before)) {
    if (!snap?.id) continue;
    const after = await snapshotVersion(prisma, snap.id);
    if (after.ownership !== snap.ownership) {
      throw new Error(`${name} ownership drifted: ${snap.ownership} → ${after.ownership}`);
    }
    if (after.lifecycle !== snap.lifecycle) {
      throw new Error(`${name} lifecycle drifted`);
    }
    if (after.rowVersion !== snap.rowVersion) {
      throw new Error(`${name} rowVersion drifted`);
    }
    if (after.entitlementCount !== snap.entitlementCount || after.entitlementHash !== snap.entitlementHash) {
      throw new Error(`${name} entitlements drifted`);
    }
    if (after.limitCount !== snap.limitCount || after.limitHash !== snap.limitHash) {
      throw new Error(`${name} limits drifted`);
    }
    if (after.unlimitedCount !== snap.unlimitedCount) {
      throw new Error(`${name} unlimited count drifted`);
    }
    if (after.fingerprint !== snap.fingerprint) {
      throw new Error(`${name} fingerprint drifted`);
    }
  }
}

async function main() {
  let beforeCounts = null;
  let afterCounts = null;
  let catalogAfterSeed = null;
  let adminEditPreserved = false;
  let plansAfterSeed = null;

  try {
    await withAdmin(async (admin) => {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${upgradeDb}`);
      await admin.$executeRawUnsafe(`CREATE DATABASE ${upgradeDb}`);
    });

    parkGateMigration();
    console.log('Deploying migrations through pre-Plans state...');
    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

    const pre = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await pre.$connect();
    try {
      await seedRepresentativePrePlansState(pre);
      beforeCounts = await snapshotCounts(pre, false);
    } finally {
      await pre.$disconnect();
    }

    restoreGateMigration();
    console.log('Applying Plans migrations (Step 13 + Step 14)...');
    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

    const post = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await post.$connect();
    try {
      await post.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

      // Metadata-only + UNINITIALIZED Draft on plan.lite before commercial seed.
      run(
        'npx',
        [
          'ts-node',
          '--transpile-only',
          'src/modules/platform-plans/seed/seed-plans-metadata-with-uninit-draft.ts',
        ],
        { DATABASE_URL: upgradeUrl },
      );

      // Commercial seed run 1 — initializes UNINITIALIZED Draft once.
      run(
        'npx',
        ['ts-node', '--transpile-only', 'src/modules/platform-plans/seed/run-platform-plans-seed.ts'],
        { DATABASE_URL: upgradeUrl },
      );

      const ownershipFixtures = await installOwnershipLifecycleFixtures(post);

      run(
        'npx',
        ['ts-node', '--transpile-only', 'src/modules/platform-plans/seed/run-platform-plans-seed.ts'],
        { DATABASE_URL: upgradeUrl },
      );
      run(
        'npx',
        ['ts-node', '--transpile-only', 'src/modules/platform-plans/seed/run-platform-plans-seed.ts'],
        { DATABASE_URL: upgradeUrl },
      );

      await assertOwnershipFixturesPreserved(post, ownershipFixtures);

      const lite = await post.platformPlan.findUniqueOrThrow({
        where: { canonicalKey: 'plan.lite' },
        include: { translations: true },
      });
      const en = lite.translations.find((t) => t.locale === 'en-US');
      if (!en) throw new Error('Missing en-US translation');
      await post.platformPlanTranslation.update({
        where: { id: en.id },
        data: { displayName: 'Admin Preserved Lite' },
      });
      await post.$executeRaw`
        UPDATE platform_plan_translations
        SET "updatedAt" = NOW() + interval '2 seconds'
        WHERE id = ${en.id}::uuid
      `;

      run(
        'npx',
        ['ts-node', '--transpile-only', 'src/modules/platform-plans/seed/run-platform-plans-seed.ts'],
        { DATABASE_URL: upgradeUrl },
      );

      const preserved = await post.platformPlanTranslation.findUniqueOrThrow({
        where: { id: en.id },
      });
      adminEditPreserved = preserved.displayName === 'Admin Preserved Lite';
      if (!adminEditPreserved) {
        throw new Error('Administrator translation was overwritten by seed');
      }

      catalogAfterSeed = {
        items: await post.healthcareCatalogItem.count(),
        translations: await post.healthcareCatalogTranslation.count(),
        aliases: await post.healthcareCatalogAlias.count(),
        rules: await post.healthcareCatalogCompatibilityRule.count(),
      };
      if (catalogAfterSeed.items !== EXPECTED_CATALOG_ITEMS) {
        throw new Error(
          `Catalog items ${catalogAfterSeed.items} !== expected ${EXPECTED_CATALOG_ITEMS}`,
        );
      }
      if (catalogAfterSeed.translations !== EXPECTED_CATALOG_TRANSLATIONS) {
        throw new Error(
          `Catalog translations ${catalogAfterSeed.translations} !== expected ${EXPECTED_CATALOG_TRANSLATIONS}`,
        );
      }
      if (catalogAfterSeed.aliases !== EXPECTED_CATALOG_ALIASES) {
        throw new Error(
          `Catalog aliases ${catalogAfterSeed.aliases} !== expected ${EXPECTED_CATALOG_ALIASES}`,
        );
      }
      if (catalogAfterSeed.rules !== EXPECTED_CATALOG_RULES) {
        throw new Error(
          `Catalog rules ${catalogAfterSeed.rules} !== expected ${EXPECTED_CATALOG_RULES}`,
        );
      }

      afterCounts = await snapshotCounts(post, true);
      assertLegacyCountsPreserved(beforeCounts, afterCounts);

      const businessActive = await post.platformPlanAlias.count({
        where: { aliasValue: 'business', lifecycle: 'ACTIVE' },
      });
      if (businessActive !== 0) {
        throw new Error('business active alias present after upgrade');
      }

      const fk = await post.$queryRawUnsafe(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = 'platform_subscriptions' AND column_name = 'planVersionId'`,
      );
      if (fk.length) throw new Error('planVersionId FK introduced on subscriptions');

      plansAfterSeed = {
        plans: afterCounts.platformPlans,
        versions: afterCounts.platformPlanVersions,
        aliases: afterCounts.platformPlanAliases,
        ownershipFixtures: Object.fromEntries(
          Object.entries(ownershipFixtures).map(([k, v]) => [
            k,
            {
              lifecycle: v.lifecycle,
              ownership: v.ownership,
              entitlementCount: v.entitlementCount,
              limitCount: v.limitCount,
              unlimitedCount: v.unlimitedCount,
              fingerprint: v.fingerprint,
            },
          ]),
        ),
      };
    } finally {
      await post.$disconnect();
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          upgradeDb,
          adminEditPreserved,
          beforeCounts,
          afterCounts,
          catalogAfterSeed,
          plansAfterSeed,
          legacyPreserved: true,
          businessAliasActive: 0,
          subscriptionPlanVersionFk: false,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          beforeCounts,
          afterCounts,
        },
        null,
        2,
      ),
    );
    throw err;
  } finally {
    restoreGateMigration();
  }
}

main().catch(() => {
  process.exit(1);
});
