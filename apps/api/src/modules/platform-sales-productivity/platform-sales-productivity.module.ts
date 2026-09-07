import { Module, forwardRef } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { AuthModule } from '../auth/auth.module';
import { PlatformSalesProductivityController } from './api/platform-sales-productivity.controller';
import { CommissionAuditLog } from './application/commission-audit.log';
import { CommissionDurableIdempotencyService } from './application/commission-durable-idempotency.service';
import { CommissionSnapshotService } from './application/commission-snapshot.service';
import { ProductivityExportService } from './application/productivity-export.service';
import { ProductivityMetricsService } from './application/productivity-metrics.service';
import { ProductivityQueryService } from './application/productivity-query.service';

/**
 * Flexible Step 26 — Sales Productivity and Commission Snapshot.
 * Contract: docs/SALES_PRODUCTIVITY_AND_COMMISSION_SNAPSHOT.md
 *
 * Review records only: no payroll, no invented rates, no Step 27 notifications.
 * Entitlement/subscription authority stays Steps 16/18.
 */
@Module({
  imports: [InfrastructureModule, forwardRef(() => AuthModule)],
  controllers: [PlatformSalesProductivityController],
  providers: [
    ProductivityMetricsService,
    ProductivityQueryService,
    ProductivityExportService,
    CommissionSnapshotService,
    CommissionDurableIdempotencyService,
    CommissionAuditLog,
  ],
  exports: [
    ProductivityMetricsService,
    ProductivityQueryService,
    CommissionSnapshotService,
  ],
})
export class PlatformSalesProductivityModule {}
