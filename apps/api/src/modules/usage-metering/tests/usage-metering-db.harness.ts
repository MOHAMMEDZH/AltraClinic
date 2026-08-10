/**
 * Supplemental Capability U01 — Usage Metering PostgreSQL harness helpers.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from '../../platform-subscriptions/tests/platform-subscriptions-db.harness';
import { UsagePeriodResolver } from '../application/usage-period.resolver';
import { UsageAggregateReaders } from '../application/usage-aggregate.readers';
import { UsageIdempotencyService } from '../application/usage-idempotency.service';
import { UsageCounterService } from '../application/usage-counter.service';
import { UsageObservationIngestionService } from '../application/usage-observation-ingestion.service';
import { UsageReconciliationService } from '../application/usage-reconciliation.service';
import { UsageEnforcementService } from '../application/usage-enforcement.service';
import type { PrismaService } from '../../../infrastructure/prisma.service';
import type { EffectiveEntitlementRuntimeService } from '../../effective-entitlement-runtime/application/effective-entitlement-runtime.service';
import type { EffectiveLimit } from '../../effective-entitlement-runtime/domain/effective-entitlement.types';

export {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
};

export const U01_USAGE_TABLES = [
  'platform_usage_meter_definitions',
  'platform_usage_observations',
  'platform_usage_counters',
  'platform_usage_reconciliation_checkpoints',
  'platform_usage_idempotency',
] as const;

export async function assertU01TablesPresent(prisma: PrismaClient): Promise<void> {
  for (const table of U01_USAGE_TABLES) {
    const rows = await prisma.$queryRawUnsafe<Array<{ present: boolean }>>(
      `SELECT to_regclass('public.${table}') IS NOT NULL AS present`,
    );
    if (!rows[0]?.present) throw new Error(`U01 usage table missing: ${table}`);
  }
}

export async function cleanupUsageMeteringForTenant(prisma: PrismaClient, tenantId: string): Promise<void> {
  await prisma.platformUsageIdempotencyRecord.deleteMany({ where: { tenantId } });
  await prisma.platformUsageObservation.deleteMany({ where: { tenantId } });
  await prisma.platformUsageReconciliationCheckpoint.deleteMany({ where: { tenantId } });
  await prisma.platformUsageCounter.deleteMany({ where: { tenantId } });
}

export function createUsageStack(
  prisma: PrismaClient,
  getLimitImpl?: (tenantId: string, limitKey: string) => Promise<EffectiveLimit>,
) {
  const periods = new UsagePeriodResolver(() => new Date('2026-07-30T12:00:00.000Z'));
  const readers = new UsageAggregateReaders(prisma as unknown as PrismaService, periods);
  const idempotency = new UsageIdempotencyService(prisma as unknown as PrismaService);
  const counters = new UsageCounterService(prisma as unknown as PrismaService, periods);
  const ingestion = new UsageObservationIngestionService(
    prisma as unknown as PrismaService,
    idempotency,
    counters,
    periods,
  );
  const reconciliation = new UsageReconciliationService(
    prisma as unknown as PrismaService,
    readers,
    counters,
    periods,
    idempotency,
  );
  const entitlements = {
    getLimit:
      getLimitImpl ??
      (async (): Promise<EffectiveLimit> => ({
        state: 'CONFIGURED',
        value: '1',
        valueType: 'integer',
        code: 'test',
        source: 'SNAPSHOT',
        evaluatedAt: new Date().toISOString(),
      })),
  } as unknown as EffectiveEntitlementRuntimeService;

  const enforcement = new UsageEnforcementService(
    prisma as unknown as PrismaService,
    entitlements,
    counters,
    periods,
    readers,
    ingestion,
  );

  return { periods, readers, idempotency, counters, ingestion, reconciliation, enforcement, entitlements };
}

export function newTenantId(): string {
  return randomUUID();
}
