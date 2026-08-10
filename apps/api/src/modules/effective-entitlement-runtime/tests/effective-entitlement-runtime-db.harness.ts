/**
 * Safe isolated PostgreSQL harness for Step 17 Effective Entitlement Runtime tests.
 * Reuses Step 16 commercial cleanup + fixture helpers; no new Prisma models.
 */
import { PrismaClient } from '@prisma/client';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupFixtureRuntimeSubscriptions,
  cleanupPlatformSubscriptionCommercialTables,
  createPlatformDbSecurityClient,
  createSubscriptionsService,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  ensurePlatformSubscriptionFixtures,
  platformDbSecurityEnabled,
  ALL_SUBSCRIPTION_PERMS,
  FakeSubscriptionAuditLog,
} from '../../platform-subscriptions/tests/platform-subscriptions-db.harness';
import { EffectiveEntitlementRuntimeService } from '../application/effective-entitlement-runtime.service';
import type { PrismaService } from '../../../infrastructure/prisma.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { randomUUID } from 'crypto';

export {
  assertSafePlatformTestDatabaseUrl,
  cleanupFixtureRuntimeSubscriptions,
  cleanupPlatformSubscriptionCommercialTables,
  createPlatformDbSecurityClient,
  createSubscriptionsService,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  ensurePlatformSubscriptionFixtures,
  platformDbSecurityEnabled,
  ALL_SUBSCRIPTION_PERMS,
  FakeSubscriptionAuditLog,
};

/** Step 17 adds zero schema objects — evidence list for migration/docs assertions. */
export const STEP17_FORBIDDEN_TABLES = [
  'platform_effective_entitlement_runtime',
  'platform_effective_entitlements',
  'effective_entitlement_cache',
  'platform_runtime_entitlement_decisions',
] as const;

/** Step 19 billing tables must remain absent. U01 usage tables (historical migration …_step18_usage_metering) are allowed after migration. */
export const STEP18_FORBIDDEN_TABLES = [
  'platform_billing_runtime',
  'platform_invoice',
  'platform_payment',
  'platform_overage_charge',
] as const;

export const STEP16_COMMERCIAL_TABLES = [
  'platform_subscription_commercial_configs',
  'platform_subscription_commercial_snapshots',
  'platform_subscription_addon_assignments',
  'platform_subscription_override_assignments',
  'platform_subscription_commercial_changes',
  'platform_subscription_commercial_idempotency',
] as const;

export function createRuntimeService(prisma: PrismaClient): EffectiveEntitlementRuntimeService {
  return new EffectiveEntitlementRuntimeService(prisma as unknown as PrismaService);
}

export function claims(sub = randomUUID()): JwtClaimsVO {
  return {
    sub,
    sessionId: randomUUID(),
    principalType: 'platform',
    aud: 'platform',
    iss: 'booking-platform',
    roles: [],
  } as unknown as JwtClaimsVO;
}

export async function assertStep17SchemaUnchanged(prisma: PrismaClient): Promise<void> {
  for (const table of STEP17_FORBIDDEN_TABLES) {
    const rows = await prisma.$queryRawUnsafe<Array<{ present: boolean }>>(
      `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
    );
    if (rows[0]?.present) {
      throw new Error(`Step 17 must not introduce table: ${table}`);
    }
  }
  for (const table of STEP18_FORBIDDEN_TABLES) {
    const rows = await prisma.$queryRawUnsafe<Array<{ present: boolean }>>(
      `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
    );
    if (rows[0]?.present) {
      throw new Error(`Step 19 schema must remain absent: ${table}`);
    }
  }
  for (const table of STEP16_COMMERCIAL_TABLES) {
    const rows = await prisma.$queryRawUnsafe<Array<{ present: boolean }>>(
      `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
    );
    if (!rows[0]?.present) {
      throw new Error(`Step 16 table missing (Step 17 reuses it): ${table}`);
    }
  }
}

/** Temporarily allow multiple isCurrent rows to exercise fail-closed ambiguous probe. */
export async function withAmbiguousCurrentAllowed<T>(
  prisma: PrismaClient,
  fn: () => Promise<T>,
): Promise<T> {
  await prisma.$executeRawUnsafe(
    `DROP INDEX IF EXISTS platform_subscription_commercial_one_current_per_tenant`,
  );
  try {
    return await fn();
  } finally {
    // Restore uniqueness: keep at most one current row per tenant before recreating index.
    await prisma.$executeRawUnsafe(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY "platformTenantId"
                 ORDER BY "updatedAt" DESC, id DESC
               ) AS rn
        FROM platform_subscription_commercial_configs
        WHERE "isCurrent" = true
      )
      UPDATE platform_subscription_commercial_configs c
      SET "isCurrent" = false
      FROM ranked r
      WHERE c.id = r.id AND r.rn > 1
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS platform_subscription_commercial_one_current_per_tenant
        ON platform_subscription_commercial_configs ("platformTenantId")
        WHERE "isCurrent" = true
    `);
  }
}

export async function clinicTenantIdFor(
  prisma: PrismaClient,
  platformTenantId: string,
): Promise<string> {
  const pt = await prisma.platformTenant.findUniqueOrThrow({
    where: { id: platformTenantId },
    select: { tenantId: true },
  });
  return pt.tenantId;
}

export async function createSecondPlatformTenant(prisma: PrismaClient): Promise<{
  platformTenantId: string;
  clinicTenantId: string;
}> {
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Step17 Cross Tenant',
      slug: `s17-x-${randomUUID().slice(0, 8)}`,
      features: {},
    },
  });
  const platformTenant = await prisma.platformTenant.create({
    data: {
      tenantId: tenant.id,
      displayName: 'Step17 Cross Tenant',
      region: 'ME_SOUTH',
      plan: 'PRO',
      status: 'ACTIVE',
      provisionedBy: randomUUID(),
    },
  });
  return { platformTenantId: platformTenant.id, clinicTenantId: tenant.id };
}

export async function activateCommercialFixture(opts: {
  prisma: PrismaClient;
  platformTenantId: string;
  publishedPlanVersionId: string;
  idemPrefix?: string;
}): Promise<{ configId: string; snapshotId: string; fingerprint: string }> {
  const service = createSubscriptionsService({
    prisma: opts.prisma,
    permissions: ALL_SUBSCRIPTION_PERMS,
    stepUpFresh: true,
  });
  const actor = claims();
  const prefix = opts.idemPrefix ?? randomUUID().slice(0, 8);
  const created = await service.create(
    actor,
    { platformTenantId: opts.platformTenantId },
    `${prefix}-create`,
  );
  const assigned = await service.assignPlanVersion(
    actor,
    created.id,
    {
      expectedRowVersion: created.rowVersion,
      planVersionId: opts.publishedPlanVersionId,
    },
    `${prefix}-plan`,
  );
  const activated = await service.activate(
    actor,
    created.id,
    { expectedRowVersion: assigned.rowVersion, reason: 'step17 activate' },
    `${prefix}-act`,
  );
  const snap = await opts.prisma.platformSubscriptionCommercialSnapshot.findUniqueOrThrow({
    where: { configId: activated.id },
  });
  return {
    configId: activated.id,
    snapshotId: snap.id,
    fingerprint: snap.fingerprint,
  };
}
