/**
 * Flexible Step 22 — Operations Console PostgreSQL harness.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import type { JwtConfig } from '../../auth/infrastructure/services/jwt-token.service';
import { JwtClaimsVO, PLATFORM_TOKEN_AUDIENCE } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from '../../auth/tests/platform-db-security.harness';
import { createSubscriptionsPrismaWrapper } from '../../platform-subscriptions/tests/platform-subscriptions-db.harness';
import type { PrismaService } from '../../../infrastructure/prisma.service';
import {
  OPERATIONS_CONSOLE_FAILURE_INJECTION_ENV,
  OPERATIONS_CONSOLE_ENABLED_ENV,
} from '../platform-operations-console.constants';
import { createOpsStack, type OpsStack } from './operations-console-stack';

export {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
  createOpsStack,
};
export type { OpsStack };

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

export function createHybridPrisma(prisma: PrismaClient): PrismaService {
  return Object.assign(prisma, createSubscriptionsPrismaWrapper(prisma)) as unknown as PrismaService;
}

export function enableOpsConsole(): () => void {
  const prev = process.env[OPERATIONS_CONSOLE_ENABLED_ENV];
  process.env[OPERATIONS_CONSOLE_ENABLED_ENV] = 'true';
  return () => {
    if (prev === undefined) delete process.env[OPERATIONS_CONSOLE_ENABLED_ENV];
    else process.env[OPERATIONS_CONSOLE_ENABLED_ENV] = prev;
  };
}

export function clearOpsFailureInjection(): void {
  delete process.env[OPERATIONS_CONSOLE_FAILURE_INJECTION_ENV];
}

export function setOpsFailureInjection(point: string): void {
  process.env[OPERATIONS_CONSOLE_FAILURE_INJECTION_ENV] = point;
}

export function platformClaims(
  sub: string,
  sessionId: string,
  actorRoles: string[] = ['operations_engineer'],
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

export async function cleanupOpsConsoleTables(prisma: PrismaClient): Promise<void> {
  assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
  await prisma.platformOperationsIdempotencyRecord.deleteMany({});
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`DROP TRIGGER IF EXISTS audit_entries_immutable ON "audit_entries"`);
    await tx.$executeRawUnsafe(`
      DELETE FROM "audit_entries" WHERE "category" = 'operations_console'
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

export async function countOpsAudits(prisma: PrismaClient, action: string): Promise<number> {
  return prisma.auditEntry.count({ where: { action, category: 'operations_console' } });
}
