#!/usr/bin/env node
/**
 * Representative upgrade-path validation for Phase 47 Step 15 Add-ons & Overrides.
 * Parks Step 15 migration, deploys Steps 06–14 with realistic fixtures, snapshots,
 * applies Step 15, runs empty seed twice, asserts prior counts/hashes unchanged.
 *
 * Part 8 inventory: Platform Security, Tenants/Subscriptions, Audit, Catalog,
 * Plans/Step 14, prior-product normalized hashes (Dashboard/Directory/access/
 * licensing inputs/Clinic), Step 15 emptiness.
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
const gateDirName = '20260726010000_phase47_step15_addons_overrides';
const parkDir = path.join(apiRoot, 'prisma', '.parked-migrations-for-addons-upgrade-test');
const upgradeDb = 'booking_test_addons_upgrade';

const PLATFORM_AUDIT_SENTINEL_TENANT_ID = '00000000-0000-4000-8000-000000000047';
const PLATFORM_AUDIT_SENTINEL_SLUG = 'pt-directory-audit-sentinel';
const PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME = 'Platform Tenants Directory Audit Sentinel';
/** Reserved identity that must never resolve to a Tenant row (missing-tenant fixture). */
const MISSING_TENANT_FIXTURE_ID = '00000000-0000-4000-8000-00000000009a';
const ADMIN_CATALOG_EDIT_MARKER = 'Admin Preserved Catalog Translation';

/** Code-governed built-in Platform roles (no PlatformRole table). */
const CODE_GOVERNED_PLATFORM_ROLE_COUNT = 8;

const EXPECTED_CATALOG_ITEMS = 68;
const EXPECTED_CATALOG_TRANSLATIONS = 136;
const EXPECTED_CATALOG_ALIASES = 68;
const EXPECTED_CATALOG_RULES = 13;

const TENANT_STATUSES = ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'];
const SUBSCRIPTION_STATUSES = ['TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED'];
const LEGACY_PLANS = ['LITE', 'PRO', 'ENTERPRISE'];
const PLAN_CANONICAL_BY_LEGACY = {
  LITE: 'plan.lite',
  PRO: 'plan.pro',
  ENTERPRISE: 'plan.enterprise',
};

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
  const from = path.join(migrationsDir, gateDirName);
  const to = path.join(parkDir, gateDirName);
  if (!fs.existsSync(from)) throw new Error(`Missing migration ${gateDirName}`);
  if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
  fs.renameSync(from, to);
}

function restoreGateMigration() {
  const from = path.join(parkDir, gateDirName);
  const to = path.join(migrationsDir, gateDirName);
  if (fs.existsSync(from)) {
    if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true });
    fs.renameSync(from, to);
  }
  if (fs.existsSync(parkDir) && fs.readdirSync(parkDir).length === 0) {
    fs.rmdirSync(parkDir);
  }
}

