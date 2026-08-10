import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { getMeterDefinition, isKnownMeterKey } from '../catalog/static-usage-meter.catalog';
import {
  USAGE_OBSERVATION_SCHEMA,
  isUsageMeteringEnabled,
  isUsageMeteringIngestionEnabled,
} from '../usage-metering.constants';
import type { UsageObservationInput } from '../domain/usage-metering.types';
import { UsageMeteringError } from '../domain/usage-metering.types';
import { UsageIdempotencyService } from './usage-idempotency.service';
import { UsageCounterService } from './usage-counter.service';
import { UsagePeriodResolver } from './usage-period.resolver';

const ALLOWED_OPS = new Set(['INCREMENT', 'DECREMENT', 'SET', 'RECONCILE', 'RESERVE', 'RELEASE']);

/** Prohibited PHI-ish tokens in correlationId (observations have no free-form payload map). */
const PROHIBITED_CORRELATION = /patientid|patient_id|patientName|ssn|diagnosis|phi|token|password/i;

@Injectable()
export class UsageObservationIngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: UsageIdempotencyService,
    private readonly counters: UsageCounterService,
    private readonly periods: UsagePeriodResolver,
  ) {}

  async ingest(input: UsageObservationInput, externalTx?: Prisma.TransactionClient) {
    if (!isUsageMeteringEnabled() || !isUsageMeteringIngestionEnabled()) {
      throw new UsageMeteringError('ingestion_disabled', 'Usage metering ingestion is disabled', 503);
    }
    this.validate(input);
    const run = (tx: Prisma.TransactionClient) => this.ingestInTx(input, tx);
    if (externalTx) return run(externalTx);
    return this.prisma.$transaction((tx) => run(tx));
  }

  private async ingestInTx(input: UsageObservationInput, tx: Prisma.TransactionClient) {
    const def = getMeterDefinition(input.meterKey)!;
    const occurredAt = new Date(input.occurredAt);
    this.periods.assertNotFutureSkew(occurredAt);
    const period = this.periods.resolve(def.periodType, occurredAt);
    const requestHash = this.idempotency.fingerprint({
      tenantId: input.tenantId,
      meterKey: input.meterKey,
      operation: input.operation,
      value: input.value,
      occurredAt: input.occurredAt,
      source: input.source,
      sourceEventId: input.sourceEventId,
      schemaVersion: input.schemaVersion,
    });
    const idemKey = `${input.source}:${input.sourceEventId}`;

    const claim = await this.idempotency.claimCompletedOnly(
      input.tenantId,
      `ingest_${input.operation.toLowerCase()}`,
      idemKey,
      requestHash,
      tx,
    );
    if (claim.kind === 'replay') {
      return { replay: true, observationId: claim.resultResourceId, payload: claim.resultPayload };
    }

    try {
      const existingObs = await tx.platformUsageObservation.findUnique({
        where: {
          tenantId_source_sourceEventId: {
            tenantId: input.tenantId,
            source: input.source,
            sourceEventId: input.sourceEventId,
          },
        },
      });
      if (existingObs) {
        if (existingObs.requestFingerprint !== requestHash) {
          throw new UsageMeteringError('observation_conflict', 'Observation fingerprint mismatch', 409);
        }
        await this.idempotency.complete(
          claim.recordId,
          'observation',
          existingObs.id,
          { observationId: existingObs.id },
          tx,
        );
        return { replay: true, observationId: existingObs.id };
      }

      const observationId = input.observationId ?? randomUUID();
      await tx.platformUsageObservation.create({
        data: {
          id: observationId,
          tenantId: input.tenantId,
          meterKey: input.meterKey,
          operation: input.operation,
          value: input.value,
          occurredAt,
          source: input.source,
          sourceEventId: input.sourceEventId,
          schemaVersion: input.schemaVersion,
          correlationId: input.correlationId,
          requestFingerprint: requestHash,
        },
      });

      const counter = await this.counters.applyMutation(
        {
          tenantId: input.tenantId,
          meterKey: input.meterKey,
          period,
          operation: input.operation as 'INCREMENT' | 'DECREMENT' | 'SET' | 'RECONCILE' | 'RESERVE' | 'RELEASE',
          value: input.value,
          at: occurredAt,
        },
        tx,
      );

      await this.idempotency.complete(
        claim.recordId,
        'observation',
        observationId,
        { observationId, counterId: counter.id, currentValue: counter.currentValue },
        tx,
      );

      return { replay: false, observationId, counter };
    } catch (err) {
      await this.idempotency.abandon(claim.recordId, tx);
      throw err;
    }
  }

  private validate(input: UsageObservationInput): void {
    if (!input.tenantId) throw new UsageMeteringError('tenant_required', 'tenantId is required');
    if (!isKnownMeterKey(input.meterKey)) {
      throw new UsageMeteringError('meter_unsupported', `Unknown meter: ${input.meterKey}`, 400);
    }
    if (!ALLOWED_OPS.has(input.operation)) {
      throw new UsageMeteringError('operation_invalid', `Invalid operation: ${input.operation}`);
    }
    if (!input.value || !/^-?\d+(\.\d+)?$/.test(input.value)) {
      throw new UsageMeteringError('value_invalid', 'value must be an exact numeric string');
    }
    if (!input.source || !input.sourceEventId) {
      throw new UsageMeteringError('source_required', 'source and sourceEventId are required');
    }
    if (input.schemaVersion !== USAGE_OBSERVATION_SCHEMA) {
      throw new UsageMeteringError('schema_unsupported', `Unsupported schemaVersion: ${input.schemaVersion}`);
    }
    if (Number.isNaN(Date.parse(input.occurredAt))) {
      throw new UsageMeteringError('occurred_at_invalid', 'occurredAt must be UTC ISO');
    }
    // Privacy: observation contract has no free-form payload; only correlationId is scanned.
    if (input.correlationId && PROHIBITED_CORRELATION.test(input.correlationId)) {
      throw new UsageMeteringError('privacy_violation', 'Prohibited correlationId content');
    }
  }

  static fingerprintFields(input: UsageObservationInput): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          tenantId: input.tenantId,
          meterKey: input.meterKey,
          operation: input.operation,
          value: input.value,
          source: input.source,
          sourceEventId: input.sourceEventId,
        }),
      )
      .digest('hex');
  }
}
