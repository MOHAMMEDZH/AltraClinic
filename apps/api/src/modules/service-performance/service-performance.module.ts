import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { ServicePerformanceController } from './api/service-performance.controller';
import { ServicePerformanceService } from './services/service-performance.service';
import { SERVICE_PERFORMANCE_AUDIT_LOG } from './ports/service-performance-audit-log.port';
import { AuditTrailServicePerformanceAuditLog } from './infrastructure/audit-trail-service-performance-audit-log';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ServicePerformanceController],
  providers: [
    ServicePerformanceService,
    {
      provide: SERVICE_PERFORMANCE_AUDIT_LOG,
      useClass: AuditTrailServicePerformanceAuditLog,
    },
  ],
  exports: [ServicePerformanceService],
})
export class ServicePerformanceModule {}
