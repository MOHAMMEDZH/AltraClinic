/**
 * Safe isolated PostgreSQL harness for Release 47 Step 10 dashboard reconciliation tests.
 *
 * Reuses URL/safety guards from the platform DB security harness.
 * Requires docker-compose.test.yml postgres on :5433 (database booking_test).
 */
import { PrismaClient, type EntitlementPlan, type PlatformTenantStatus, type SubscriptionStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from '../../auth/tests/platform-db-security.harness';

export {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
};

const FIXTURE_SLUG_PREFIX = 'pd-fixt-';

/** Deterministic cleanup — platform tables + fixture tenants only. */
export async function cleanupPlatformDashboardTables(
  prisma: PrismaClient,
  url = DEFAULT_PLATFORM_DB_SECURITY_URL,
): Promise<void> {
  assertSafePlatformTestDatabaseUrl(url);
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "platform_subscriptions",
      "privileged_access_grants",
      "platform_tenants"
    RESTART IDENTITY CASCADE
  `);
  await prisma.tenant.deleteMany({
    where: { slug: { startsWith: FIXTURE_SLUG_PREFIX } },
  });
}

export interface DashboardFixtureExpectations {
  readonly platformTenantTotal: number;
  readonly tenantByStatus: Record<'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED', number>;
  readonly tenantTrialing: number;
  readonly legacyPlan: Record<'LITE' | 'PRO' | 'ENTERPRISE', number>;
  readonly subscriptionByStatus: Record<
    'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED',
    number
  >;
  readonly subscriptionTotal: number;
  /** Increment contributed by pd-fixt-* tenant rows only (shared DB may have other tenants). */
  readonly facilityTypeDelta: Record<'medical' | 'dental' | 'beauty' | 'multi' | 'unclassified', number>;
  readonly facilityTypeDeltaTotal: number;
}

export interface SeedDashboardFixturesResult {
  readonly expectations: DashboardFixtureExpectations;
  readonly provisionedBy: string;
}

function dayOffsetMs(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

async function createFixtureTenant(
  prisma: PrismaClient,
  slugSuffix: string,
  features: unknown,
  deletedAt: Date | null = null,
) {
  return prisma.tenant.create({
    data: {
      name: `PD Fixture ${slugSuffix}`,
      slug: `${FIXTURE_SLUG_PREFIX}${slugSuffix}`,
      features: (features ?? {}) as object,
      deletedAt,
    },
  });
}

async function createFixturePlatformTenant(
  prisma: PrismaClient,
  tenantId: string,
  opts: {
    displayName: string;
    status: PlatformTenantStatus;
    plan: EntitlementPlan;
    trialEndsAt?: Date | null;
    region?: 'ME_SOUTH' | 'GLOBAL';
    provisionedBy: string;
  },
) {
  return prisma.platformTenant.create({
    data: {
      tenantId,
      displayName: opts.displayName,
      region: opts.region ?? 'ME_SOUTH',
      plan: opts.plan,
      status: opts.status,
      provisionedBy: opts.provisionedBy,
      trialEndsAt: opts.trialEndsAt ?? null,
    },
  });
}

async function createFixtureSubscription(
  prisma: PrismaClient,
  platformTenantId: string,
  status: SubscriptionStatus,
  plan: EntitlementPlan = 'LITE',
) {
  const now = new Date();
  return prisma.platformSubscription.create({
    data: {
      platformTenantId,
      plan,
      status,
      pricePerMonth: 99,
      startDate: now,
      endDate: dayOffsetMs(365),
    },
  });
}

/**
 * Seeds a deterministic fixture matrix for dashboard reconciliation.
 * Uses ±24h margins around trialEndsAt to avoid flaky boundary tests.
 */
export async function seedDashboardFixtures(prisma: PrismaClient): Promise<SeedDashboardFixturesResult> {
  const provisionedBy = randomUUID();
  const futureTrial = dayOffsetMs(1);
  const pastTrial = dayOffsetMs(-1);

  const tProvisioning = await createFixtureTenant(prisma, 'prov', { clinicProfile: { clinicType: 'medical' } });
  const tActiveTrialing = await createFixtureTenant(prisma, 'active-trial', { clinicProfile: { clinicType: 'dental' } });
  const tActivePastTrial = await createFixtureTenant(prisma, 'active-past', { clinicProfile: { clinicType: 'beauty' } });
  const tActiveNoTrial = await createFixtureTenant(prisma, 'active-no-trial', { clinicProfile: { clinicType: 'multi' } });
  const tSuspendedTrialing = await createFixtureTenant(prisma, 'susp-trial', { clinicProfile: { clinicType: 'unknown-clinic' } });
  const tArchivedFutureTrial = await createFixtureTenant(prisma, 'arch-trial', {});

  const ptProvisioning = await createFixturePlatformTenant(prisma, tProvisioning.id, {
    displayName: 'PD Provisioning',
    status: 'PROVISIONING',
    plan: 'LITE',
    provisionedBy,
  });
  const ptActiveTrialing = await createFixturePlatformTenant(prisma, tActiveTrialing.id, {
    displayName: 'PD Active Trialing',
    status: 'ACTIVE',
    plan: 'PRO',
    trialEndsAt: futureTrial,
    provisionedBy,
  });
  const ptActivePastTrial = await createFixturePlatformTenant(prisma, tActivePastTrial.id, {
    displayName: 'PD Active Past Trial',
    status: 'ACTIVE',
    plan: 'ENTERPRISE',
    trialEndsAt: pastTrial,
    region: 'GLOBAL',
    provisionedBy,
  });
  await createFixturePlatformTenant(prisma, tActiveNoTrial.id, {
    displayName: 'PD Active No Trial',
    status: 'ACTIVE',
    plan: 'LITE',
    trialEndsAt: null,
    provisionedBy,
  });
  await createFixturePlatformTenant(prisma, tSuspendedTrialing.id, {
    displayName: 'PD Suspended Trialing',
    status: 'SUSPENDED',
    plan: 'PRO',
    trialEndsAt: futureTrial,
    provisionedBy,
  });
  await createFixturePlatformTenant(prisma, tArchivedFutureTrial.id, {
    displayName: 'PD Archived Future Trial',
    status: 'ARCHIVED',
    plan: 'ENTERPRISE',
    trialEndsAt: futureTrial,
    provisionedBy,
  });

  await createFixtureTenant(prisma, 'fac-missing', {});
  // Schema: tenants.features is NOT NULL — "null clinicType" is JSON null inside the object.
  await createFixtureTenant(prisma, 'fac-null-type', {
    clinicProfile: { clinicType: null },
  });
  await createFixtureTenant(prisma, 'fac-wrong', { notClinicProfile: true });
  await createFixtureTenant(prisma, 'fac-deleted', { clinicProfile: { clinicType: 'medical' } }, new Date());

  await createFixtureSubscription(prisma, ptProvisioning.id, 'TRIAL');
  await createFixtureSubscription(prisma, ptActiveTrialing.id, 'ACTIVE');
  await createFixtureSubscription(prisma, ptActivePastTrial.id, 'SUSPENDED');
  await createFixtureSubscription(prisma, ptActiveTrialing.id, 'EXPIRED');
  await createFixtureSubscription(prisma, ptActivePastTrial.id, 'CANCELLED');

  const expectations: DashboardFixtureExpectations = {
    platformTenantTotal: 6,
    tenantByStatus: {
      PROVISIONING: 1,
      ACTIVE: 3,
      SUSPENDED: 1,
      ARCHIVED: 1,
    },
    tenantTrialing: 2,
    legacyPlan: {
      LITE: 2,
      PRO: 2,
      ENTERPRISE: 2,
    },
    subscriptionByStatus: {
      TRIAL: 1,
      ACTIVE: 1,
      SUSPENDED: 1,
      EXPIRED: 1,
      CANCELLED: 1,
    },
    subscriptionTotal: 5,
    facilityTypeDelta: {
      medical: 1,
      dental: 1,
      beauty: 1,
      multi: 1,
      unclassified: 5,
    },
    facilityTypeDeltaTotal: 9,
  };

  return { expectations, provisionedBy };
}

/** Minimal prisma wrapper matching PlatformDashboardService's bypass contract. */
export function createDashboardPrismaWrapper(prisma: PrismaClient) {
  return {
    withPlatformBypass: async <T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> => fn(prisma),
  };
}
