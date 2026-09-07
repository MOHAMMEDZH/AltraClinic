/**
 * Flexible Step 23 — Sales Representative Management PostgreSQL harness.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import type { JwtConfig } from '../../auth/infrastructure/services/jwt-token.service';
import { JwtClaimsVO, PLATFORM_TOKEN_AUDIENCE } from '../../auth/domain/value-objects/jwt-claims.vo';
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
import { SALES_FAILURE_INJECTION_ENV } from '../platform-sales-representatives.constants';

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

/** Role carrying sales-representative.view + sales-representative.manage (platform_owner explicitly excludes sales-*). */
export const SALES_MANAGER_ROLE = 'sales_manager';
/** Default sales representative role — has NO sales-representative.view/manage of its own. */
export const SALES_REP_ROLE = 'sales_representative';

export function createHybridPrisma(prisma: PrismaClient): PrismaService {
  return Object.assign(prisma, createSubscriptionsPrismaWrapper(prisma)) as unknown as PrismaService;
}

export function clearSalesFailureInjection(): void {
  delete process.env[SALES_FAILURE_INJECTION_ENV];
}

export function setSalesFailureInjection(point: string): void {
  process.env[SALES_FAILURE_INJECTION_ENV] = point;
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

export async function cleanupSalesRepresentativeTables(prisma: PrismaClient): Promise<void> {
  assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
  await prisma.platformSalesIdempotencyRecord.deleteMany({});
  await prisma.platformSalesCustomerOwnershipHistory.deleteMany({});
  await prisma.platformSalesCustomerOwnership.deleteMany({});
  await prisma.platformSalesRepresentative.deleteMany({});
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`DROP TRIGGER IF EXISTS audit_entries_immutable ON "audit_entries"`);
    await tx.$executeRawUnsafe(`
      DELETE FROM "audit_entries" WHERE "category" = 'sales_representative_management'
    `);
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

export async function countSalesAudits(prisma: PrismaClient, action: string): Promise<number> {
  return prisma.auditEntry.count({ where: { action, category: 'sales_representative_management' } });
}

export async function createTenantFixture(
  prisma: PrismaClient,
  opts: { name?: string; provisionedBy?: string } = {},
) {
  const slug = `sales-tenant-${randomUUID().slice(0, 8)}`;
  const tenant = await prisma.tenant.create({
    data: { name: opts.name ?? 'Sales Test Tenant', slug, features: {} },
  });
  const platformTenant = await prisma.platformTenant.create({
    data: {
      tenantId: tenant.id,
      displayName: opts.name ?? 'Sales Test Tenant',
      region: 'GLOBAL' as never,
      provisionedBy: opts.provisionedBy ?? randomUUID(),
    },
  });
  return { tenant, platformTenant };
}
