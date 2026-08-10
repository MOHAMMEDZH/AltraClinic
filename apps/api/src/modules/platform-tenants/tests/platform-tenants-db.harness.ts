/**
 * Safe isolated PostgreSQL harness for Release 47 Step 11 tenant directory tests.
 */
import {
  PrismaClient,
  Prisma,
  type EntitlementPlan,
  type PlatformRegion,
  type PlatformTenantStatus,
  type SubscriptionStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
  withPlatformDbRetry,
} from '../../auth/tests/platform-db-security.harness';

export {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
};

const FIXTURE_SLUG_PREFIX = 'pt-fixt-';
const FIXTURE_COUNT = 82;
export const TIE_BREAK_DISPLAY_NAME = 'PT Tie-Break Clinic';

export async function cleanupPlatformTenantsTables(
  prisma: PrismaClient,
  url = DEFAULT_PLATFORM_DB_SECURITY_URL,
): Promise<void> {
  assertSafePlatformTestDatabaseUrl(url);
  await withPlatformDbRetry(prisma, async () => {
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
  });
}

export interface TenantDirectoryFixture {
  readonly platformTenantId: string;
  readonly tenantId: string;
  readonly displayName: string;
  readonly slug: string;
  readonly facilityType: string;
  readonly legacyPlan: EntitlementPlan;
  readonly subscriptionStatus: SubscriptionStatus;
  readonly status: PlatformTenantStatus;
  readonly region: PlatformRegion;
}

const STATUSES: PlatformTenantStatus[] = ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'];
const REGIONS: PlatformRegion[] = ['ME_SOUTH', 'ME_NORTH', 'EU_WEST', 'US_EAST', 'GLOBAL'];
const PLANS: EntitlementPlan[] = ['LITE', 'PRO', 'ENTERPRISE'];
const FACILITY_TYPES = ['medical', 'dental', 'beauty', 'multi', 'unclassified'] as const;
const SUB_STATUSES: SubscriptionStatus[] = ['TRIAL', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED'];

function featuresForFacilityType(facilityType: string): Prisma.InputJsonValue {
  if (facilityType === 'unclassified') {
    return {};
  }
  return { clinicProfile: { clinicType: facilityType } };
}

function trialEndsAtForIndex(index: number): Date | null {
  if (index % 3 === 0) return null;
  if (index % 3 === 1) return new Date(Date.now() + 86_400_000 * 30);
  return new Date(Date.now() - 86_400_000 * 7);
}

export async function seedTenantDirectoryFixtures(prisma: PrismaClient): Promise<TenantDirectoryFixture[]> {
  const fixtures: TenantDirectoryFixture[] = [];

  for (let i = 0; i < FIXTURE_COUNT; i++) {
    const facilityType = FACILITY_TYPES[i % FACILITY_TYPES.length];
    const status = STATUSES[i % STATUSES.length];
    const region = REGIONS[i % REGIONS.length];
    const plan = PLANS[i % PLANS.length];
    const subscriptionStatus = SUB_STATUSES[i % SUB_STATUSES.length];
    const displayName = i < 4 ? TIE_BREAK_DISPLAY_NAME : `PT Fixture ${String(i).padStart(3, '0')}`;
    const slug = `${FIXTURE_SLUG_PREFIX}${String(i).padStart(3, '0')}`;

    const tenant = await prisma.tenant.create({
      data: {
        name: displayName,
        slug,
        features: featuresForFacilityType(facilityType),
      },
    });

    const platformTenant = await prisma.platformTenant.create({
      data: {
        tenantId: tenant.id,
        displayName,
        region,
        plan,
        status,
        provisionedBy: randomUUID(),
        trialEndsAt: trialEndsAtForIndex(i),
      },
    });

    await prisma.platformSubscription.create({
      data: {
        platformTenantId: platformTenant.id,
        plan,
        status: subscriptionStatus,
        pricePerMonth: 49 + (i % 50),
        startDate: new Date(Date.now() - i * 86_400_000),
        endDate: new Date(Date.now() + 365 * 86_400_000),
      },
    });

    fixtures.push({
      platformTenantId: platformTenant.id,
      tenantId: tenant.id,
      displayName,
      slug,
      facilityType,
      legacyPlan: plan,
      subscriptionStatus,
      status,
      region,
    });
  }

  return fixtures;
}

export function createTenantsPrismaWrapper(prisma: PrismaClient) {
  return {
    withPlatformBypass: async <T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> => fn(prisma),
  };
}
