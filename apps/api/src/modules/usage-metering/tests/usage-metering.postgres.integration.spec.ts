/**
 * U01 Usage Metering — PostgreSQL integration.
 */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  assertSafePlatformTestDatabaseUrl,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  assertU01TablesPresent,
  cleanupUsageMeteringForTenant,
  createPlatformDbSecurityClient,
  createUsageStack,
  newTenantId,
  platformDbSecurityEnabled,
} from './usage-metering-db.harness';
import { USAGE_OBSERVATION_SCHEMA } from '../usage-metering.constants';
import { UsageMeteringError } from '../domain/usage-metering.types';
import { UsageReconciliationService } from '../application/usage-reconciliation.service';
import { UsagePeriodResolver } from '../application/usage-period.resolver';
import { UsageAggregateReaders } from '../application/usage-aggregate.readers';
import { UsageIdempotencyService } from '../application/usage-idempotency.service';
import { UsageCounterService } from '../application/usage-counter.service';
import type { PrismaService } from '../../../infrastructure/prisma.service';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('usage-metering postgres integration (U01)', () => {
  let prisma: PrismaClient;
  const tenantId = newTenantId();

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(process.env.INTEGRATION_DATABASE_URL ?? DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    await assertU01TablesPresent(prisma);
    process.env.USAGE_METERING_ENABLED = 'true';
    process.env.USAGE_METERING_INGESTION_ENABLED = 'true';
    process.env.USAGE_METERING_ENFORCEMENT_ENABLED = 'true';
  });

  afterAll(async () => {
    await cleanupUsageMeteringForTenant(prisma, tenantId);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupUsageMeteringForTenant(prisma, tenantId);
  });

  it('seeds 8 meter definitions with zero usage counters by default', async () => {
    const defs = await prisma.platformUsageMeterDefinition.count();
    expect(defs).toBeGreaterThanOrEqual(8);
    const counters = await prisma.platformUsageCounter.count({ where: { tenantId } });
    expect(counters).toBe(0);
  });

  it('observation ingestion is idempotent on exact replay', async () => {
    const { ingestion } = createUsageStack(prisma);
    const input = {
      tenantId,
      meterKey: 'meter.max_users',
      operation: 'INCREMENT' as const,
      value: '1',
      occurredAt: '2026-07-30T12:00:00.000Z',
      source: 'test.ingest',
      sourceEventId: 'evt-1',
      schemaVersion: USAGE_OBSERVATION_SCHEMA,
    };
    const first = await ingestion.ingest(input);
    const second = await ingestion.ingest(input);
    expect(first.replay).toBe(false);
    expect(second.replay).toBe(true);
    expect(second.observationId).toBe(first.observationId);
    const obs = await prisma.platformUsageObservation.count({ where: { tenantId } });
    expect(obs).toBe(1);
    const counter = await prisma.platformUsageCounter.findFirst({ where: { tenantId, meterKey: 'meter.max_users' } });
    expect(counter?.currentValue).toBe('1');
  });

  it('conflicting observation replay returns 409; counter unchanged', async () => {
    const { ingestion } = createUsageStack(prisma);
    const base = {
      tenantId,
      meterKey: 'meter.max_users' as const,
      operation: 'INCREMENT' as const,
      occurredAt: '2026-07-30T12:00:00.000Z',
      source: 'test.conflict',
      sourceEventId: 'evt-conflict',
      schemaVersion: USAGE_OBSERVATION_SCHEMA,
    };
    await ingestion.ingest({ ...base, value: '1' });
    let err: unknown;
    try {
      await ingestion.ingest({ ...base, value: '2' });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    const status =
      err instanceof ConflictException
        ? err.getStatus()
        : err instanceof UsageMeteringError
          ? err.httpStatus
          : undefined;
    expect(status).toBe(409);
    const counter = await prisma.platformUsageCounter.findFirst({ where: { tenantId, meterKey: 'meter.max_users' } });
    expect(counter?.currentValue).toBe('1');
    const obs = await prisma.platformUsageObservation.count({ where: { tenantId, source: 'test.conflict' } });
    expect(obs).toBe(1);
  });

  it('capacity-1: two parallel INCREMENT/enforce → at most one succeeds; final counter correct', async () => {
    const { enforcement, ingestion } = createUsageStack(prisma, async () => ({
      state: 'CONFIGURED',
      value: '1',
      valueType: 'integer',
      code: 'ok',
      source: 'SNAPSHOT',
      evaluatedAt: new Date().toISOString(),
    }));

    await ingestion.ingest({
      tenantId,
      meterKey: 'meter.max_users',
      operation: 'SET',
      value: '0',
      occurredAt: '2026-07-30T12:00:00.000Z',
      source: 'test.seed',
      sourceEventId: 'seed-cap1',
      schemaVersion: USAGE_OBSERVATION_SCHEMA,
    });

    const results = await Promise.allSettled([
      enforcement.assertHardAllowThenApply(tenantId, 'meter.max_users', '1', 'INCREMENT', 'cap-inc-a'),
      enforcement.assertHardAllowThenApply(tenantId, 'meter.max_users', '1', 'INCREMENT', 'cap-inc-b'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(rejected[0].status).toBe('rejected');
    if (rejected[0].status === 'rejected') {
      expect(rejected[0].reason).toBeInstanceOf(ForbiddenException);
    }

    const counter = await prisma.platformUsageCounter.findFirst({
      where: { tenantId, meterKey: 'meter.max_users' },
    });
    expect(counter?.currentValue).toBe('1');
    expect(counter?.reservedValue).toBe('0');
    const projected = BigInt(counter!.currentValue) + BigInt(counter!.reservedValue);
    expect(projected).toBe(1n);
  });

  it('capacity-1 reserve path: parallel RESERVE at remaining 1 → one wins', async () => {
    const { enforcement, ingestion } = createUsageStack(prisma, async () => ({
      state: 'CONFIGURED',
      value: '1',
      valueType: 'integer',
      code: 'ok',
      source: 'SNAPSHOT',
      evaluatedAt: new Date().toISOString(),
    }));

    await ingestion.ingest({
      tenantId,
      meterKey: 'meter.max_users',
      operation: 'SET',
      value: '0',
      occurredAt: '2026-07-30T12:00:00.000Z',
      source: 'test.seed',
      sourceEventId: 'seed-rsv',
      schemaVersion: USAGE_OBSERVATION_SCHEMA,
    });

    const results = await Promise.allSettled([
      enforcement.assertHardAllowThenReserve(tenantId, 'meter.max_users', '1', 'cap-rsv-a'),
      enforcement.assertHardAllowThenReserve(tenantId, 'meter.max_users', '1', 'cap-rsv-b'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);

    const counter = await prisma.platformUsageCounter.findFirst({
      where: { tenantId, meterKey: 'meter.max_users' },
    });
    expect(BigInt(counter!.currentValue) + BigInt(counter!.reservedValue)).toBe(1n);
  });

  it('reconcile SOURCE_UNAVAILABLE does not fabricate zero on the counter', async () => {
    const periods = new UsagePeriodResolver(() => new Date('2026-07-30T12:00:00.000Z'));
    const readers = {
      readExpected: jest.fn(async () => ({
        ok: false as const,
        code: 'SOURCE_UNAVAILABLE' as const,
        message: 'forced unavailable',
      })),
    };
    const idempotency = new UsageIdempotencyService(prisma as unknown as PrismaService);
    const counters = new UsageCounterService(prisma as unknown as PrismaService, periods);
    const { ingestion } = createUsageStack(prisma);
    await ingestion.ingest({
      tenantId,
      meterKey: 'meter.max_users',
      operation: 'SET',
      value: '99',
      occurredAt: '2026-07-15T12:00:00.000Z',
      source: 'test.drift',
      sourceEventId: 'drift-su',
      schemaVersion: USAGE_OBSERVATION_SCHEMA,
    });

    const reconciliation = new UsageReconciliationService(
      prisma as unknown as PrismaService,
      readers as unknown as UsageAggregateReaders,
      counters,
      periods,
      idempotency,
    );
    const result = (await reconciliation.reconcile(tenantId, 'meter.max_users', 'recon-su-1')) as {
      driftClass: string;
      corrected: boolean;
      expectedValue: string | null;
      counterValue: string;
      sourceUnavailable: boolean;
    };
    expect(result.driftClass).toBe('SOURCE_UNAVAILABLE');
    expect(result.corrected).toBe(false);
    expect(result.expectedValue).toBeNull();
    expect(result.sourceUnavailable).toBe(true);
    expect(result.counterValue).toBe('99');

    const counter = await prisma.platformUsageCounter.findFirst({
      where: { tenantId, meterKey: 'meter.max_users' },
    });
    expect(counter?.currentValue).toBe('99');
    expect(counter?.staleClass).toBe('SOURCE_UNAVAILABLE');
  });

  it('privacy: rejects correlationId with patientId; projections omit PHI-ish fields', async () => {
    const { ingestion, enforcement } = createUsageStack(prisma);
    await expect(
      ingestion.ingest({
        tenantId,
        meterKey: 'meter.max_patients',
        operation: 'SET',
        value: '3',
        occurredAt: '2026-07-30T12:00:00.000Z',
        source: 'test.privacy',
        sourceEventId: 'priv-bad',
        schemaVersion: USAGE_OBSERVATION_SCHEMA,
        correlationId: 'patientId=xyz',
      }),
    ).rejects.toMatchObject({ code: 'privacy_violation' });

    await ingestion.ingest({
      tenantId,
      meterKey: 'meter.max_patients',
      operation: 'SET',
      value: '3',
      occurredAt: '2026-07-30T12:00:00.000Z',
      source: 'test.privacy',
      sourceEventId: 'priv-1',
      schemaVersion: USAGE_OBSERVATION_SCHEMA,
    });
    const decision = await enforcement.evaluate(tenantId, 'meter.max_patients', '0');
    const json = JSON.stringify(decision);
    expect(json).not.toMatch(/patientName|ssn|diagnosis|email@|phi/i);
    expect(decision).toHaveProperty('meterKey');
    expect(decision).toHaveProperty('code');
    expect(decision).not.toHaveProperty('sql');
    expect(decision).not.toHaveProperty('stack');
  });
});
