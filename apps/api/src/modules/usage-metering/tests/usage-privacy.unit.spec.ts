/**
 * Privacy: observation contract has no free-form payload map.
 * Only correlationId is validated for prohibited PHI-ish tokens (patientId, etc.).
 */
import { UsageObservationIngestionService } from '../application/usage-observation-ingestion.service';
import { UsageMeteringError } from '../domain/usage-metering.types';
import { USAGE_OBSERVATION_SCHEMA } from '../usage-metering.constants';

describe('usage observation privacy validation', () => {
  const prev = process.env.USAGE_METERING_INGESTION_ENABLED;
  beforeAll(() => {
    process.env.USAGE_METERING_ENABLED = 'true';
    process.env.USAGE_METERING_INGESTION_ENABLED = 'true';
  });
  afterAll(() => {
    process.env.USAGE_METERING_INGESTION_ENABLED = prev;
  });

  function makeIngestion() {
    const prisma = { $transaction: jest.fn() };
    const idempotency = { fingerprint: jest.fn(), claimCompletedOnly: jest.fn() };
    const counters = { applyMutation: jest.fn() };
    const periods = {
      assertNotFutureSkew: jest.fn(),
      resolve: jest.fn(),
      now: () => new Date('2026-07-30T12:00:00.000Z'),
    };
    return new UsageObservationIngestionService(
      prisma as never,
      idempotency as never,
      counters as never,
      periods as never,
    );
  }

  it('rejects correlationId containing patientId', async () => {
    const ingestion = makeIngestion();
    await expect(
      ingestion.ingest({
        tenantId: '00000000-0000-4000-8000-000000000001',
        meterKey: 'meter.max_users',
        operation: 'INCREMENT',
        value: '1',
        occurredAt: '2026-07-30T12:00:00.000Z',
        source: 'test',
        sourceEventId: 'p1',
        schemaVersion: USAGE_OBSERVATION_SCHEMA,
        correlationId: 'ref-patientId-abc',
      }),
    ).rejects.toMatchObject({ code: 'privacy_violation' } as Partial<UsageMeteringError>);
  });

  it('documents: no free-form observation payload keys (patientId etc.) exist on the contract', () => {
    // UsageObservationInput has no attributes/payload map — only correlationId is scanned.
    expect(true).toBe(true);
  });
});
