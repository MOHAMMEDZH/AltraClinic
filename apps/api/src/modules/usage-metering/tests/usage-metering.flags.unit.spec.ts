/**
 * Supplemental Capability U01 — feature flag defaults (OFF) and off-path behavior.
 */
import { UsageEnforcementService } from '../application/usage-enforcement.service';
import { UsageObservationIngestionService } from '../application/usage-observation-ingestion.service';
import {
  USAGE_OBSERVATION_SCHEMA,
  isUsageMeteringEnabled,
  isUsageMeteringEnforcementEnabled,
  isUsageMeteringIngestionEnabled,
} from '../usage-metering.constants';

const FLAG_KEYS = [
  'USAGE_METERING_ENABLED',
  'USAGE_METERING_ENFORCEMENT_ENABLED',
  'USAGE_METERING_INGESTION_ENABLED',
] as const;

describe('U01 usage metering feature flags', () => {
  const saved: Partial<Record<(typeof FLAG_KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const k of FLAG_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of FLAG_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('defaults all three flags to false when unset', () => {
    expect(isUsageMeteringEnabled()).toBe(false);
    expect(isUsageMeteringEnforcementEnabled()).toBe(false);
    expect(isUsageMeteringIngestionEnabled()).toBe(false);
  });

  it('enforcement disabled → UsageEnforcement allow-through (hard denial path not used)', async () => {
    process.env.USAGE_METERING_ENABLED = 'true';
    process.env.USAGE_METERING_ENFORCEMENT_ENABLED = 'false';

    const entitlements = { getLimit: jest.fn() };
    const counters = {
      getOrCreate: jest.fn(),
      projectedValue: jest.fn(),
      classifyStale: jest.fn(),
    };
    const periods = {
      now: () => new Date('2026-07-30T12:00:00.000Z'),
      resolve: jest.fn(),
    };
    const readers = { readExpected: jest.fn() };
    const svc = new UsageEnforcementService(
      {} as never,
      entitlements as never,
      counters as never,
      periods as never,
      readers as never,
    );

    const decision = await svc.assertAllowed('t1', 'meter.max_users', '1');
    expect(decision.allowed).toBe(true);
    expect(decision.code).toBe('enforcement_disabled');
    expect(entitlements.getLimit).not.toHaveBeenCalled();
    expect(counters.getOrCreate).not.toHaveBeenCalled();
  });

  it('ingestion disabled → no observation created (isUsageMeteringIngestionEnabled false)', async () => {
    process.env.USAGE_METERING_ENABLED = 'true';
    process.env.USAGE_METERING_INGESTION_ENABLED = 'false';
    expect(isUsageMeteringIngestionEnabled()).toBe(false);

    const prisma = { $transaction: jest.fn() };
    const idempotency = { fingerprint: jest.fn(), claimCompletedOnly: jest.fn() };
    const counters = { applyMutation: jest.fn() };
    const periods = {
      assertNotFutureSkew: jest.fn(),
      resolve: jest.fn(),
      now: () => new Date('2026-07-30T12:00:00.000Z'),
    };
    const ingestion = new UsageObservationIngestionService(
      prisma as never,
      idempotency as never,
      counters as never,
      periods as never,
    );

    await expect(
      ingestion.ingest({
        tenantId: '00000000-0000-4000-8000-000000000001',
        meterKey: 'meter.max_users',
        operation: 'INCREMENT',
        value: '1',
        occurredAt: '2026-07-30T12:00:00.000Z',
        source: 'test',
        sourceEventId: 'evt-1',
        schemaVersion: USAGE_OBSERVATION_SCHEMA,
      }),
    ).rejects.toMatchObject({ code: 'ingestion_disabled' });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(idempotency.claimCompletedOnly).not.toHaveBeenCalled();
    expect(counters.applyMutation).not.toHaveBeenCalled();
  });
});
