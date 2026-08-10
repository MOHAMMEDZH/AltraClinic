import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { getMeterDefinition } from '../catalog/static-usage-meter.catalog';
import { USAGE_COUNTER_SCHEMA, USAGE_OBSERVATION_SCHEMA, isUsageMeteringEnabled } from '../usage-metering.constants';
import type { UsageDriftClass } from '../domain/usage-metering.types';
import { UsageMeteringError } from '../domain/usage-metering.types';
import { UsageAggregateReaders } from './usage-aggregate.readers';
import { UsageCounterService } from './usage-counter.service';
import { UsagePeriodResolver } from './usage-period.resolver';
import { UsageIdempotencyService } from './usage-idempotency.service';

@Injectable()
export class UsageReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readers: UsageAggregateReaders,
    private readonly counters: UsageCounterService,
    private readonly periods: UsagePeriodResolver,
    private readonly idempotency: UsageIdempotencyService,
  ) {}

  async reconcile(tenantId: string, meterKey: string, idempotencyKey?: string) {
    if (!isUsageMeteringEnabled()) {
      throw new UsageMeteringError('metering_disabled', 'Usage metering is disabled', 503);
    }
    const def = getMeterDefinition(meterKey);
    if (!def) throw new UsageMeteringError('meter_unsupported', `Unknown meter: ${meterKey}`, 404);

    const now = this.periods.now();
    const period = this.periods.resolve(def.periodType, now);
    const expected = await this.readers.readExpected(tenantId, meterKey, now);
    const key = idempotencyKey ?? `reconcile:${tenantId}:${meterKey}:${period.periodStart.toISOString()}:${now.toISOString().slice(0, 16)}`;

    return this.prisma.$transaction(async (tx) => {
      const requestHash = this.idempotency.fingerprint({
        tenantId,
        meterKey,
        periodStart: period.periodStart.toISOString(),
        expected: expected.ok ? expected.value : expected.code,
      });
      const claim = await this.idempotency.claimCompletedOnly(tenantId, 'reconcile_counter', key, requestHash, tx);
      if (claim.kind === 'replay') {
        return { replay: true, ...(claim.resultPayload as object) };
      }

      try {
        const counter = await this.counters.getOrCreate(tenantId, meterKey, period, tx);
        let driftClass: UsageDriftClass;
        let expectedValue = counter.currentValue;
        let corrected = false;

        if (!expected.ok) {
          driftClass = 'SOURCE_UNAVAILABLE';
          await tx.platformUsageCounter.update({
            where: { id: counter.id },
            data: { staleClass: 'SOURCE_UNAVAILABLE', updatedAt: now },
          });
        } else {
          expectedValue = expected.value;
          const cmp = UsageAggregateReaders.compareNumeric(counter.currentValue, expectedValue, def.valueType);
          if (cmp === 0) {
            driftClass = 'IN_SYNC';
          } else {
            driftClass = 'DRIFT_CORRECTABLE';
            const observationId = randomUUID();
            await tx.platformUsageObservation.create({
              data: {
                id: observationId,
                tenantId,
                meterKey,
                operation: 'RECONCILE',
                value: expectedValue,
                occurredAt: now,
                source: 'usage.reconciliation',
                sourceEventId: key,
                schemaVersion: USAGE_OBSERVATION_SCHEMA,
                requestFingerprint: requestHash,
              },
            });
            await this.counters.applyMutation(
              {
                tenantId,
                meterKey,
                period,
                operation: 'RECONCILE',
                value: expectedValue,
                at: now,
                sourceClass: 'RECONCILE',
              },
              tx,
            );
            corrected = true;
          }
        }

        const driftAbsolute = expected.ok
          ? UsageAggregateReaders.subNumeric(expectedValue, counter.currentValue, def.valueType)
          : null;

        const checkpoint = await tx.platformUsageReconciliationCheckpoint.upsert({
          where: {
            tenantId_meterKey_periodType_periodStart_schemaVersion: {
              tenantId,
              meterKey,
              periodType: period.periodType,
              periodStart: period.periodStart,
              schemaVersion: USAGE_COUNTER_SCHEMA,
            },
          },
          create: {
            id: randomUUID(),
            tenantId,
            meterKey,
            periodType: period.periodType,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
            expectedValue: expected.ok ? expectedValue : counter.currentValue,
            counterValue: corrected ? expectedValue : counter.currentValue,
            driftClass,
            driftAbsolute,
            lastReconciledAt: now,
            sourceOwner: def.sourceOwner,
            schemaVersion: USAGE_COUNTER_SCHEMA,
          },
          update: {
            expectedValue: expected.ok ? expectedValue : counter.currentValue,
            counterValue: corrected ? expectedValue : counter.currentValue,
            driftClass,
            driftAbsolute,
            lastReconciledAt: now,
            updatedAt: now,
          },
        });

        const result = {
          meterKey,
          driftClass,
          corrected,
          expectedValue: expected.ok ? expectedValue : null,
          counterValue: corrected ? expectedValue : counter.currentValue,
          checkpointId: checkpoint.id,
          sourceUnavailable: !expected.ok,
        };
        await this.idempotency.complete(claim.recordId, 'checkpoint', checkpoint.id, result, tx);
        return { replay: false, ...result };
      } catch (err) {
        await this.idempotency.abandon(claim.recordId, tx);
        throw err;
      }
    });
  }
}