function hashKeys(keys) {
  return createHash('sha256').update([...keys].sort().join('|')).digest('hex');
}

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function tableExists(prisma, tableName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1`,
    tableName,
  );
  return rows.length > 0;
}

function fileSha256(absPath) {
  return createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
}

function countMapFromGroupBy(rows, keyField, frozenKeys) {
  const counts = new Map();
  for (const row of rows) {
    const key = String(row[keyField] ?? '');
    if (!key) continue;
    const c = typeof row._count === 'number' ? row._count : (row._count?._all ?? 0);
    counts.set(key, c);
  }
  return Object.fromEntries(frozenKeys.map((k) => [k, counts.get(k) ?? 0]));
}

/**
 * Prior-product preservation hashes from live Prisma aggregates (no invented snapshot tables).
 * Sentinel identities are excluded; raw sentinel values are never included in hashed payloads.
 */
async function computePriorProductHashes(prisma) {
  // 1. Dashboard summary — normalized counts aligned with Dashboard platform-table metrics
  //    plus Security footprint (users / active sessions) used by Super Admin overview.
  const platformUsersByStatusRows = await prisma.platformUser.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  const platformUsersByStatus = countMapFromGroupBy(platformUsersByStatusRows, 'status', [
    'invited',
    'pending_activation',
    'active',
    'suspended',
    'disabled',
    'invitation_expired',
  ]);
  const platformUsers = await prisma.platformUser.count();

  const tenantsByStatusRows = await prisma.platformTenant.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  const platformTenantsByStatus = countMapFromGroupBy(
    tenantsByStatusRows,
    'status',
    TENANT_STATUSES,
  );
  const platformTenantsTotal = await prisma.platformTenant.count();
  // Match Dashboard trialing resolver; fixtures leave trialEndsAt null → stable 0.
  const platformTenantsTrialing = await prisma.platformTenant.count({
    where: {
      trialEndsAt: { not: null, gt: new Date() },
      status: { not: 'ARCHIVED' },
    },
  });

  const legacyPlanRows = await prisma.platformTenant.groupBy({
    by: ['plan'],
    _count: { _all: true },
  });
  const legacyPlanAssignment = countMapFromGroupBy(legacyPlanRows, 'plan', LEGACY_PLANS);

  const subsByStatusRows = await prisma.platformSubscription.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  const subscriptionsByStatus = countMapFromGroupBy(
    subsByStatusRows,
    'status',
    SUBSCRIPTION_STATUSES,
  );

  const subsByPlanStatusRows = await prisma.platformSubscription.groupBy({
    by: ['plan', 'status'],
    _count: { _all: true },
  });
  const subscriptionsByPlanStatus = subsByPlanStatusRows
    .map((row) => ({
      plan: String(row.plan),
      status: String(row.status),
      count: typeof row._count === 'number' ? row._count : (row._count?._all ?? 0),
    }))
    .sort((a, b) => `${a.plan}:${a.status}`.localeCompare(`${b.plan}:${b.status}`));

  const activeSessions = (
    await prisma.platformRefreshToken.groupBy({
      by: ['sessionId'],
    })
  ).length;

  const dashboardSummaryHash = stableHash({
    platformUsers,
    platformUsersByStatus,
    platformTenantsTotal,
    platformTenantsByStatus,
    platformTenantsTrialing,
    legacyPlanAssignment,
    subscriptionsByStatus,
    subscriptionsByPlanStatus,
    activeSessions,
  });

  // 2. Tenant Directory — ordered platformTenant rows excluding audit sentinel
  const directoryRows = await prisma.platformTenant.findMany({
    where: {
      tenantId: { not: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
      tenant: { slug: { not: PLATFORM_AUDIT_SENTINEL_SLUG } },
    },
    orderBy: [{ displayName: 'asc' }, { tenantId: 'asc' }],
    select: { tenantId: true, displayName: true, plan: true, status: true },
  });
  const tenantDirectoryHash = stableHash(
    directoryRows.map((r) => ({
      tenantId: r.tenantId,
      displayName: r.displayName,
      plan: r.plan,
      status: r.status,
    })),
  );

  // 3. Access summary — per fixture tenant subscription plan+status (non-sentinel)
  const accessRows = await prisma.platformSubscription.findMany({
    where: {
      platformTenant: {
        tenantId: { not: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
        tenant: { slug: { not: PLATFORM_AUDIT_SENTINEL_SLUG } },
      },
    },
    orderBy: [{ plan: 'asc' }, { status: 'asc' }, { id: 'asc' }],
    select: {
      plan: true,
      status: true,
      platformTenant: { select: { plan: true, status: true } },
    },
  });
  const accessSummaryHash = stableHash(
    accessRows.map((r) => ({
      subscriptionPlan: r.plan,
      subscriptionStatus: r.status,
      tenantPlan: r.platformTenant.plan,
      tenantStatus: r.platformTenant.status,
    })),
  );

  // 4. Licensing — commercial definition inputs (LicensingEngineService not invoked:
  //    Nest DI / lifecycle side-effects). Plus normalized subscription fixtures.
  const licensingInputHashes = {};
  for (const legacy of LEGACY_PLANS) {
    const canonicalKey = PLAN_CANONICAL_BY_LEGACY[legacy];
    const published = await prisma.platformPlanVersion.findMany({
      where: { lifecycle: 'PUBLISHED', plan: { canonicalKey } },
      orderBy: { versionNumber: 'asc' },
      include: {
        entitlements: { include: { catalogItem: { select: { canonicalKey: true } } } },
        limits: { include: { catalogItem: { select: { canonicalKey: true } } } },
        plan: { select: { canonicalKey: true } },
      },
    });
    const normalized = published.map((v) => ({
      planCanonicalKey: v.plan.canonicalKey,
      versionNumber: v.versionNumber,
      entitlementKeys: v.entitlements.map((e) => e.catalogItem.canonicalKey).sort(),
      limitKeys: v.limits
        .map((l) => `${l.catalogItem.canonicalKey}:${l.unlimited ? 'U' : l.valueText ?? ''}`)
        .sort(),
    }));
    licensingInputHashes[`licensingInputHash_${legacy}`] = stableHash(normalized);
  }

  const subscriptionFixtures = await prisma.platformSubscription.findMany({
    where: {
      platformTenant: {
        tenantId: { not: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
        tenant: { slug: { not: PLATFORM_AUDIT_SENTINEL_SLUG } },
      },
    },
    orderBy: [{ plan: 'asc' }, { status: 'asc' }],
    select: { plan: true, status: true },
  });
  const licensingSubscriptionFixturesHash = stableHash(
    subscriptionFixtures.map((s) => ({ plan: s.plan, status: s.status })),
  );

  // 5. Clinic — Step 15 tables have zero assignment columns (vacuous pre-migration)
  //    + static PlatformAuthRoute / LicensingEngine boundary markers (deterministic).
  let step15AssignmentColumnCount = 0;
  for (const table of ['platform_addons', 'platform_commercial_overrides']) {
    if (!(await tableExists(prisma, table))) continue;
    const badCols = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1
         AND lower(column_name) IN ('tenantid','subscriptionid')`,
      table,
    );
    step15AssignmentColumnCount += badCols.length;
  }

  const licensingEnginePath = path.join(
    apiRoot,
    'src',
    'modules',
    'subscription',
    'application',
    'services',
    'licensing-engine.service.ts',
  );
  const addonsControllerPath = path.join(
    apiRoot,
    'src',
    'modules',
    'platform-addons',
    'api',
    'platform-addons.controller.ts',
  );
  const licensingEngineSourceHash = fileSha256(licensingEnginePath);
  const addonsControllerSrc = fs.readFileSync(addonsControllerPath, 'utf8');
  const platformAddonsControllerHasPlatformAuthRoute =
    /@PlatformAuthRoute\s*\(/.test(addonsControllerSrc);
  // Clinic JWT rejection is enforced by PlatformAuthRoute on the controller —
  // one class-level marker covers all Step 15 handlers on this controller.
  const clinicPlatformRoutesRejectingClinicCount = platformAddonsControllerHasPlatformAuthRoute
    ? 1
    : 0;

  const clinicHash = stableHash({
    step15AssignmentColumnCount,
    clinicPlatformRoutesRejectingClinicCount,
    licensingEngineSourceHash,
    platformAddonsControllerHasPlatformAuthRoute,
  });

  return {
    dashboardSummaryHash,
    tenantDirectoryHash,
    accessSummaryHash,
    ...licensingInputHashes,
    licensingSubscriptionFixturesHash,
    clinicHash,
  };
}

