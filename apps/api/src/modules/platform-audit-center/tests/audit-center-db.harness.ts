/**
 * Flexible Step 21 — Audit Center PostgreSQL harness.
 */
import { randomUUID } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { JwtClaimsVO, PLATFORM_TOKEN_AUDIENCE } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from '../../auth/tests/platform-db-security.harness';
import {
  PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME,
  PLATFORM_AUDIT_SENTINEL_SLUG,
  PLATFORM_AUDIT_SENTINEL_TENANT_ID,
} from '../../platform-tenants/platform-tenants.tokens';
import {
  AUDIT_CENTER_FAILURE_INJECTION_ENV,
  AUDIT_CENTER_OPERATIONS,
  AUDIT_CENTER_PERMISSIONS,
} from '../platform-audit-center.constants';
import { AuditEntryFactory } from '../../audit/domain/audit-entry.factory';
import { MATRIX_ACTION_PREFIX } from './audit-center-matrix.constants';
import { createAuditStack, type AuditStack } from './audit-center-stack';
import { createSubscriptionsPrismaWrapper } from '../../platform-subscriptions/tests/platform-subscriptions-db.harness';
import type { PrismaService } from '../../../infrastructure/prisma.service';

export {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
  createAuditStack,
};
export type { AuditStack };

export function createHybridPrisma(prisma: PrismaClient): PrismaService {
  return Object.assign(prisma, createSubscriptionsPrismaWrapper(prisma)) as unknown as PrismaService;
}

export const ALL_AUDIT_PERMS: string[] = [
  AUDIT_CENTER_PERMISSIONS.view,
  AUDIT_CENTER_PERMISSIONS.export,
  AUDIT_CENTER_PERMISSIONS.sensitiveView,
  AUDIT_CENTER_PERMISSIONS.networkMetadataView,
];

export function enableAuditCenter(): () => void {
  const prev = process.env.AUDIT_CENTER_ENABLED;
  process.env.AUDIT_CENTER_ENABLED = 'true';
  return () => {
    if (prev === undefined) delete process.env.AUDIT_CENTER_ENABLED;
    else process.env.AUDIT_CENTER_ENABLED = prev;
  };
}

export function clearAuditFailureInjection(): void {
  delete process.env[AUDIT_CENTER_FAILURE_INJECTION_ENV];
}

export function setAuditFailureInjection(point: string): void {
  process.env[AUDIT_CENTER_FAILURE_INJECTION_ENV] = point;
}

export function platformClaims(sub: string, sessionId: string): JwtClaimsVO {
  return new JwtClaimsVO({
    sub,
    tenantId: null,
    branchId: null,
    roles: [],
    sessionId,
    sessionClass: 'platform',
    principalType: 'platform',
    aud: PLATFORM_TOKEN_AUDIENCE,
    iss: 'booking-platform',
  });
}

