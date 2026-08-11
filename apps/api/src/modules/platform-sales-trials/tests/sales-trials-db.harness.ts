/**
 * Flexible Step 25 — Trial Creation and Customer Conversion PostgreSQL harness.
 * Contract: docs/TRIAL_CREATION_AND_CUSTOMER_CONVERSION.md
 */
import { createHash, randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import type { JwtConfig } from '../../auth/infrastructure/services/jwt-token.service';
import {
  JwtClaimsVO,
  PLATFORM_TOKEN_AUDIENCE,
} from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from '../../auth/tests/platform-db-security.harness';
import { createSubscriptionsPrismaWrapper } from '../../platform-subscriptions/tests/platform-subscriptions-db.harness';
import type { PrismaService } from '../../../infrastructure/prisma.service';
import {
  SALES_TRIALS_FAILURE_INJECTION_ENV,
  SALES_TRIAL_AUDIT_CATEGORY,
} from '../platform-sales-trials.constants';

export {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
};

export const JWT_CFG: JwtConfig = {
  accessSecret: 'clinic-access-secret-min-32-characters-xx',
  refreshSecret: 'clinic-refresh-secret-min-32-characters-x',
  accessExpiresIn: 900,
  refreshExpiresIn: 604800,
  mfaChallengeExpiresIn: 300,
  platformAccessSecret: 'platform-access-secret-min-32-chars-xx',
  platformRefreshSecret: 'platform-refresh-secret-min-32-chars-x',
  platformIssuer: 'booking-platform',
  platformAccessExpiresIn: 900,
  platformRefreshExpiresIn: 604800,
  platformSecretsSharedWithClinic: false,
};

export const SALES_MANAGER_ROLE = 'sales_manager';
export const SALES_REP_ROLE = 'sales_representative';

export function createHybridPrisma(prisma: PrismaClient): PrismaService {
  return Object.assign(prisma, createSubscriptionsPrismaWrapper(prisma)) as unknown as PrismaService;
}

/**
 * Query-counting client for the N+1 proof. Emits Prisma `query` events so a suite can
 * assert the list path issues a bounded number of statements.
 */
export function createQueryCountingClient(): {
  client: PrismaClient;
  counted: () => number;
  reset: () => void;
} {
  assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
  const url = DEFAULT_PLATFORM_DB_SECURITY_URL;
  const sep = url.includes('?') ? '&' : '?';
  const client = new PrismaClient({
    datasources: { db: { url: `${url}${sep}connection_limit=10&pool_timeout=60` } },
    transactionOptions: { maxWait: 20_000, timeout: 60_000 },
    log: [{ emit: 'event', level: 'query' }],
  });
  let count = 0;
  (client as unknown as { $on: (e: 'query', cb: (ev: { query: string }) => void) => void }).$on(
    'query',
    (ev) => {
      // Transaction/session control statements are not data queries.
      if (!/^(BEGIN|COMMIT|ROLLBACK|SET |SELECT 1|DEALLOCATE)/i.test(ev.query.trim())) count += 1;
    },
  );
  return { client, counted: () => count, reset: () => (count = 0) };
}

export function clearSalesTrialsFailureInjection(): void {
  delete process.env[SALES_TRIALS_FAILURE_INJECTION_ENV];
}

export function setSalesTrialsFailureInjection(point: string): void {
  process.env[SALES_TRIALS_FAILURE_INJECTION_ENV] = point;
}

export function platformClaims(
  sub: string,
  sessionId: string,
  actorRoles: string[] = [SALES_MANAGER_ROLE],
): JwtClaimsVO {
  return new JwtClaimsVO({
    sub,
    tenantId: null,
    branchId: null,
    roles: actorRoles as never,
    sessionId,
    sessionClass: 'platform',
    principalType: 'platform',
    aud: PLATFORM_TOKEN_AUDIENCE,
    iss: 'booking-platform',
  });
}

/**
 * Removes Trial governance rows and the tenants/commercial rows the Trial suites created.
 * Catalog and Plan seeds are never deleted (Catalog invariant 68/136/68/13).
 */
export async function cleanupSalesTrialTables(prisma: PrismaClient): Promise<void> {
  assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
  await prisma.platformSalesTrialConversion.deleteMany({});
  await prisma.platformSalesTrialExtensionHistory.deleteMany({});
  await prisma.platformSalesTrial.deleteMany({});
  await prisma.platformSalesIdempotencyRecord.deleteMany({});
  await prisma.platformSalesRepresentative.deleteMany({});
  await prisma.outboxEvent.deleteMany({
    where: { aggregateType: 'PlatformSalesTrial' },
  });
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "platform_subscription_commercial_idempotency",
      "platform_subscription_commercial_changes",
      "platform_subscription_commercial_snapshots",
      "platform_subscription_override_assignments",
      "platform_subscription_addon_assignments",
      "platform_subscription_commercial_configs"
    RESTART IDENTITY CASCADE
  `);
  // Trial-provisioned tenants use the deterministic `trial-<id>` slug.
  const trialTenants = await prisma.tenant.findMany({
    where: { slug: { startsWith: 'trial-' } },
    select: { id: true },
  });
  if (trialTenants.length > 0) {
    const tenantIds = trialTenants.map((t) => t.id);
    await prisma.platformTenant.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  }
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`DROP TRIGGER IF EXISTS audit_entries_immutable ON "audit_entries"`);
    await tx.$executeRawUnsafe(
      `DELETE FROM "audit_entries" WHERE "category" = '${SALES_TRIAL_AUDIT_CATEGORY}'`,
    );
    await tx.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION prevent_audit_modification()
      RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'audit_entries is append-only. Operation % is forbidden on this table.', TG_OP;
      END;
      $$ LANGUAGE plpgsql
    `);
    await tx.$executeRawUnsafe(`
      CREATE TRIGGER audit_entries_immutable
        BEFORE UPDATE OR DELETE ON audit_entries
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification()
    `);
  });
}

