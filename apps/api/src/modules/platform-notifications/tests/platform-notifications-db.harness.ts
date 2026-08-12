/**
 * Flexible Step 27 — Notifications and Templates PostgreSQL harness.
 * Contract: docs/NOTIFICATIONS_AND_TEMPLATES.md
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { JwtClaimsVO, PLATFORM_TOKEN_AUDIENCE } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from '../../auth/tests/platform-db-security.harness';
import type { PrismaService } from '../../../infrastructure/prisma.service';
import {
  PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME,
  PLATFORM_AUDIT_SENTINEL_SLUG,
  PLATFORM_AUDIT_SENTINEL_TENANT_ID,
} from '../../platform-tenants/platform-tenants.tokens';
import { PLATFORM_NOTIFICATION_AUDIT_CATEGORY, PLATFORM_NOTIFICATION_FAILURE_INJECTION_ENV } from '../platform-notifications.constants';
import type { TransactionalEmailService } from '../../../infrastructure/transactional-email.service';

export {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
};

export const JWT_CFG = {
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

export const NOTIFICATIONS_ADMIN_ROLE = 'platform_administrator';

/**
 * Hybrid PrismaService-shaped wrapper: raw PrismaClient + the subset of PrismaService
 * surface the notifications delivery pipeline actually calls (withPlatformBypass,
 * withTenantContext, getRootClient). The `booking` test-database role is a Postgres
 * superuser (see docker/postgres-test-init) and therefore already bypasses RLS, so
 * these wrappers only need to be functionally present (matching call shape/behavior),
 * not perform real session-scoped enforcement.
 */
