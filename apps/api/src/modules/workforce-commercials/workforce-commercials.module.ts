import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { WorkforceCommercialsController } from './api/workforce-commercials.controller';
import { StaffCommissionPlanService } from './services/staff-commission-plan.service';
import { CommissionAccrualService } from './services/commission-accrual.service';
import { InvoiceLinePerformanceAttributionService } from './services/invoice-line-performance-attribution.service';
import { CommissionPackageAllocationService } from './services/commission-package-allocation.service';
import { WAVE_F_AUDIT_LOG } from './ports/wave-f-audit-log.port';
import { AuditTrailWaveFAuditLog } from './infrastructure/audit-trail-wave-f-audit-log';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [WorkforceCommercialsController],
  providers: [
    StaffCommissionPlanService,
    CommissionAccrualService,
    InvoiceLinePerformanceAttributionService,
    CommissionPackageAllocationService,
    { provide: WAVE_F_AUDIT_LOG, useClass: AuditTrailWaveFAuditLog },
  ],
  exports: [
    StaffCommissionPlanService,
    CommissionAccrualService,
    InvoiceLinePerformanceAttributionService,
    CommissionPackageAllocationService,
  ],
})
export class WorkforceCommercialsModule {}
