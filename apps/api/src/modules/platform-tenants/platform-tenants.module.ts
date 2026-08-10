/**
 * Release 47 Step 11 — Tenant Directory / Detail module.
 */
import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { PlatformTenantsController } from './api/platform-tenants.controller';
import { PlatformTenantsDirectoryService } from './application/platform-tenants-directory.service';
import { PlatformTenantsDetailService } from './application/platform-tenants-detail.service';
import { AuditTrailPlatformTenantsAuditLog } from './infrastructure/audit-trail-platform-tenants-audit-log';
import {
  PLATFORM_TENANTS_CONFIG,
  loadPlatformTenantsConfig,
  type PlatformTenantsConfig,
} from './config/platform-tenants.config';
import { PLATFORM_TENANTS_AUDIT_LOG } from './platform-tenants.tokens';

@Module({
  imports: [forwardRef(() => AuthModule), AuditModule, SubscriptionModule],
  controllers: [PlatformTenantsController],
  providers: [
    PlatformTenantsDirectoryService,
    PlatformTenantsDetailService,
    {
      provide: PLATFORM_TENANTS_CONFIG,
      useFactory: (): PlatformTenantsConfig => loadPlatformTenantsConfig(),
    },
    {
      provide: PLATFORM_TENANTS_AUDIT_LOG,
      useClass: AuditTrailPlatformTenantsAuditLog,
    },
  ],
  exports: [PlatformTenantsDirectoryService, PlatformTenantsDetailService],
})
export class PlatformTenantsModule {}