export async function ensureSentinel(prisma: PrismaClient): Promise<void> {
  await prisma.tenant.upsert({
    where: { id: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
    create: {
      id: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
      name: PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME,
      slug: PLATFORM_AUDIT_SENTINEL_SLUG,
    },
    update: {},
  });
}

export type SeedAuditEntryOpts = {
  actorId: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  category?: string;
  reason?: string;
  details?: Record<string, unknown>;
  changes?: Record<string, unknown>;
  correlationId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: Date;
  tenantId?: string;
};

export async function seedAuditEntry(prisma: PrismaClient, opts: SeedAuditEntryOpts) {
  await ensureSentinel(prisma);
  const factory = new AuditEntryFactory();
  const id = randomUUID();
  const resourceId = opts.resourceId ?? randomUUID();
  const correlationId = opts.correlationId ?? randomUUID();
  const action = opts.action ?? 'platform.test.action';
  const category = opts.category ?? 'test';
  const reason = opts.reason ?? 'test reason';
  const details = opts.details ?? { note: 'test' };
  const changes = opts.changes ?? { field: { before: 'a', after: 'b' } };
  const tenantId = opts.tenantId ?? PLATFORM_AUDIT_SENTINEL_TENANT_ID;

  const entry = factory.create(
    id,
    tenantId,
    null,
    'en',
    action,
    opts.resourceType ?? 'platform_test',
    resourceId,
    opts.actorId,
    ['platform_owner'],
    details as any,
    changes as any,
    category,
    'Test audit',
    null,
    reason,
    opts.ipAddress ?? null,
    opts.userAgent ?? null,
    correlationId,
  );

  if (opts.createdAt) {
    await prisma.$executeRaw`
      INSERT INTO "audit_entries" (
        "id", "tenantId", "branchId", "actorId", "actorRoles", "action", "resourceType",
        "resourceId", "category", "descriptionEn", "descriptionAr", "details", "changes",
        "reason", "ipAddress", "userAgent", "correlationId", "locale", "createdAt"
      ) VALUES (
        ${id}::uuid, ${tenantId}::uuid, NULL, ${opts.actorId}::uuid,
        ${['platform_owner']}::text[], ${action}, ${opts.resourceType ?? 'platform_test'},
        ${resourceId}::uuid, ${category}, 'Test audit', NULL,
        ${JSON.stringify(details)}::jsonb, ${JSON.stringify(changes)}::jsonb,
        ${reason}, ${opts.ipAddress ?? null}, ${opts.userAgent ?? null},
        ${correlationId}::uuid, 'en', ${opts.createdAt}
      )
    `;
    return prisma.auditEntry.findUniqueOrThrow({ where: { id } });
  }

  return prisma.auditEntry.create({
    data: {
      id: entry.id,
      tenantId: entry.tenantId,
      actorId: entry.actorId,
      actorRoles: entry.actorRoles,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      category: entry.category,
      descriptionEn: 'Test audit',
      descriptionAr: null,
      details: details as Prisma.InputJsonValue,
      changes: changes as Prisma.InputJsonValue,
      reason,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      correlationId: entry.correlationId,
      locale: 'en',
    },
  });
}

/** Idempotent matrix append — skips when action+correlation already exists. */
export async function appendMatrixAuditOnce(
  prisma: PrismaClient,
  opts: SeedAuditEntryOpts & { action: string; correlationId: string },
): Promise<{ created: boolean; row: { id: string } }> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${opts.action} || ${opts.correlationId}))
    `;
    const existing = await tx.auditEntry.findFirst({
      where: { action: opts.action, correlationId: opts.correlationId },
      select: { id: true },
    });
    if (existing) return { created: false, row: existing };
    const row = await seedAuditEntry(tx as unknown as PrismaClient, opts);
    return { created: true, row };
  });
}

export function matrixAction(canonical: string): string {
  return `${MATRIX_ACTION_PREFIX}${canonical}`;
}

export async function cleanupAuditCenterTables(prisma: PrismaClient): Promise<void> {
  assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "platform_audit_export_idempotency",
      "platform_audit_export_records"
    RESTART IDENTITY CASCADE
  `);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`DROP TRIGGER IF EXISTS audit_entries_immutable ON "audit_entries"`);
    await tx.$executeRawUnsafe(`
      DELETE FROM "audit_entries" WHERE
        "category" = 'test'
        OR "action" LIKE 'platform.test.%'
        OR "action" LIKE 'audit.center.matrix.%'
        OR "action" = '${AUDIT_CENTER_OPERATIONS.EXPORT_COMPLETE}'
        OR "action" = '${AUDIT_CENTER_OPERATIONS.EXPORT_FAIL}'
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

/** Ensure append-only trigger exists for immutability proofs (I05–I09). */
export async function ensureAuditImmutabilityTrigger(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION prevent_audit_modification()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'audit_entries is append-only. Operation % is forbidden on this table.', TG_OP;
    END;
    $$ LANGUAGE plpgsql;
  `);
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS audit_entries_immutable ON audit_entries`);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER audit_entries_immutable
      BEFORE UPDATE OR DELETE ON audit_entries
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification()
  `);
}

/** Execute export with preview fingerprint helper. */
export async function executeExport(
  stack: AuditStack,
  claims: JwtClaimsVO,
  opts: { filters?: Record<string, unknown>; reason: string; idempotencyKey: string },
) {
  const filters = opts.filters ?? {};
  const preview = await stack.exports.preview(
    { filters, reason: opts.reason, filterFingerprint: '' },
    stack.perms,
  );
  return stack.exports.execute(
    claims,
    { filters, reason: opts.reason, filterFingerprint: preview.filterFingerprint },
    stack.perms,
    opts.idempotencyKey,
  );
}

export async function countSuccessAudits(
  prisma: PrismaClient,
  action: string,
  correlationId?: string,
): Promise<number> {
  return prisma.auditEntry.count({
    where: {
      action,
      ...(correlationId ? { correlationId } : {}),
    },
  });
}
