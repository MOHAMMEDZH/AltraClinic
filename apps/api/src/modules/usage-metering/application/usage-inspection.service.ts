import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { STATIC_USAGE_METER_CATALOG, getMeterDefinition } from '../catalog/static-usage-meter.catalog';
import { isUsageMeteringEnabled } from '../usage-metering.constants';
import type { UsageExplainProjection, UsageMeterProjection } from '../domain/usage-metering.types';
import { UsageMeteringError } from '../domain/usage-metering.types';
import { UsageCounterService } from './usage-counter.service';
import { UsageEnforcementService } from './usage-enforcement.service';
import { UsagePeriodResolver } from './usage-period.resolver';
import { UsageReconciliationService } from './usage-reconciliation.service';

@Injectable()
export class UsageInspectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: PlatformAuthorizationService,
    private readonly counters: UsageCounterService,
    private readonly periods: UsagePeriodResolver,
    private readonly enforcement: UsageEnforcementService,
    private readonly reconciliation: UsageReconciliationService,
  ) {}

  private async require(claims: JwtClaimsVO, key: string): Promise<void> {
    const perms = new Set(await this.authorization.resolveEffectivePermissions(claims.sub));
    if (!perms.has(key)) throw new ForbiddenException(`Missing ${key} permission.`);
  }

  async listMeters(claims: JwtClaimsVO, tenantId: string): Promise<{ tenantId: string; meters: UsageMeterProjection[] }> {
    if (!isUsageMeteringEnabled()) throw new UsageMeteringError('metering_disabled', 'Usage metering is disabled', 503);
    await this.require(claims, 'usage.view');
    const meters: UsageMeterProjection[] = [];
    for (const def of STATIC_USAGE_METER_CATALOG) {
      meters.push(await this.projectMeter(tenantId, def.meterKey));
    }
    return { tenantId, meters };
  }

  async getMeter(claims: JwtClaimsVO, tenantId: string, meterKey: string): Promise<UsageMeterProjection> {
    if (!isUsageMeteringEnabled()) throw new UsageMeteringError('metering_disabled', 'Usage metering is disabled', 503);
    await this.require(claims, 'usage.view');
    if (!getMeterDefinition(meterKey)) throw new NotFoundException(`Unknown meter: ${meterKey}`);
    return this.projectMeter(tenantId, meterKey);
  }

  async explain(claims: JwtClaimsVO, tenantId: string, meterKey: string): Promise<UsageExplainProjection> {
    if (!isUsageMeteringEnabled()) throw new UsageMeteringError('metering_disabled', 'Usage metering is disabled', 503);
    await this.require(claims, 'usage.view');
    const def = getMeterDefinition(meterKey);
    if (!def) throw new NotFoundException(`Unknown meter: ${meterKey}`);
    const base = await this.projectMeter(tenantId, meterKey);
    const decision = await this.enforcement.evaluate(tenantId, meterKey, '0');
    return {
      ...base,
      decision,
      sourceOwner: def.sourceOwner,
      reconciliationMode: def.reconciliationMode,
    };
  }

  async reconcile(claims: JwtClaimsVO, tenantId: string, meterKey: string, idempotencyKey?: string) {
    if (!isUsageMeteringEnabled()) throw new UsageMeteringError('metering_disabled', 'Usage metering is disabled', 503);
    await this.require(claims, 'usage.reconcile');
    if (!getMeterDefinition(meterKey)) throw new NotFoundException(`Unknown meter: ${meterKey}`);
    return this.reconciliation.reconcile(tenantId, meterKey, idempotencyKey);
  }

  private async projectMeter(tenantId: string, meterKey: string): Promise<UsageMeterProjection> {
    const def = getMeterDefinition(meterKey)!;
    const period = this.periods.resolve(def.periodType);
    const counter = await this.counters.getOrCreate(tenantId, meterKey, period);
    const decision = await this.enforcement.evaluate(tenantId, meterKey, '0');
    const checkpoint = await this.prisma.platformUsageReconciliationCheckpoint.findUnique({
      where: {
        tenantId_meterKey_periodType_periodStart_schemaVersion: {
          tenantId,
          meterKey,
          periodType: period.periodType,
          periodStart: period.periodStart,
          schemaVersion: counter.schemaVersion,
        },
      },
    });

    return {
      meterKey,
      limitKey: def.limitKey,
      valueType: def.valueType,
      periodType: def.periodType,
      periodStart: period.periodStart.toISOString(),
      periodEnd: period.periodEnd.toISOString(),
      currentValue: counter.currentValue,
      reservedValue: counter.reservedValue,
      projectedValue: decision.projectedValue,
      limitState: decision.limitState,
      limitValue: decision.limitValue,
      enforcementMode: def.enforcementMode,
      thresholdState: decision.thresholdState,
      staleClass: decision.staleClass,
      driftClass: (checkpoint?.driftClass as UsageMeterProjection['driftClass']) ?? undefined,
      lastObservationAt: counter.lastObservationAt?.toISOString() ?? null,
      lastReconciledAt: counter.lastReconciledAt?.toISOString() ?? null,
      privacyClass: def.privacyClass,
    };
  }
}