export async function countTrialAudits(prisma: PrismaClient, action: string): Promise<number> {
  return prisma.auditEntry.count({
    where: { action, category: SALES_TRIAL_AUDIT_CATEGORY },
  });
}

export async function countTrialAuditsFor(
  prisma: PrismaClient,
  action: string,
  resourceId: string,
): Promise<number> {
  return prisma.auditEntry.count({
    where: { action, resourceId, category: SALES_TRIAL_AUDIT_CATEGORY },
  });
}

export async function createRepProfile(
  prisma: PrismaClient,
  platformUserId: string,
  opts: { regionCode?: string } = {},
) {
  return prisma.platformSalesRepresentative.create({
    data: {
      platformUserId,
      status: 'ACTIVE',
      regionCode: opts.regionCode ?? 'GLOBAL',
    },
  });
}

// ─── Catalog fixtures (read-only against the authoritative Catalog) ───────────

export type TrialCatalogKeys = {
  facilityTypeKey: string;
  specialtyKeys: string[];
  moduleKeys: string[];
  limitKeys: string[];
};

export async function ensureCatalogSeeded(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.healthcareCatalogItem.count();
  if (existing > 0) return;
  const { HealthcareCatalogSeedService } = await import(
    '../../platform-healthcare-catalog/application/catalog-seed.service'
  );
  await new HealthcareCatalogSeedService({
    withPlatformBypass: async <T>(fn: (client: typeof prisma) => Promise<T>) =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
        return fn(tx as unknown as typeof prisma);
      }),
  } as never).seedAll();
}