export function createHybridPrisma(prisma: PrismaClient): PrismaService {
  const txOpts = { maxWait: 20_000, timeout: 60_000 };
  const wrapper = {
    withPlatformBypass: async <T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
        return fn(tx as unknown as PrismaClient);
      }, txOpts),
    withTenantContext: async <T>(tenantId: string, fn: (client: PrismaClient) => Promise<T>): Promise<T> =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
        await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'false', true)`;
        return fn(tx as unknown as PrismaClient);
      }, txOpts),
    withResolvedTenantContext: async <T>(tenantId: string | undefined, fn: (client: PrismaClient) => Promise<T>): Promise<T> => {
      if (!tenantId) throw new Error('withResolvedTenantContext requires a tenantId in this harness');
      return wrapper.withTenantContext(tenantId, fn);
    },
    getRootClient: (): PrismaClient => prisma,
  };
  return Object.assign(prisma, wrapper) as unknown as PrismaService;
}

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
      if (!/^(BEGIN|COMMIT|ROLLBACK|SET |SELECT 1|DEALLOCATE)/i.test(ev.query.trim())) count += 1;
    },
  );
  return { client, counted: () => count, reset: () => (count = 0) };
}

/**
 * Records outbound "emails" in-memory instead of logging to console / SMTP / Resend.
 * Contract proof: realExternalDeliveriesDuringTests remains 0 for the entire process.
 * Any call that would initialize a real network provider must never reach this sink —
 * the Step 27 stack substitutes TransactionalEmailService with this recorder only.
 */
export class RecordingTransactionalEmailService implements Pick<TransactionalEmailService, 'send'> {
  /** Always 0 — this sink never dials a real provider. Asserted by P11/C14/H40/XD01. */
  realExternalDeliveriesDuringTests = 0;
  /** Always 0 — no production SMTP/Resend client is constructed in the Step 27 stack. */
  realProviderInitializationsDuringTests = 0;
  readonly sent: Array<{
    to: string;
    subject: string;
    text: string;
    html?: string;
    fromName?: string;
    idempotencyKey?: string;
  }> = [];
  /** Keys that have already been logically accepted by this sink (messageId-based dedupe). */
  readonly logicalAcceptedKeys = new Set<string>();
  /** Count of first-accept sends (excludes idempotent suppressions). */
  logicalAcceptedSendCount = 0;
  /** Count of send() calls suppressed because the idempotencyKey was already accepted. */
  idempotentReplaySuppressions = 0;

  async send(input: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    fromName?: string;
    idempotencyKey?: string;
  }): Promise<void> {
    // Test recipients only — reject any accidental non-test domain to keep the guard hard.
    if (!/@test\.local$/i.test(input.to) && !/@example\.(com|org|net)$/i.test(input.to)) {
      throw new Error(
        `RecordingTransactionalEmailService refused non-test recipient: ${input.to}`,
      );
    }
    const key = input.idempotencyKey?.trim();
    if (key && this.logicalAcceptedKeys.has(key)) {
      this.idempotentReplaySuppressions += 1;
      return;
    }
    this.sent.push(input);
    if (key) {
      this.logicalAcceptedKeys.add(key);
      this.logicalAcceptedSendCount += 1;
    } else {
      this.logicalAcceptedSendCount += 1;
    }
    // Intentionally do NOT increment realExternalDeliveriesDuringTests — this is a fake sink.
  }

  reset(): void {
    this.sent.length = 0;
    this.logicalAcceptedKeys.clear();
    this.logicalAcceptedSendCount = 0;
    this.idempotentReplaySuppressions = 0;
    this.realExternalDeliveriesDuringTests = 0;
    this.realProviderInitializationsDuringTests = 0;
  }
}

export function clearPlatformNotificationFailureInjection(): void {
  delete process.env[PLATFORM_NOTIFICATION_FAILURE_INJECTION_ENV];
}

export function setPlatformNotificationFailureInjection(point: string): void {
  process.env[PLATFORM_NOTIFICATION_FAILURE_INJECTION_ENV] = point;
}

export function platformClaims(sub: string, sessionId: string, actorRoles: string[] = [NOTIFICATIONS_ADMIN_ROLE]): JwtClaimsVO {
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

/** Upserts the Platform audit-sentinel Tenant row (FK target for sentinel-scoped rows). */
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

export async function createClinicTenantFixture(
  prisma: PrismaClient,
  opts: { name?: string; slugPrefix?: string } = {},
) {
  const slug = `${opts.slugPrefix ?? 'notif'}-${randomUUID().slice(0, 8)}`;
  const tenant = await prisma.tenant.create({
    data: { name: opts.name ?? 'Notifications Clinic Tenant', slug, features: {} },
  });
  const platformTenant = await prisma.platformTenant.create({
    data: {
      tenantId: tenant.id,
      displayName: opts.name ?? 'Notifications Clinic Tenant',
      region: 'GLOBAL' as never,
      provisionedBy: randomUUID(),
    },
  });
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `clinic-user-${randomUUID().slice(0, 8)}@test.local`,
      passwordHash: 'x',
      firstName: 'Clinic',
      lastName: 'User',
    },
  });
  return { tenant, platformTenant, user };
}

export async function createCommercialConfigFixture(
  prisma: PrismaClient,
  opts: {
    platformTenantId: string;
    createdByPlatformUserId: string;
    commercialEnd?: Date | null;
    lifecycle?: 'DRAFT' | 'ACTIVE_COMMERCIAL' | 'CANCELLED';
  },
) {
  return prisma.platformSubscriptionCommercialConfig.create({
    data: {
      platformTenantId: opts.platformTenantId,
      createdByPlatformUserId: opts.createdByPlatformUserId,
      lifecycle: opts.lifecycle ?? 'ACTIVE_COMMERCIAL',
      isCurrent: true,
      commercialStart: new Date('2026-01-01T00:00:00.000Z'),
      commercialEnd: opts.commercialEnd ?? null,
    },
  });
}

export async function createAddOnVersionFixture(prisma: PrismaClient, opts: { canonicalKey?: string } = {}) {
  const addOn = await prisma.platformAddOn.create({
    data: { canonicalKey: opts.canonicalKey ?? `addon.notif.${randomUUID().slice(0, 8)}` },
  });
  return prisma.platformAddOnVersion.create({
    data: { addOnId: addOn.id, versionNumber: 1, lifecycle: 'PUBLISHED', publishedAt: new Date() },
  });
}

export async function createAddOnAssignmentFixture(
  prisma: PrismaClient,
  opts: { configId: string; addOnVersionId: string },
) {
  return prisma.platformSubscriptionAddOnAssignment.create({
    data: { configId: opts.configId, addOnVersionId: opts.addOnVersionId },
  });
}

export async function createOverrideFixture(
  prisma: PrismaClient,
  opts: { createdByPlatformUserId: string; expiresAt?: Date | null; lifecycle?: 'DRAFT' | 'APPROVED' },
) {
  return prisma.platformCommercialOverride.create({
    data: {
      lifecycle: opts.lifecycle ?? 'APPROVED',
      reasonCode: 'SALES_CONCESSION',
      reasonNote: 'step27 fixture',
      createdByPlatformUserId: opts.createdByPlatformUserId,
      expiresAt: opts.expiresAt ?? null,
    },
  });
}

export async function createOverrideAssignmentFixture(
  prisma: PrismaClient,
  opts: { configId: string; overrideId: string },
) {
  return prisma.platformSubscriptionOverrideAssignment.create({
    data: { configId: opts.configId, overrideId: opts.overrideId },
  });
}

/** Deterministic cleanup of Step 27 + Phase 41d delivery tables + fixtures created for these suites. */
export async function cleanupPlatformNotificationsTables(prisma: PrismaClient): Promise<void> {
  assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "platform_notification_preferences",
      "notification_dead_letters",
      "notification_receipts",
      "notification_delivery_attempts",
      "notification_delivery_jobs",
      "notification_messages",
      "notification_intents"
    RESTART IDENTITY CASCADE
  `);
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "platform_subscription_addon_assignments",
      "platform_subscription_override_assignments",
      "platform_subscription_commercial_configs",
      "platform_commercial_overrides",
      "platform_addon_versions",
      "platform_addons"
    RESTART IDENTITY CASCADE
  `);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`DROP TRIGGER IF EXISTS audit_entries_immutable ON "audit_entries"`);
    await tx.$executeRawUnsafe(
      `DELETE FROM "audit_entries" WHERE "category" = '${PLATFORM_NOTIFICATION_AUDIT_CATEGORY}'`,
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
  const notifTenants = await prisma.tenant.findMany({
    where: { slug: { startsWith: 'notif-' } },
    select: { id: true },
  });
  if (notifTenants.length > 0) {
    const tenantIds = notifTenants.map((t) => t.id);
    await prisma.communicationDispatchLedger.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.notification.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.platformTenant.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  }
  await prisma.communicationDispatchLedger.deleteMany({ where: { tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID } });
}

export async function countNotificationAudits(prisma: PrismaClient, action: string): Promise<number> {
  return prisma.auditEntry.count({ where: { action, category: PLATFORM_NOTIFICATION_AUDIT_CATEGORY } });
}

export async function countNotificationAuditsFor(
  prisma: PrismaClient,
  action: string,
  resourceId: string,
): Promise<number> {
  return prisma.auditEntry.count({ where: { action, resourceId, category: PLATFORM_NOTIFICATION_AUDIT_CATEGORY } });
}

/** Full delivery artifact graph for an intentId — jobs/attempts/receipts. */
export async function getDeliveryArtifacts(prisma: PrismaClient, intentId: string) {
  const intent = await prisma.notificationIntent.findUnique({ where: { id: intentId } });
  const message = await prisma.notificationMessage.findFirst({ where: { intentId } });
  const jobs = await prisma.deliveryJob.findMany({ where: { intentId }, orderBy: { id: 'asc' } });
  const jobIds = jobs.map((j) => j.id);
  const attempts = jobIds.length
    ? await prisma.deliveryAttempt.findMany({ where: { jobId: { in: jobIds } }, orderBy: { attemptedAt: 'asc' } })
    : [];
  const receipts = jobIds.length
    ? await prisma.notificationReceipt.findMany({ where: { jobId: { in: jobIds } } })
    : [];
  return { intent, message, jobs, attempts, receipts };
}

/** Protected business SoR counts — dispatch must never mutate these. */
export type ProtectedNotificationSoR = Record<string, number>;

export async function protectedNotificationsSoR(prisma: PrismaClient): Promise<ProtectedNotificationSoR> {
  const [
    platformUsers,
    platformUserRoles,
    tenants,
    platformTenants,
    commercialConfigs,
    addOns,
    overrides,
    salesLeads,
  ] = await Promise.all([
    prisma.platformUser.count(),
    prisma.platformUserRole.count(),
    prisma.tenant.count(),
    prisma.platformTenant.count(),
    prisma.platformSubscriptionCommercialConfig.count(),
    prisma.platformAddOn.count(),
    prisma.platformCommercialOverride.count(),
    prisma.platformSalesLead.count(),
  ]);
  return { platformUsers, platformUserRoles, tenants, platformTenants, commercialConfigs, addOns, overrides, salesLeads };
}

export function diffSoR(before: ProtectedNotificationSoR, after: ProtectedNotificationSoR): Record<string, number> {
  const delta: Record<string, number> = {};
  for (const key of Object.keys(before)) {
    delta[key] = (after[key] ?? 0) - (before[key] ?? 0);
  }
  return delta;
}
