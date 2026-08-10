import { Module, forwardRef } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { AuthModule } from '../auth/auth.module';
import { PlatformSalesRepresentativesController } from './api/platform-sales-representatives.controller';
import { SalesRepresentativeAdminService } from './application/sales-representative-admin.service';
import { SalesCustomerOwnershipService } from './application/sales-customer-ownership.service';
import { SalesDurableIdempotencyService } from './application/sales-durable-idempotency.service';
import { SalesAuditLog } from './application/sales-audit.log';

/**
 * Flexible Step 23 — Sales Representative Management.
 * Contract: docs/SALES_REPRESENTATIVE_MANAGEMENT.md
 * Aggregates existing Platform identity/auth/RBAC/session SoRs — never a
 * parallel credential/session/role store. No Step 24+ (Leads/Pipeline/Trials).
 */
@Module({
  imports: [InfrastructureModule, forwardRef(() => AuthModule)],
  controllers: [PlatformSalesRepresentativesController],
  providers: [
    SalesRepresentativeAdminService,
    SalesCustomerOwnershipService,
    SalesDurableIdempotencyService,
    SalesAuditLog,
  ],
  exports: [SalesRepresentativeAdminService, SalesCustomerOwnershipService],
})
export class PlatformSalesRepresentativesModule {}