/** Deterministic Catalog key selection: the Catalog is the only key authority. */
export async function resolveCatalogKeys(prisma: PrismaClient): Promise<TrialCatalogKeys> {
  await ensureCatalogSeeded(prisma);
  const [facility, specialties, modules, limits] = await Promise.all([
    prisma.healthcareCatalogItem.findFirst({
      where: { kind: 'FACILITY_TYPE', lifecycle: { not: 'RETIRED' } },
      orderBy: { canonicalKey: 'asc' },
      select: { canonicalKey: true },
    }),
    prisma.healthcareCatalogItem.findMany({
      where: { kind: 'SPECIALTY', lifecycle: { not: 'RETIRED' } },
      orderBy: { canonicalKey: 'asc' },
      take: 4,
      select: { canonicalKey: true },
    }),
    prisma.healthcareCatalogItem.findMany({
      where: { kind: 'MODULE', lifecycle: { not: 'RETIRED' } },
      orderBy: { canonicalKey: 'asc' },
      take: 6,
      select: { canonicalKey: true },
    }),
    prisma.healthcareCatalogItem.findMany({
      where: { kind: 'LIMIT', lifecycle: { not: 'RETIRED' } },
      orderBy: { canonicalKey: 'asc' },
      take: 4,
      select: { canonicalKey: true },
    }),
  ]);
  if (!facility) throw new Error('Catalog FACILITY_TYPE fixture required for Step 25 tests.');
  return {
    facilityTypeKey: facility.canonicalKey,
    specialtyKeys: specialties.map((s) => s.canonicalKey),
    moduleKeys: modules.map((m) => m.canonicalKey),
    limitKeys: limits.map((l) => l.canonicalKey),
  };
}

// ─── Plan Version fixtures ───────────────────────────────────────────────────

export type PlanVersionFixtureOpts = {
  canonicalKeySuffix?: string;
  lifecycle?: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  paid?: boolean;
  moduleKeys?: string[];
  specialtyKeys?: string[];
  limits?: Array<{ canonicalKey: string; valueText?: string | null; unlimited?: boolean }>;
  trialDefaultEnabled?: boolean | null;
  trialDefaultDays?: number | null;
  withFingerprint?: boolean;
};

/**
 * Creates a Plan + Plan Version with the requested immutable commercial definition.
 * Test fixture only — production Plan publication remains Step 14 authority.
 */
export async function createPlanVersionFixture(
  prisma: PrismaClient,
  opts: PlanVersionFixtureOpts = {},
): Promise<{ planId: string; planVersionId: string; planCanonicalKey: string }> {
  const suffix = opts.canonicalKeySuffix ?? randomUUID().slice(0, 8);
  const planCanonicalKey = `plan.trial_fixture_${suffix}`.slice(0, 128);
  const plan = await prisma.platformPlan.create({
    data: { canonicalKey: planCanonicalKey, lifecycle: 'ACTIVE', systemSeeded: false },
  });
  const lifecycle = opts.lifecycle ?? 'PUBLISHED';
  const paid = opts.paid ?? false;
  const withFingerprint = opts.withFingerprint ?? lifecycle === 'PUBLISHED';
  const version = await prisma.platformPlanVersion.create({
    data: {
      planId: plan.id,
      versionNumber: 1,
      lifecycle,
      trialDefaultEnabled: opts.trialDefaultEnabled ?? null,
      trialDefaultDays: opts.trialDefaultDays ?? null,
      priceAmountMinor: paid ? 49900 : null,
      priceCurrency: paid ? 'USD' : null,
      billingInterval: paid ? 'month' : null,
      billingIntervalCount: paid ? 1 : null,
      publishedAt: lifecycle === 'PUBLISHED' ? new Date() : null,
      publishedByPlatformUserId: lifecycle === 'PUBLISHED' ? randomUUID() : null,
      publicationFingerprint: withFingerprint
        ? createHash('sha256').update(`${planCanonicalKey}:1`).digest('hex')
        : null,
      publicationReason: lifecycle === 'PUBLISHED' ? 'step25_test_fixture_publish' : null,
      commercialDefinitionOwnership: 'ADMINISTRATOR_OWNED',
    },
  });

  const entitlementKeys = [...(opts.moduleKeys ?? []), ...(opts.specialtyKeys ?? [])];
  if (entitlementKeys.length > 0) {
    const items = await prisma.healthcareCatalogItem.findMany({
      where: { canonicalKey: { in: entitlementKeys } },
      select: { id: true },
    });
    for (const item of items) {
      await prisma.platformPlanVersionEntitlement.create({
        data: { planVersionId: version.id, catalogItemId: item.id },
      });
    }
  }
  for (const limit of opts.limits ?? []) {
    const item = await prisma.healthcareCatalogItem.findUnique({
      where: { canonicalKey: limit.canonicalKey },
      select: { id: true },
    });
    if (!item) continue;
    await prisma.platformPlanVersionLimit.create({
      data: {
        planVersionId: version.id,
        catalogItemId: item.id,
        unlimited: limit.unlimited ?? false,
        valueText: limit.unlimited ? null : (limit.valueText ?? '10'),
      },
    });
  }
  return { planId: plan.id, planVersionId: version.id, planCanonicalKey };
}

