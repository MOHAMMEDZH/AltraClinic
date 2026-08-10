import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { getMeterDefinition } from '../catalog/static-usage-meter.catalog';
import { USAGE_COUNTER_SCHEMA } from '../usage-metering.constants';
import type { UsagePeriodBounds, UsageStaleClass } from '../domain/usage-metering.types';
import { UsageMeteringError } from '../domain/usage-metering.types';
import { UsageAggregateReaders } from './usage-aggregate.readers';
import { UsagePeriodResolver } from './usage-period.resolver';

@Injectable()
export class UsageCounterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periods: UsagePeriodResolver,
  ) {}

  async getOrCreate(
    tenantId: string,
    meterKey: string,
    period: UsagePeriodBounds,
    tx: Prisma.TransactionClient = this.prisma as unknown as Prisma.TransactionClient,
  ) {
    const def = getMeterDefinition(meterKey);
    if (!def) throw new UsageMeteringError('meter_unsupported', `Unknown meter: ${meterKey}`, 404);

    const existing = await tx.platformUsageCounter.findUnique({
      where: {
        tenantId_meterKey_periodType_periodStart_schemaVersion: {
          tenantId,
          meterKey,
          periodType: period.periodType,
          periodStart: period.periodStart,
          schemaVersion: USAGE_COUNTER_SCHEMA,
        },
      },
    });
    if (existing) return existing;

    try {
      return await tx.platformUsageCounter.create({
        data: {
          id: randomUUID(),
          tenantId,
          meterKey,
          periodType: period.periodType,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          schemaVersion: USAGE_COUNTER_SCHEMA,
          currentValue: '0',
          reservedValue: '0',
          staleClass: 'FRESH',
          sourceClass: 'OBSERVATION',
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const again = await tx.platformUsageCounter.findUnique({
          where: {
            tenantId_meterKey_periodType_periodStart_schemaVersion: {
              tenantId,
              meterKey,
              periodType: period.periodType,
              periodStart: period.periodStart,
              schemaVersion: USAGE_COUNTER_SCHEMA,
            },
          },
        });
        if (again) return again;
      }
      throw err;
    }
  }

  async applyMutation(
    args: {
      tenantId: string;
      meterKey: string;
      period: UsagePeriodBounds;
      operation: 'INCREMENT' | 'DECREMENT' | 'SET' | 'RECONCILE' | 'RESERVE' | 'RELEASE';
      value: string;
      at: Date;
      sourceClass?: string;
      expectedRowVersion?: number;
    },
    tx: Prisma.TransactionClient,
  ) {
    const def = getMeterDefinition(args.meterKey);
    if (!def) throw new UsageMeteringError('meter_unsupported', `Unknown meter: ${args.meterKey}`, 404);
    const row = await this.getOrCreate(args.tenantId, args.meterKey, args.period, tx);
    if (args.expectedRowVersion != null && row.rowVersion !== args.expectedRowVersion) {
      throw new UsageMeteringError('counter_version_conflict', 'Counter rowVersion conflict', 409);
    }

    let current = row.currentValue;
    let reserved = row.reservedValue;
    const vt = def.valueType;

    switch (args.operation) {
      case 'INCREMENT':
        current = UsageAggregateReaders.addNumeric(current, args.value, vt);
        break;
      case 'DECREMENT':
        current = UsageAggregateReaders.subNumeric(current, args.value, vt);
        if (UsageAggregateReaders.compareNumeric(current, '0', vt) < 0) current = '0';
        break;
      case 'SET':
      case 'RECONCILE':
        current = args.value;
        break;
      case 'RESERVE':
        reserved = UsageAggregateReaders.addNumeric(reserved, args.value, vt);
        break;
      case 'RELEASE':
        reserved = UsageAggregateReaders.subNumeric(reserved, args.value, vt);
        if (UsageAggregateReaders.compareNumeric(reserved, '0', vt) < 0) reserved = '0';
        break;
      default:
        throw new UsageMeteringError('operation_invalid', `Invalid counter operation`);
    }

    return tx.platformUsageCounter.update({
      where: { id: row.id },
      data: {
        currentValue: current,
        reservedValue: reserved,
        rowVersion: { increment: 1 },
        lastObservationAt: args.operation === 'RECONCILE' ? row.lastObservationAt : args.at,
        lastReconciledAt: args.operation === 'RECONCILE' ? args.at : row.lastReconciledAt,
        staleClass: 'FRESH',
        sourceClass: args.sourceClass ?? (args.operation === 'RECONCILE' ? 'RECONCILE' : 'OBSERVATION'),
        updatedAt: this.periods.now(),
      },
    });
  }

  projectedValue(current: string, reserved: string, valueType: 'integer' | 'decimal'): string {
    return UsageAggregateReaders.addNumeric(current, reserved, valueType);
  }

  classifyStale(lastAt: Date | null | undefined, thresholdMs: number, now = this.periods.now()): UsageStaleClass {
    if (!lastAt) return 'STALE';
    return now.getTime() - lastAt.getTime() > thresholdMs ? 'STALE' : 'FRESH';
  }
}
