/**
 * Flexible Step 26 — Sales Productivity / Commission Snapshot PostgreSQL harness.
 * Contract: docs/SALES_PRODUCTIVITY_AND_COMMISSION_SNAPSHOT.md
 */
import { randomUUID } from 'crypto';
import { PrismaClient, type Prisma } from '@prisma/client';
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
  SALES_COMMISSION_AUDIT_CATEGORY,
  SALES_PRODUCTIVITY_FAILURE_INJECTION_ENV,
} from '../platform-sales-productivity.constants';
import {
  createPlanVersionFixture,
  deletePlanVersionFixtures,
  ensureCatalogSeeded,
  resolveCatalogKeys,
  type TrialCatalogKeys,
} from '../../platform-sales-trials/tests/sales-trials-db.harness';

export {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
  createPlanVersionFixture,
  deletePlanVersionFixtures,
  ensureCatalogSeeded,
  resolveCatalogKeys,
};
export type { TrialCatalogKeys };

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

export const PERIOD_KEY = '2026-03';
export const PERIOD_START = new Date('2026-03-01T00:00:00.000Z');
export const PERIOD_END = new Date('2026-04-01T00:00:00.000Z');

export function createHybridPrisma(prisma: PrismaClient): PrismaService {
  return Object.assign(prisma, createSubscriptionsPrismaWrapper(prisma)) as unknown as PrismaService;
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

export function clearSalesProductivityFailureInjection(): void {
  delete process.env[SALES_PRODUCTIVITY_FAILURE_INJECTION_ENV];
}

export function setSalesProductivityFailureInjection(point: string): void {
  process.env[SALES_PRODUCTIVITY_FAILURE_INJECTION_ENV] = point;
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

export async function cleanupSalesProductivityTables(prisma: PrismaClient): Promise<void> {
  assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
  await prisma.platformSalesCommissionSnapshot.deleteMany({});
  await prisma.platformSalesTrialConversion.deleteMany({});
  await prisma.platformSalesTrialExtensionHistory.deleteMany({});
  await prisma.platformSalesTrial.deleteMany({});
  await prisma.platformSalesLeadNote.deleteMany({});
  await prisma.platformSalesLeadStageHistory.deleteMany({});
  await prisma.platformSalesLeadOwnershipHistory.deleteMany({});
  await prisma.platformSalesLead.deleteMany({});
  await prisma.platformSalesIdempotencyRecord.deleteMany({});
  await prisma.platformSalesCustomerOwnershipHistory.deleteMany({});
  await prisma.platformSalesCustomerOwnership.deleteMany({});
  await prisma.platformSalesRepresentative.deleteMany({});
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
  const trialTenants = await prisma.tenant.findMany({
    where: { OR: [{ slug: { startsWith: 'trial-' } }, { slug: { startsWith: 'prod-' } }] },
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
      `DELETE FROM "audit_entries" WHERE "category" = '${SALES_COMMISSION_AUDIT_CATEGORY}'`,
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

export async function countCommissionAudits(
  prisma: PrismaClient,
  action: string,
): Promise<number> {
  return prisma.auditEntry.count({
    where: { action, category: SALES_COMMISSION_AUDIT_CATEGORY },
  });
}

export async function countCommissionAuditsFor(
  prisma: PrismaClient,
  action: string,
  resourceId: string,
): Promise<number> {
  return prisma.auditEntry.count({
    where: { action, resourceId, category: SALES_COMMISSION_AUDIT_CATEGORY },
  });
}

export async function createRepProfile(
  prisma: PrismaClient,
  platformUserId: string,
  opts: {
    regionCode?: string;
    managerRepresentativeId?: string | null;
    status?: 'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
    targetAmount?: number | null;
    targetCurrency?: string | null;
    targetPeriod?: 'MONTH' | 'QUARTER' | 'YEAR' | null;
  } = {},
) {
  return prisma.platformSalesRepresentative.create({
    data: {
      platformUserId,
      status: opts.status ?? 'ACTIVE',
      regionCode: opts.regionCode ?? 'GLOBAL',
      managerRepresentativeId: opts.managerRepresentativeId ?? null,
      targetAmount: opts.targetAmount ?? null,
      targetCurrency: opts.targetCurrency ?? null,
      targetPeriod: opts.targetPeriod ?? null,
    },
  });
}

export async function createTenantFixture(
  prisma: PrismaClient,
  opts: { name?: string; provisionedBy?: string; slugPrefix?: string } = {},
) {
  const slug = `${opts.slugPrefix ?? 'prod'}-${randomUUID().slice(0, 8)}`;
  const tenant = await prisma.tenant.create({
    data: { name: opts.name ?? 'Productivity Tenant', slug, features: {} },
  });
  const platformTenant = await prisma.platformTenant.create({
    data: {
      tenantId: tenant.id,
      displayName: opts.name ?? 'Productivity Tenant',
      region: 'GLOBAL' as never,
      provisionedBy: opts.provisionedBy ?? randomUUID(),
    },
  });
  return { tenant, platformTenant };
}

export async function createOwnership(
  prisma: PrismaClient,
  representativeId: string,
  platformTenantId: string,
  assignedById: string,
) {
  return prisma.platformSalesCustomerOwnership.create({
    data: {
      representativeId,
      platformTenantId,
      assignedById,
      reason: 'step26_fixture',
    },
  });
}

export async function createCommercialConfigFixture(
  prisma: PrismaClient,
  opts: {
    platformTenantId: string;
    createdByPlatformUserId: string;
    planVersionId?: string | null;
    lifecycle?: 'DRAFT' | 'ACTIVE_COMMERCIAL' | 'CANCELLED';
    isCurrent?: boolean;
    activatedAt?: Date | null;
    cancelledAt?: Date | null;
    cancellationEffectiveAt?: Date | null;
  },
) {
  return prisma.platformSubscriptionCommercialConfig.create({
    data: {
      platformTenantId: opts.platformTenantId,
      createdByPlatformUserId: opts.createdByPlatformUserId,
      planVersionId: opts.planVersionId ?? null,
      lifecycle: opts.lifecycle ?? 'ACTIVE_COMMERCIAL',
      isCurrent: opts.isCurrent ?? true,
      activatedAt: opts.activatedAt ?? new Date('2026-01-15T00:00:00.000Z'),
      cancelledAt: opts.cancelledAt ?? null,
      cancellationEffectiveAt: opts.cancellationEffectiveAt ?? null,
      commercialStart: opts.activatedAt ?? new Date('2026-01-15T00:00:00.000Z'),
    },
  });
}

export async function createLeadFixture(
  prisma: PrismaClient,
  opts: {
    ownerRepresentativeId?: string | null;
    organizationName?: string;
    stage?: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'DEMO_SCHEDULED' | 'PROPOSAL' | 'WON' | 'LOST';
    createdAt?: Date;
    updatedAt?: Date;
    demoScheduledAt?: Date | null;
    demoTimezone?: string | null;
    demoStatus?: 'NONE' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
    nextActionType?: string | null;
  },
) {
  const id = randomUUID();
  const createdAt = opts.createdAt ?? new Date('2026-03-10T12:00:00.000Z');
  const updatedAt = opts.updatedAt ?? createdAt;
  await prisma.$executeRaw`
    INSERT INTO platform_sales_leads (
      id, stage, source, "ownerRepresentativeId", "organizationName", "contactName",
      "specialtyKeys", "desiredModuleKeys", "demoScheduledAt", "demoTimezone", "demoStatus",
      "nextActionType", "rowVersion", "createdAt", "updatedAt"
    ) VALUES (
      ${id}::uuid,
      ${opts.stage ?? 'NEW'}::"platform_sales_lead_stage",
      'OTHER'::"platform_sales_lead_source",
      ${opts.ownerRepresentativeId ?? null}::uuid,
      ${opts.organizationName ?? 'Lead Org'},
      ${'Contact'},
      '[]'::jsonb,
      '[]'::jsonb,
      ${opts.demoScheduledAt ?? null},
      ${opts.demoTimezone ?? null},
      ${(opts.demoStatus ?? 'NONE') as never}::"platform_sales_demo_status",
      ${opts.nextActionType ?? null},
      1,
      ${createdAt},
      ${updatedAt}
    )
  `;
  return prisma.platformSalesLead.findUniqueOrThrow({ where: { id } });
}

export async function createLeadNote(
  prisma: PrismaClient,
  leadId: string,
  createdById: string,
  createdAt: Date,
  body = 'commercial note',
) {
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO platform_sales_lead_notes (id, "leadId", body, "createdById", "createdAt")
    VALUES (${id}::uuid, ${leadId}::uuid, ${body}, ${createdById}::uuid, ${createdAt})
  `;
  return id;
}

export async function createStageHistory(
  prisma: PrismaClient,
  opts: {
    leadId: string;
    toStage: 'WON' | 'LOST' | 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'DEMO_SCHEDULED' | 'PROPOSAL';
    actorPlatformUserId: string;
    createdAt: Date;
    fromStage?: string | null;
  },
) {
  return prisma.platformSalesLeadStageHistory.create({
    data: {
      leadId: opts.leadId,
      fromStage: (opts.fromStage as never) ?? null,
      toStage: opts.toStage,
      actorPlatformUserId: opts.actorPlatformUserId,
      createdAt: opts.createdAt,
    },
  });
}

export async function createTrialFixture(
  prisma: PrismaClient,
  opts: {
    ownerRepresentativeId?: string | null;
    trialPlanVersionId: string;
    createdByPlatformUserId: string;
    createdAt?: Date;
    platformTenantId?: string | null;
    originatingLeadId?: string | null;
    attributionSnapshotJson?: Prisma.InputJsonValue;
    status?: 'DRAFT' | 'ACTIVE' | 'CONVERTED' | 'EXPIRED' | 'CANCELLED' | 'PENDING_PROVISIONING';
  },
) {
  const id = randomUUID();
  const createdAt = opts.createdAt ?? new Date('2026-03-12T10:00:00.000Z');
  const attr =
    opts.attributionSnapshotJson ??
    ({
      ownerRepresentativeId: opts.ownerRepresentativeId ?? null,
      salesAttributionId: opts.ownerRepresentativeId ?? null,
      frozenAt: createdAt.toISOString(),
    } as Prisma.InputJsonValue);
  await prisma.$executeRaw`
    INSERT INTO platform_sales_trials (
      id, "platformTenantId", "originatingLeadId", "ownerRepresentativeId",
      "attributionSnapshotJson", "trialPlanVersionId", status, "organizationName",
      "facilityTypeKey", "selectedSpecialtyKeys", "selectedModuleKeys",
      "maxExtensions", "extensionCount", "trialOnlyGrantsJson",
      "createdByPlatformUserId", "rowVersion", "createdAt", "updatedAt"
    ) VALUES (
      ${id}::uuid,
      ${opts.platformTenantId ?? null}::uuid,
      ${opts.originatingLeadId ?? null}::uuid,
      ${opts.ownerRepresentativeId ?? null}::uuid,
      ${JSON.stringify(attr)}::jsonb,
      ${opts.trialPlanVersionId}::uuid,
      ${(opts.status ?? 'ACTIVE') as never}::"platform_sales_trial_status",
      ${'Trial Org'},
      ${'facility.clinic'},
      '[]'::jsonb,
      '[]'::jsonb,
      2,
      0,
      '[]'::jsonb,
      ${opts.createdByPlatformUserId}::uuid,
      1,
      ${createdAt},
      ${createdAt}
    )
  `;
  return prisma.platformSalesTrial.findUniqueOrThrow({ where: { id } });
}

export async function createConversionFixture(
  prisma: PrismaClient,
  opts: {
    trialId: string;
    targetPaidPlanVersionId: string;
    actorPlatformUserId: string;
    convertedAt?: Date;
    dispositionsJson?: Prisma.InputJsonValue;
  },
) {
  const id = randomUUID();
  const convertedAt = opts.convertedAt ?? new Date('2026-03-20T15:00:00.000Z');
  await prisma.$executeRaw`
    INSERT INTO platform_sales_trial_conversions (
      id, "trialId", "targetPaidPlanVersionId", "dispositionsJson",
      "actorPlatformUserId", "convertedAt", "createdAt"
    ) VALUES (
      ${id}::uuid,
      ${opts.trialId}::uuid,
      ${opts.targetPaidPlanVersionId}::uuid,
      ${JSON.stringify(opts.dispositionsJson ?? [])}::jsonb,
      ${opts.actorPlatformUserId}::uuid,
      ${convertedAt},
      ${convertedAt}
    )
  `;
  return prisma.platformSalesTrialConversion.findUniqueOrThrow({ where: { id } });
}

/** Protected SoR counts for markPaid / denial side-effect proofs. */
export type ProtectedProductivitySoR = Record<string, number>;

export async function protectedProductivitySoR(
  prisma: PrismaClient,
): Promise<ProtectedProductivitySoR> {
  const [
    snapshots,
    trials,
    conversions,
    leads,
    commercialConfigs,
    addonAssignments,
    subscriptions,
    plans,
    planVersions,
    platformTenants,
    entitlements,
    overrides,
  ] = await Promise.all([
    prisma.platformSalesCommissionSnapshot.count(),
    prisma.platformSalesTrial.count(),
    prisma.platformSalesTrialConversion.count(),
    prisma.platformSalesLead.count(),
    prisma.platformSubscriptionCommercialConfig.count(),
    prisma.platformSubscriptionAddOnAssignment.count(),
    prisma.platformSubscription.count(),
    prisma.platformPlan.count(),
    prisma.platformPlanVersion.count(),
    prisma.platformTenant.count(),
    prisma.platformPlanVersionEntitlement.count(),
    prisma.platformCommercialOverride.count(),
  ]);
  return {
    snapshots,
    trials,
    conversions,
    leads,
    commercialConfigs,
    addonAssignments,
    subscriptions,
    plans,
    planVersions,
    platformTenants,
    entitlements,
    overrides,
  };
}

export function diffSoR(
  before: ProtectedProductivitySoR,
  after: ProtectedProductivitySoR,
): Record<string, number> {
  const delta: Record<string, number> = {};
  for (const key of Object.keys(before)) {
    delta[key] = (after[key] ?? 0) - (before[key] ?? 0);
  }
  return delta;
}

export function metricById(
  bundle: {
    metrics: Array<{
      id: string;
      value: number | null;
      completeness: string;
      rankingEligible: boolean;
      explanation?: string | null;
      numerator?: number | null;
      denominator?: number | null;
    }>;
  },
  id: string,
) {
  const m = bundle.metrics.find((x) => x.id === id);
  if (!m) throw new Error(`Missing metric ${id}`);
  return m;
}