export async function deletePlanVersionFixtures(prisma: PrismaClient): Promise<void> {
  const plans = await prisma.platformPlan.findMany({
    where: { canonicalKey: { startsWith: 'plan.trial_fixture_' } },
    select: { id: true },
  });
  if (plans.length === 0) return;
  const planIds = plans.map((p) => p.id);
  const versions = await prisma.platformPlanVersion.findMany({
    where: { planId: { in: planIds } },
    select: { id: true },
  });
  const versionIds = versions.map((v) => v.id);
  await prisma.platformPlanVersionEntitlement.deleteMany({
    where: { planVersionId: { in: versionIds } },
  });
  await prisma.platformPlanVersionLimit.deleteMany({
    where: { planVersionId: { in: versionIds } },
  });
  await prisma.platformPlanVersion.deleteMany({ where: { id: { in: versionIds } } });
  await prisma.platformPlan.deleteMany({ where: { id: { in: planIds } } });
}

// ─── Protected SoR snapshot (preview delta proof) ─────────────────────────────

export type ProtectedSoRSnapshot = Record<string, number>;

/**
 * Counts every protected SoR the contract lists for the read-only preview:
 * Trial, Subscription, Plan, PlanVersion, Entitlement, Limit, Add-on, Override,
 * Provisioning, Lifecycle, EER active snapshot.
 */
export async function protectedSoRSnapshot(prisma: PrismaClient): Promise<ProtectedSoRSnapshot> {
  const [
    trials,
    trialExtensions,
    trialConversions,
    commercialConfigs,
    commercialSnapshots,
    commercialChanges,
    subscriptions,
    plans,
    planVersions,
    planEntitlements,
    planLimits,
    addOnVersions,
    overrides,
    addonAssignments,
    overrideAssignments,
    provisioningRequests,
    platformTenants,
    catalogItems,
    outbox,
  ] = await Promise.all([
    prisma.platformSalesTrial.count(),
    prisma.platformSalesTrialExtensionHistory.count(),
    prisma.platformSalesTrialConversion.count(),
    prisma.platformSubscriptionCommercialConfig.count(),
    prisma.platformSubscriptionCommercialSnapshot.count(),
    prisma.platformSubscriptionCommercialChange.count(),
    prisma.platformSubscription.count(),
    prisma.platformPlan.count(),
    prisma.platformPlanVersion.count(),
    prisma.platformPlanVersionEntitlement.count(),
    prisma.platformPlanVersionLimit.count(),
    prisma.platformAddOnVersion.count(),
    prisma.platformCommercialOverride.count(),
    prisma.platformSubscriptionAddOnAssignment.count(),
    prisma.platformSubscriptionOverrideAssignment.count(),
    prisma.platformTenantProvisioningRequest.count(),
    prisma.platformTenant.count(),
    prisma.healthcareCatalogItem.count(),
    prisma.outboxEvent.count(),
  ]);
  return {
    trials,
    trialExtensions,
    trialConversions,
    commercialConfigs,
    commercialSnapshots,
    commercialChanges,
    subscriptions,
    plans,
    planVersions,
    planEntitlements,
    planLimits,
    addOnVersions,
    overrides,
    addonAssignments,
    overrideAssignments,
    provisioningRequests,
    platformTenants,
    catalogItems,
    outbox,
  };
}

export function diffSnapshots(
  before: ProtectedSoRSnapshot,
  after: ProtectedSoRSnapshot,
): Record<string, number> {
  const delta: Record<string, number> = {};
  for (const key of Object.keys(before)) {
    delta[key] = (after[key] ?? 0) - (before[key] ?? 0);
  }
  return delta;
}
