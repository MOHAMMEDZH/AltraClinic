import { ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { EffectiveEntitlementRuntimeService } from '../../effective-entitlement-runtime/application/effective-entitlement-runtime.service';
import { getMeterDefinition, RESOURCE_TO_METER } from '../catalog/static-usage-meter.catalog';
import {
  STALE_THRESHOLD_MS,
  WARNING_THRESHOLD_RATIO,
  isUsageMeteringEnabled,
  isUsageMeteringEnforcementEnabled,
  USAGE_OBSERVATION_SCHEMA,
} from '../usage-metering.constants';
import type { UsageEnforcementDecision } from '../domain/usage-metering.types';
import { UsageAggregateReaders } from './usage-aggregate.readers';
import { UsageCounterService } from './usage-counter.service';
import { UsagePeriodResolver } from './usage-period.resolver';
import { UsageObservationIngestionService } from './usage-observation-ingestion.service';
import { PrismaService } from '../../../infrastructure/prisma.service';

@Injectable()
export class UsageEnforcementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EffectiveEntitlementRuntimeService,
    private readonly counters: UsageCounterService,
    private readonly periods: UsagePeriodResolver,
    private readonly readers: UsageAggregateReaders,
    @Optional() private readonly ingestion?: UsageObservationIngestionService,
  ) {}

  async evaluate(
    tenantId: string,
    meterKey: string,
    delta = '1',
  ): Promise<UsageEnforcementDecision> {
    const evaluatedAt = this.periods.now().toISOString();
    const def = getMeterDefinition(meterKey);
    if (!def) {
      return {
        allowed: false,
        code: 'meter_unsupported',
        meterKey,
        limitKey: '',
        enforcementMode: 'HARD',
        limitState: 'UNCONFIGURED',
        currentValue: '0',
        projectedValue: '0',
        staleClass: 'SOURCE_UNAVAILABLE',
        evaluatedAt,
      };
    }

    const limit = await this.entitlements.getLimit(tenantId, def.limitKey);
    const period = this.periods.resolve(def.periodType);
    const counter = await this.counters.getOrCreate(tenantId, meterKey, period);
    let current = counter.currentValue;
    let staleClass = this.counters.classifyStale(
      counter.lastReconciledAt ?? counter.lastObservationAt,
      STALE_THRESHOLD_MS,
    );

    if (staleClass === 'STALE' && def.reconciliationMode === 'LIVE_AGGREGATE') {
      const agg = await this.readers.readExpected(tenantId, meterKey);
      if (!agg.ok) {
        staleClass = 'SOURCE_UNAVAILABLE';
      } else {
        current = agg.value;
        staleClass = 'FRESH';
      }
    }

    return this.decideFromState({
      tenantId,
      meterKey,
      delta,
      def,
      limit,
      current,
      reserved: counter.reservedValue,
      staleClass,
      evaluatedAt,
    });
  }

  private decideFromState(args: {
    tenantId: string;
    meterKey: string;
    delta: string;
    def: NonNullable<ReturnType<typeof getMeterDefinition>>;
    limit: Awaited<ReturnType<EffectiveEntitlementRuntimeService['getLimit']>>;
    current: string;
    reserved: string;
    staleClass: UsageEnforcementDecision['staleClass'];
    evaluatedAt: string;
  }): UsageEnforcementDecision {
    const { meterKey, delta, def, limit, current, reserved, staleClass, evaluatedAt } = args;
    const projectedWithDelta = UsageAggregateReaders.addNumeric(
      this.counters.projectedValue(current, reserved, def.valueType),
      delta,
      def.valueType,
    );

    if (limit.state === 'UNLIMITED') {
      return {
        allowed: true,
        code: 'unlimited',
        meterKey,
        limitKey: def.limitKey,
        enforcementMode: def.enforcementMode,
        limitState: 'UNLIMITED',
        currentValue: current,
        projectedValue: projectedWithDelta,
        staleClass,
        evaluatedAt,
        notes: ['Unlimited'],
      };
    }

    if (limit.state === 'UNCONFIGURED') {
      return {
        allowed: false,
        code: 'limit_unconfigured',
        meterKey,
        limitKey: def.limitKey,
        enforcementMode: def.enforcementMode,
        limitState: 'UNCONFIGURED',
        currentValue: current,
        projectedValue: projectedWithDelta,
        staleClass,
        evaluatedAt,
      };
    }

    if (staleClass === 'SOURCE_UNAVAILABLE' && def.enforcementMode === 'HARD') {
      return {
        allowed: false,
        code: 'source_unavailable',
        meterKey,
        limitKey: def.limitKey,
        enforcementMode: def.enforcementMode,
        limitState: 'CONFIGURED',
        currentValue: current,
        projectedValue: projectedWithDelta,
        limitValue: limit.value,
        staleClass,
        evaluatedAt,
      };
    }

    if (staleClass === 'STALE' && def.enforcementMode === 'HARD') {
      return {
        allowed: false,
        code: 'usage_stale',
        meterKey,
        limitKey: def.limitKey,
        enforcementMode: def.enforcementMode,
        limitState: 'CONFIGURED',
        currentValue: current,
        projectedValue: projectedWithDelta,
        limitValue: limit.value,
        staleClass,
        evaluatedAt,
      };
    }

    const cmp = UsageAggregateReaders.compareNumeric(projectedWithDelta, limit.value, def.valueType);
    const exceeded = cmp > 0;
    const limitNum = Number(limit.value === '0' ? '1' : limit.value) || 1;
    const projectedNum = Number(projectedWithDelta) || 0;
    const ratio = projectedNum / Math.max(limitNum, 1);
    const thresholdState = exceeded ? 'exceeded' : ratio >= WARNING_THRESHOLD_RATIO ? 'warning' : 'ok';

    if (def.enforcementMode === 'HARD' && exceeded) {
      return {
        allowed: false,
        code: 'limit_exceeded',
        meterKey,
        limitKey: def.limitKey,
        enforcementMode: 'HARD',
        limitState: 'CONFIGURED',
        currentValue: current,
        projectedValue: projectedWithDelta,
        limitValue: limit.value,
        thresholdState,
        staleClass,
        evaluatedAt,
      };
    }

    return {
      allowed: true,
      code: thresholdState === 'warning' ? 'within_limit_warning' : 'within_limit',
      meterKey,
      limitKey: def.limitKey,
      enforcementMode: def.enforcementMode,
      limitState: 'CONFIGURED',
      currentValue: current,
      projectedValue: projectedWithDelta,
      limitValue: limit.value,
      thresholdState,
      staleClass,
      evaluatedAt,
    };
  }

  async assertAllowed(tenantId: string, meterKey: string, delta = '1'): Promise<UsageEnforcementDecision> {
    if (!isUsageMeteringEnabled() || !isUsageMeteringEnforcementEnabled()) {
      return {
        allowed: true,
        code: 'enforcement_disabled',
        meterKey,
        limitKey: getMeterDefinition(meterKey)?.limitKey ?? '',
        enforcementMode: 'HARD',
        limitState: 'UNCONFIGURED',
        currentValue: '0',
        projectedValue: '0',
        staleClass: 'FRESH',
        evaluatedAt: this.periods.now().toISOString(),
      };
    }
    const decision = await this.evaluate(tenantId, meterKey, delta);
    if (!decision.allowed) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Usage Limit Exceeded',
        message: decision.code,
        code: decision.code,
        meterKey: decision.meterKey,
        limitKey: decision.limitKey,
        upgradeRequired: decision.code === 'limit_exceeded',
      });
    }
    return decision;
  }

  /**
   * Atomically evaluate hard limit then apply INCREMENT or RESERVE under row lock.
   * Capacity-1 concurrency: at most one waiter succeeds when remaining is 1.
   */
  async assertHardAllowThenApply(
    tenantId: string,
    meterKey: string,
    delta = '1',
    operation: 'INCREMENT' | 'RESERVE' = 'RESERVE',
    sourceEventId?: string,
  ): Promise<{ decision: UsageEnforcementDecision; observationId?: string }> {
    if (!isUsageMeteringEnabled() || !isUsageMeteringEnforcementEnabled()) {
      const decision = await this.assertAllowed(tenantId, meterKey, delta);
      return { decision };
    }
    if (!this.ingestion) {
      const decision = await this.assertAllowed(tenantId, meterKey, delta);
      return { decision };
    }

    const def = getMeterDefinition(meterKey);
    if (!def) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Usage Limit Exceeded',
        message: 'meter_unsupported',
        code: 'meter_unsupported',
        meterKey,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const period = this.periods.resolve(def.periodType);
      const counter = await this.counters.getOrCreate(tenantId, meterKey, period, tx);
      await tx.$queryRaw`SELECT id FROM platform_usage_counters WHERE id = ${counter.id}::uuid FOR UPDATE`;
      const locked = await tx.platformUsageCounter.findUniqueOrThrow({ where: { id: counter.id } });

      const limit = await this.entitlements.getLimit(tenantId, def.limitKey);
      let current = locked.currentValue;
      let staleClass = this.counters.classifyStale(
        locked.lastReconciledAt ?? locked.lastObservationAt,
        STALE_THRESHOLD_MS,
      );
      if (staleClass === 'STALE' && def.reconciliationMode === 'LIVE_AGGREGATE') {
        const agg = await this.readers.readExpected(tenantId, meterKey);
        if (!agg.ok) staleClass = 'SOURCE_UNAVAILABLE';
        else {
          current = agg.value;
          staleClass = 'FRESH';
        }
      }

      const decision = this.decideFromState({
        tenantId,
        meterKey,
        delta,
        def,
        limit,
        current,
        reserved: locked.reservedValue,
        staleClass,
        evaluatedAt: this.periods.now().toISOString(),
      });
      if (!decision.allowed) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Usage Limit Exceeded',
          message: decision.code,
          code: decision.code,
          meterKey: decision.meterKey,
          limitKey: decision.limitKey,
          upgradeRequired: decision.code === 'limit_exceeded',
        });
      }

      const result = await this.ingestion!.ingest(
        {
          tenantId,
          meterKey,
          operation,
          value: delta,
          occurredAt: this.periods.now().toISOString(),
          source: operation === 'INCREMENT' ? 'usage.enforcement.increment' : 'usage.enforcement.reserve',
          sourceEventId: sourceEventId ?? `${operation.toLowerCase()}:${tenantId}:${meterKey}:${randomish()}`,
          schemaVersion: USAGE_OBSERVATION_SCHEMA,
        },
        tx,
      );
      return { decision, observationId: result.observationId as string };
    });
  }

  async assertHardAllowThenReserve(
    tenantId: string,
    meterKey: string,
    delta = '1',
    sourceEventId?: string,
  ): Promise<{ decision: UsageEnforcementDecision; reservationId?: string }> {
    const r = await this.assertHardAllowThenApply(tenantId, meterKey, delta, 'RESERVE', sourceEventId);
    return { decision: r.decision, reservationId: r.observationId };
  }

  async releaseReservation(
    tenantId: string,
    meterKey: string,
    delta = '1',
    sourceEventId?: string,
  ): Promise<void> {
    if (!this.ingestion) return;
    await this.ingestion.ingest({
      tenantId,
      meterKey,
      operation: 'RELEASE',
      value: delta,
      occurredAt: this.periods.now().toISOString(),
      source: 'usage.enforcement.release',
      sourceEventId: sourceEventId ?? 'release:' + tenantId + ':' + meterKey + ':' + randomish(),
      schemaVersion: USAGE_OBSERVATION_SCHEMA,
    });
  }

  async assertResourceAllowed(tenantId: string, resource: string, delta = '1'): Promise<UsageEnforcementDecision | null> {
    const meterKey = RESOURCE_TO_METER[resource];
    if (!meterKey) return null;
    return this.assertAllowed(tenantId, meterKey, delta);
  }
}

function randomish(): string {
  return Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}
