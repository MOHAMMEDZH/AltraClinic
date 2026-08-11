import { Module, forwardRef } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { AuthModule } from '../auth/auth.module';
import { PlatformSalesLeadsController } from './api/platform-sales-leads.controller';
import { LeadAdminService } from './application/lead-admin.service';
import { LeadPlanFitService } from './application/lead-plan-fit.service';
import { LeadDurableIdempotencyService } from './application/lead-durable-idempotency.service';
import { LeadAuditLog } from './application/lead-audit.log';

/**
 * Flexible Step 24 — Leads and Sales Pipeline.
 * Contract: docs/LEADS_AND_SALES_PIPELINE.md
 * Lead is the only CRM aggregate. No Trials / Opportunities table / billing.
 */
@Module({
  imports: [InfrastructureModule, forwardRef(() => AuthModule)],
  controllers: [PlatformSalesLeadsController],
  providers: [LeadAdminService, LeadPlanFitService, LeadDurableIdempotencyService, LeadAuditLog],
  exports: [LeadAdminService, LeadPlanFitService],
})
export class PlatformSalesLeadsModule {}
