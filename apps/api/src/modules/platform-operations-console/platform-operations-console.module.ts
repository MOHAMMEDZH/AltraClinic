import { Module, forwardRef } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { AuthModule } from '../auth/auth.module';
import { TenantProvisioningModule } from '../tenant-provisioning/tenant-provisioning.module';
import { EffectiveEntitlementRuntimeModule } from '../effective-entitlement-runtime/effective-entitlement-runtime.module';
import { ObservabilityModule } from '../observability/observability.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { BackupRestoreModule } from '../backup-restore/backup-restore.module';
import { OpsQueryService } from './application/ops-query.service';
import { OpsActionService } from './application/ops-action.service';
import { OpsAuditLog } from './application/ops-audit.log';
import { OpsIdempotencyService } from './application/ops-idempotency.service';
import { OpsDurableIdempotencyService } from './application/ops-durable-idempotency.service';
import { OpsRateLimitService } from './application/ops-rate-limit.service';
import { PlatformOperationsConsoleController } from './controllers/platform-operations-console.controller';

/**
 * Flexible Step 22 — Platform Operations Console.
 * Contained behind OPERATIONS_CONSOLE_ENABLED (default false).
 * Aggregation/control plane over existing SoRs — no duplicate engines.
 */
@Module({
  imports: [
    InfrastructureModule,
    forwardRef(() => AuthModule),
    forwardRef(() => TenantProvisioningModule),
    forwardRef(() => EffectiveEntitlementRuntimeModule),
    forwardRef(() => ObservabilityModule),
    forwardRef(() => IntegrationsModule),
    forwardRef(() => BackupRestoreModule),
  ],
  controllers: [PlatformOperationsConsoleController],
  providers: [
    OpsQueryService,
    OpsActionService,
    OpsAuditLog,
    OpsIdempotencyService,
    OpsDurableIdempotencyService,
    OpsRateLimitService,
  ],
  exports: [OpsQueryService, OpsActionService],
})
export class PlatformOperationsConsoleModule {}
