import { Module, forwardRef } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { AuthModule } from '../auth/auth.module';
import { EffectiveEntitlementRuntimeModule } from '../effective-entitlement-runtime/effective-entitlement-runtime.module';
import { UsagePeriodResolver } from './application/usage-period.resolver';
import { UsageAggregateReaders } from './application/usage-aggregate.readers';
import { UsageIdempotencyService } from './application/usage-idempotency.service';
import { UsageCounterService } from './application/usage-counter.service';
import { UsageObservationIngestionService } from './application/usage-observation-ingestion.service';
import { UsageReconciliationService } from './application/usage-reconciliation.service';
import { UsageEnforcementService } from './application/usage-enforcement.service';
import { UsageInspectionService } from './application/usage-inspection.service';
import { UsageMeteringPlatformController } from './controllers/usage-metering-platform.controller';

/**
 * Supplemental Capability U01 — Usage Metering & Limit Enforcement.
 * Defaults OFF. Rollback / gate: USAGE_METERING_ENABLED / USAGE_METERING_ENFORCEMENT_ENABLED / USAGE_METERING_INGESTION_ENABLED.
 */
@Module({
  imports: [InfrastructureModule, forwardRef(() => AuthModule), EffectiveEntitlementRuntimeModule],
  controllers: [UsageMeteringPlatformController],
  providers: [
    { provide: UsagePeriodResolver, useFactory: () => new UsagePeriodResolver() },
    UsageAggregateReaders,
    UsageIdempotencyService,
    UsageCounterService,
    UsageObservationIngestionService,
    UsageReconciliationService,
    UsageEnforcementService,
    UsageInspectionService,
  ],
  exports: [
    UsageEnforcementService,
    UsageObservationIngestionService,
    UsageReconciliationService,
    UsageInspectionService,
    UsageCounterService,
    UsagePeriodResolver,
    UsageAggregateReaders,
  ],
})
export class UsageMeteringModule {}