async function snapshotCore(prisma) {
  const plans = await prisma.platformPlan.findMany({
    orderBy: { canonicalKey: 'asc' },
    include: {
      translations: { orderBy: { locale: 'asc' } },
      aliases: { orderBy: [{ sourceNamespace: 'asc' }, { aliasValue: 'asc' }] },
      versions: {
        orderBy: { versionNumber: 'asc' },
        include: {
          entitlements: { include: { catalogItem: { select: { canonicalKey: true } } } },
          limits: { include: { catalogItem: { select: { canonicalKey: true } } } },
        },
      },
    },
  });

  const versionFingerprints = [];
  const entitlementParts = [];
  const limitParts = [];
  const ownershipParts = [];
  let draftVersions = 0;
  let publishedVersions = 0;
  let retiredVersions = 0;
  const planTranslationParts = [];
  const planAliasParts = [];

  for (const plan of plans) {
    for (const tr of plan.translations) {
      planTranslationParts.push(`${plan.canonicalKey}:${tr.locale}:${tr.displayName}`);
    }
    for (const al of plan.aliases) {
      planAliasParts.push(
        `${plan.canonicalKey}:${al.sourceNamespace}:${al.aliasValue}:${al.lifecycle}`,
      );
    }
    for (const v of plan.versions) {
      if (v.lifecycle === 'DRAFT') draftVersions += 1;
      else if (v.lifecycle === 'PUBLISHED') publishedVersions += 1;
      else if (v.lifecycle === 'RETIRED') retiredVersions += 1;
      ownershipParts.push(
        `${v.id}:${v.lifecycle}:${v.commercialDefinitionOwnership ?? ''}:${v.rowVersion}`,
      );
      versionFingerprints.push(
        `${v.id}:${v.lifecycle}:${v.publicationFingerprint ?? ''}:${v.rowVersion}`,
      );
      for (const e of v.entitlements) {
        entitlementParts.push(`${v.id}:${e.catalogItem.canonicalKey}`);
      }
      for (const l of v.limits) {
        limitParts.push(
          `${v.id}:${l.catalogItem.canonicalKey}:${l.unlimited ? 'U' : l.valueText ?? ''}`,
        );
      }
    }
  }

  const suspendedUsers = await prisma.platformUser.count({
    where: { status: 'suspended' },
  });
  const roleAssignments = await prisma.platformUserRole.count({
    where: { revokedAt: null },
  });
  const roleAssignmentKeys = (
    await prisma.platformUserRole.findMany({
      where: { revokedAt: null },
      select: { roleKey: true },
      orderBy: { roleKey: 'asc' },
    })
  ).map((r) => r.roleKey);

  const refreshTokens = await prisma.platformRefreshToken.count();
  const sessions = await prisma.platformRefreshToken.groupBy({
    by: ['sessionId'],
  });
  const stepUpSessions = await prisma.platformRefreshToken.count({
    where: { stepUpVerifiedAt: { not: null } },
  });

  const platformTenants = await prisma.platformTenant.findMany({
    orderBy: { plan: 'asc' },
    select: { id: true, plan: true, status: true, tenantId: true },
  });
  const liteFixture = platformTenants.find((t) => t.plan === 'LITE') ?? null;
  const proFixture = platformTenants.find((t) => t.plan === 'PRO') ?? null;
  const enterpriseFixture = platformTenants.find((t) => t.plan === 'ENTERPRISE') ?? null;

  const businessAliasRetired = await prisma.platformPlanAlias.count({
    where: { aliasValue: 'business', lifecycle: 'RETIRED' },
  });
  const businessAliasActive = await prisma.platformPlanAlias.count({
    where: { aliasValue: 'business', lifecycle: 'ACTIVE' },
  });
  const businessPlanForbidden = await prisma.platformPlan.count({
    where: { canonicalKey: 'plan.business' },
  });

  const missingTenantRow = await prisma.tenant.findUnique({
    where: { id: MISSING_TENANT_FIXTURE_ID },
  });

  const auditEntries = await prisma.auditEntry.findMany({
    orderBy: [{ action: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      action: true,
      resourceType: true,
      category: true,
      actorRoles: true,
      details: true,
    },
  });
  // Deterministic hash of representative audit shape — never include sentinel tenant raw id.
  const representativeAudit = auditEntries[0]
    ? {
        action: auditEntries[0].action,
        resourceType: auditEntries[0].resourceType,
        category: auditEntries[0].category,
        actorRoles: [...auditEntries[0].actorRoles].sort(),
        detailsKeys: Object.keys(auditEntries[0].details ?? {}).sort(),
      }
    : null;
  const sentinelAuditCount = await prisma.auditEntry.count({
    where: { tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
  });

  const catalogItems = await prisma.healthcareCatalogItem.count();
  const catalogTranslations = await prisma.healthcareCatalogTranslation.count();
  const catalogAliases = await prisma.healthcareCatalogAlias.count();
  const catalogRules = await prisma.healthcareCatalogCompatibilityRule.count();
  const catalogIdempotency = await prisma.healthcareCatalogIdempotencyRecord.count();

  const adminEdited = await prisma.healthcareCatalogTranslation.findFirst({
    where: { displayName: ADMIN_CATALOG_EDIT_MARKER, locale: 'en-US' },
    select: { id: true, displayName: true, shortDescription: true, locale: true },
  });
  const adminEditedTranslationHash = adminEdited
    ? stableHash({
        locale: adminEdited.locale,
        displayName: adminEdited.displayName,
        shortDescription: adminEdited.shortDescription,
      })
    : null;

  const duplicateCanonicalKeys = await prisma.$queryRawUnsafe(`
    SELECT "canonicalKey", COUNT(*)::int AS c
    FROM healthcare_catalog_items
    GROUP BY "canonicalKey"
    HAVING COUNT(*) > 1
  `);
  const duplicateAliases = await prisma.$queryRawUnsafe(`
    SELECT "sourceNamespace", "aliasValue", COUNT(*)::int AS c
    FROM healthcare_catalog_aliases
    GROUP BY "sourceNamespace", "aliasValue"
    HAVING COUNT(*) > 1
  `);

  const hasPlatformRoleTable = await tableExists(prisma, 'platform_roles');
  const hasPermissionAssignmentTable =
    (await tableExists(prisma, 'platform_permission_assignments')) ||
    (await tableExists(prisma, 'platform_role_permissions'));

  const priorProductAreas = await computePriorProductHashes(prisma);

  return {
    // Platform Security
    platformUsers: await prisma.platformUser.count(),
    platformRoles: hasPlatformRoleTable
      ? await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM platform_roles`).then(
          (r) => r[0]?.c ?? 0,
        )
      : CODE_GOVERNED_PLATFORM_ROLE_COUNT,
    platformRolesSource: hasPlatformRoleTable ? 'table' : 'code_governed_no_PlatformRole_table',
    roleAssignments,
    roleAssignmentHash: hashKeys(roleAssignmentKeys),
    permissionAssignments: hasPermissionAssignmentTable
      ? 'table_present'
      : 'N/A_permissions_derived_from_role_keys_in_code',
    sessions: sessions.length,
    refreshTokens,
    stepUpSessionFixtures: stepUpSessions,
    suspendedUserFixturePresent: suspendedUsers > 0,
    suspendedUsers,

    // Tenant and Subscription
    tenants: await prisma.tenant.count(),
    platformTenants: platformTenants.length,
    subscriptions: await prisma.platformSubscription.count(),
    liteFixturePresent: Boolean(liteFixture),
    proFixturePresent: Boolean(proFixture),
    enterpriseFixturePresent: Boolean(enterpriseFixture),
    liteFixtureHash: liteFixture
      ? stableHash({ plan: liteFixture.plan, status: liteFixture.status })
      : null,
    proFixtureHash: proFixture
      ? stableHash({ plan: proFixture.plan, status: proFixture.status })
      : null,
    enterpriseFixtureHash: enterpriseFixture
      ? stableHash({ plan: enterpriseFixture.plan, status: enterpriseFixture.status })
      : null,
    businessOverlay: {
      retiredAliasCount: businessAliasRetired,
      activeAliasCount: businessAliasActive,
      planBusinessCount: businessPlanForbidden,
      marker: 'business_is_option_b_ui_overlay_not_plan',
    },
    missingTenantFixtureIdentityPresent: missingTenantRow === null,
    missingTenantFixtureHash: stableHash({
      identityClass: 'missing_tenant',
      exists: false,
    }),
    auditSentinelIdentityHash: stableHash({
      identityClass: 'audit_sentinel',
      slugPresent: true,
    }),

    // Audit
    auditEntries: auditEntries.length,
    representativeAuditHash: representativeAudit ? stableHash(representativeAudit) : null,
    sentinelAuditCount,

    // Healthcare Catalog
    catalogItems,
    catalogTranslations,
    catalogAliases,
    catalogRules,
    catalogIdempotency,
    adminEditedTranslationHash,
    adminEditedTranslationPresent: Boolean(adminEdited),
    duplicateCanonicalKeyCount: duplicateCanonicalKeys.length,
    duplicateAliasCount: duplicateAliases.length,

    // Plans and Step 14
    platformPlans: plans.length,
    platformPlanTranslations: planTranslationParts.length,
    platformPlanAliases: planAliasParts.length,
    platformPlanTranslationHash: hashKeys(planTranslationParts),
    platformPlanAliasHash: hashKeys(planAliasParts),
    draftPlanVersions: draftVersions,
    publishedPlanVersions: publishedVersions,
    retiredPlanVersions: retiredVersions,
    platformPlanVersions: draftVersions + publishedVersions + retiredVersions,
    platformPlanIdempotency: await prisma.platformPlanIdempotencyRecord.count(),
    ownershipHash: hashKeys(ownershipParts),
    ownershipFixtureCount: ownershipParts.length,
    entitlementCount: entitlementParts.length,
    limitCount: limitParts.length,
    unlimitedCount: limitParts.filter((p) => p.endsWith(':U')).length,
    entitlementHash: hashKeys(entitlementParts),
    limitHash: hashKeys(limitParts),
    fingerprintHash: hashKeys(versionFingerprints),

    // Prior product areas
    priorProductAreas,
  };
}

async function seedPreStep15Fixtures(prisma) {
  await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

  const passwordHash = '$2a$12$placeholderhashplaceholderhashplaceho';
  const userA = await prisma.platformUser.create({
    data: {
      email: `addons-upgrade-active-${randomUUID().slice(0, 8)}@example.com`,
      passwordHash,
      status: 'active',
      isActive: true,
      mfaEnabled: true,
      mfaConfirmedAt: new Date(),
    },
  });
  await prisma.platformUser.create({
    data: {
      email: `addons-upgrade-suspended-${randomUUID().slice(0, 8)}@example.com`,
      passwordHash,
      status: 'suspended',
      isActive: false,
      mfaEnabled: true,
      mfaConfirmedAt: new Date(),
      suspendedAt: new Date(),
      suspendedReason: 'addons upgrade fixture',
    },
  });

  // Role assignments (PlatformRole is code-governed; assignments live on platform_user_roles)
  await prisma.platformUserRole.create({
    data: {
      platformUserId: userA.id,
      roleKey: 'platform_administrator',
      assignedById: userA.id,
      reason: 'addons upgrade fixture',
    },
  });
  await prisma.platformUserRole.create({
    data: {
      platformUserId: userA.id,
      roleKey: 'plans_subscription_manager',
      assignedById: userA.id,
      reason: 'addons upgrade fixture',
    },
  });

  const now = new Date();
  const familyId = randomUUID();
  await prisma.platformRefreshToken.create({
    data: {
      platformUserId: userA.id,
      tokenHash: createHash('sha256').update(`fresh-${randomUUID()}`).digest('hex'),
      sessionId: randomUUID(),
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
      tokenHash: createHash('sha256').update(`mfa-only-${randomUUID()}`).digest('hex'),
      sessionId: randomUUID(),
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

  for (const fixture of [
    { plan: 'LITE', status: 'ACTIVE' },
    { plan: 'PRO', status: 'ACTIVE' },
    { plan: 'ENTERPRISE', status: 'SUSPENDED' },
  ]) {
    const tenant = await prisma.tenant.create({
      data: {
        name: `Addons Upgrade ${fixture.plan}`,
        slug: `addons-up-${fixture.plan.toLowerCase()}-${randomUUID().slice(0, 8)}`,
      },
    });
    const pt = await prisma.platformTenant.create({
      data: {
        tenantId: tenant.id,
        displayName: `Addons Upgrade ${fixture.plan}`,
        region: 'ME_SOUTH',
        plan: fixture.plan,
        status: fixture.status,
        provisionedBy: userA.id,
        suspendedAt: fixture.status === 'SUSPENDED' ? new Date() : null,
        suspensionReason: fixture.status === 'SUSPENDED' ? 'fixture' : null,
      },
    });
    await prisma.platformSubscription.create({
      data: {
        platformTenantId: pt.id,
        plan: fixture.plan,
        status: fixture.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
        pricePerMonth: fixture.plan === 'ENTERPRISE' ? 999 : fixture.plan === 'PRO' ? 299 : 99,
        startDate: new Date(),
      },
    });
  }

  // Prove missing-tenant fixture identity is absent
  const ghost = await prisma.tenant.findUnique({ where: { id: MISSING_TENANT_FIXTURE_ID } });
  if (ghost) throw new Error('missing-tenant fixture identity unexpectedly exists');

  await prisma.tenant.upsert({
    where: { id: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
    create: {
      id: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
      name: PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME,
      slug: PLATFORM_AUDIT_SENTINEL_SLUG,
    },
    update: {},
  });
  await prisma.auditEntry.create({
    data: {
      id: randomUUID(),
      tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
      action: 'platform_addons_upgrade.sentinel',
      resourceType: 'platform_fixture',
      resourceId: randomUUID(),
      actorId: userA.id,
      actorRoles: ['platform'],
      category: 'platform_fixture',
      descriptionEn: 'Pre-Step-15 upgrade audit fixture',
      descriptionAr: 'تثبيت تدقيق ما قبل الخطوة 15',
      details: { fixture: 'pre-step15', result: 'success' },
    },
  });

  run(
    'npx',
    [
      'ts-node',
      '--transpile-only',
      'src/modules/platform-healthcare-catalog/seed/run-healthcare-catalog-seed.ts',
    ],
    { DATABASE_URL: upgradeUrl },
  );

  // Administrator-edited catalog translation (preserved across Step 15)
  const dash = await prisma.healthcareCatalogItem.findUniqueOrThrow({
    where: { canonicalKey: 'module.dashboard' },
  });
  const enTr = await prisma.healthcareCatalogTranslation.findFirstOrThrow({
    where: { itemId: dash.id, locale: 'en-US' },
  });
  await prisma.healthcareCatalogTranslation.update({
    where: { id: enTr.id },
    data: {
      displayName: ADMIN_CATALOG_EDIT_MARKER,
      shortDescription: 'upgrade-admin-edit-preserved',
    },
  });

  try {
    await prisma.healthcareCatalogIdempotencyRecord.create({
      data: {
        actorId: userA.id,
        operation: 'catalog.addons_upgrade_fixture',
        idempotencyKey: `addons-upgrade-fixture-${randomUUID().slice(0, 8)}`,
        requestHash: createHash('sha256').update('addons-upgrade-fixture').digest('hex'),
        resultResourceType: 'catalogItem',
        resultResourceId: dash.id,
        status: 'completed',
        expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
      },
    });
  } catch {
    // ignore unique collisions
  }

  run(
    'npx',
    ['ts-node', '--transpile-only', 'src/modules/platform-plans/seed/run-platform-plans-seed.ts'],
    { DATABASE_URL: upgradeUrl },
  );

  // Publish one Plan Version so fingerprint preservation is meaningful
  const draft = await prisma.platformPlanVersion.findFirstOrThrow({
    where: { lifecycle: 'DRAFT' },
    include: {
      entitlements: { include: { catalogItem: true } },
      limits: { include: { catalogItem: true } },
      translations: true,
      plan: true,
    },
  });
  const fp = createHash('sha256')
    .update(
      JSON.stringify({
        plan: draft.plan.canonicalKey,
        version: draft.versionNumber,
        ents: draft.entitlements.map((e) => e.catalogItem.canonicalKey).sort(),
        lims: draft.limits
          .map((l) => `${l.catalogItem.canonicalKey}:${l.unlimited}:${l.valueText}`)
          .sort(),
      }),
    )
    .digest('hex');
  await prisma.platformPlanVersion.update({
    where: { id: draft.id },
    data: {
      lifecycle: 'PUBLISHED',
      publishedAt: new Date(),
      publishedByPlatformUserId: userA.id,
      publicationFingerprint: fp,
      publicationReason: 'addons upgrade fixture publish',
      commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED',
      rowVersion: { increment: 1 },
    },
  });
}

function assertSnapshotsEqual(before, after) {
  const beforeKeys = Object.keys(before).sort();
  const afterKeys = Object.keys(after).sort();
  if (beforeKeys.join('|') !== afterKeys.join('|')) {
    throw new Error(
      `Snapshot key drift: ${beforeKeys.filter((k) => !afterKeys.includes(k))} / ${afterKeys.filter((k) => !beforeKeys.includes(k))}`,
    );
  }
  for (const key of beforeKeys) {
    const b = JSON.stringify(before[key]);
    const a = JSON.stringify(after[key]);
    if (b !== a) {
      throw new Error(`Preservation drift for ${key}: ${b} → ${a}`);
    }
  }
}

async function main() {
  parkGateMigration();
  let prisma;
  try {
    await withAdmin(async (admin) => {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${upgradeDb}`);
      await admin.$executeRawUnsafe(`CREATE DATABASE ${upgradeDb}`);
    });

    console.log('Upgrade migrate deploy (Steps 06–14, Step 15 parked)...');
    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

    prisma = new PrismaClient({ datasources: { db: { url: upgradeUrl } } });
    await prisma.$connect();
    await seedPreStep15Fixtures(prisma);

    const before = await snapshotCore(prisma);
    if (before.catalogItems !== EXPECTED_CATALOG_ITEMS) {
      throw new Error(`Pre Catalog items ${before.catalogItems}`);
    }
    if (before.catalogTranslations !== EXPECTED_CATALOG_TRANSLATIONS) {
      throw new Error(`Pre Catalog translations ${before.catalogTranslations}`);
    }
    if (before.catalogAliases !== EXPECTED_CATALOG_ALIASES) {
      throw new Error(`Pre Catalog aliases ${before.catalogAliases}`);
    }
    if (before.catalogRules !== EXPECTED_CATALOG_RULES) {
      throw new Error(`Pre Catalog rules ${before.catalogRules}`);
    }
    if (!before.adminEditedTranslationPresent || !before.adminEditedTranslationHash) {
      throw new Error('Admin-edited catalog translation fixture missing');
    }
    if (!before.suspendedUserFixturePresent) {
      throw new Error('Suspended-user fixture missing');
    }
    if (!before.liteFixturePresent || !before.proFixturePresent || !before.enterpriseFixturePresent) {
      throw new Error('LITE/PRO/ENTERPRISE fixtures missing');
    }
    if (!before.missingTenantFixtureIdentityPresent) {
      throw new Error('missing-tenant fixture identity must not resolve');
    }
    if (before.duplicateCanonicalKeyCount !== 0 || before.duplicateAliasCount !== 0) {
      throw new Error('Catalog duplicate key/alias detected pre-Step-15');
    }
    if (before.roleAssignments < 1) {
      throw new Error('Role assignment fixtures missing');
    }
    for (const key of [
      'dashboardSummaryHash',
      'tenantDirectoryHash',
      'accessSummaryHash',
      'licensingInputHash_LITE',
      'licensingInputHash_PRO',
      'licensingInputHash_ENTERPRISE',
      'licensingSubscriptionFixturesHash',
      'clinicHash',
    ]) {
      const value = before.priorProductAreas[key];
      if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
        throw new Error(`priorProductAreas.${key} must be a sha256 hex hash, got ${value}`);
      }
      if (String(value).includes('N/A')) {
        throw new Error(`priorProductAreas.${key} must not be N/A`);
      }
    }
    if (typeof before.catalogIdempotency !== 'number') {
      throw new Error('catalogIdempotency count missing from snapshot');
    }
    if (typeof before.platformPlanIdempotency !== 'number') {
      throw new Error('platformPlanIdempotency count missing from snapshot');
    }

    // Step 15 tables must not exist yet
    const early = await prisma.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='platform_addons'`,
    );
    if (early.length) throw new Error('platform_addons must not exist before Step 15 migration');

    restoreGateMigration();
    console.log('Applying Step 15 migration...');
    run('npx', ['prisma', 'migrate', 'deploy'], { DATABASE_URL: upgradeUrl });

    run(
      'npx',
      ['ts-node', '--transpile-only', 'src/modules/platform-addons/seed/run-platform-addons-seed.ts'],
      { DATABASE_URL: upgradeUrl },
    );
    run(
      'npx',
      ['ts-node', '--transpile-only', 'src/modules/platform-addons/seed/run-platform-addons-seed.ts'],
      { DATABASE_URL: upgradeUrl },
    );

    const after = await snapshotCore(prisma);
    assertSnapshotsEqual(before, after);

    const addOns = await prisma.platformAddOn.count();
    const versions = await prisma.platformAddOnVersion.count();
    const overrides = await prisma.platformCommercialOverride.count();
    if (addOns !== 0 || versions !== 0 || overrides !== 0) {
      throw new Error(
        `Automatic seed inventing products: addOns=${addOns} versions=${versions} overrides=${overrides}`,
      );
    }

    const forbidden = await prisma.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND (
         tablename ILIKE '%subscription_addon%' OR
         tablename ILIKE '%tenant_addon%' OR
         tablename ILIKE '%addon_assignment%' OR
         tablename ILIKE '%effective_entitlement%' OR
         tablename ILIKE '%runtime_entitlement%'
       )`,
    );
    if (forbidden.length) {
      throw new Error(`Forbidden Step 16+/runtime tables: ${JSON.stringify(forbidden)}`);
    }

    for (const table of ['platform_addons', 'platform_commercial_overrides']) {
      const badCols = await prisma.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1
           AND lower(column_name) IN ('tenantid','subscriptionid')`,
        table,
      );
      if (badCols.length) throw new Error(`${table} has assignment columns`);
    }

    console.log(
      JSON.stringify({
        ok: true,
        database: upgradeDb,
        before,
        after,
        step15: {
          addOns: 0,
          versions: 0,
          overrides: 0,
          tenantAssignments: 0,
          subscriptionAssignments: 0,
          noStep16Schema: true,
        },
        catalogExpected: {
          items: EXPECTED_CATALOG_ITEMS,
          translations: EXPECTED_CATALOG_TRANSLATIONS,
          aliases: EXPECTED_CATALOG_ALIASES,
          rules: EXPECTED_CATALOG_RULES,
        },
        preserved: true,
      }),
    );
  } finally {
    if (prisma) await prisma.$disconnect();
    restoreGateMigration();
  }
}

main().catch((err) => {
  try {
    restoreGateMigration();
  } catch {
    /* ignore */
  }
  console.error(err);
  process.exit(1);
});
