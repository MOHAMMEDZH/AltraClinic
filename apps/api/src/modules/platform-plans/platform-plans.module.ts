import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { PlatformPlansController } from './api/platform-plans.controller';
import { PlatformPlansService } from './application/platform-plans.service';
import { PlanEntitlementsService } from './application/plan-entitlements.service';
import { PlanIdempotencyService } from './application/plan-idempotency.service';
import { PlatformPlansSeedService } from './application/plan-seed.service';
import { AuditTrailPlatformPlansAuditLog } from './infrastructure/audit-trail-platform-plans-audit-log';
import { loadPlatformPlansConfig, type PlatformPlansConfig } from './config/platform-plans.config';
import { PLATFORM_PLANS_AUDIT_LOG, PLATFORM_PLANS_CONFIG } from './platform-plans.tokens';

@Module({
  imports: [forwardRef(() => AuthModule), AuditModule],
  controllers: [PlatformPlansController],
  providers: [
    PlatformPlansSeedService,
    PlanIdempotencyService,
    {
      provide: PLATFORM_PLANS_CONFIG,
      useFactory: (): PlatformPlansConfig => loadPlatformPlansConfig(),
    },
    {
      provide: PLATFORM_PLANS_AUDIT_LOG,
      useClass: AuditTrailPlatformPlansAuditLog,
    },
    PlanEntitlementsService,
    PlatformPlansService,
  ],
  exports: [PlatformPlansService, PlatformPlansSeedService, PlanEntitlementsService],
})
export class PlatformPlansModule {}
