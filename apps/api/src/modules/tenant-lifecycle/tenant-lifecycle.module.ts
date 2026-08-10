import { Module, forwardRef } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { AuthModule } from '../auth/auth.module';
import { EffectiveEntitlementRuntimeModule } from '../effective-entitlement-runtime/effective-entitlement-runtime.module';
import { LifecycleIdempotencyService } from './application/lifecycle-idempotency.service';
import { TenantLifecycleAuditLog } from './application/tenant-lifecycle-audit.log';
import { TenantLifecyclePreviewService } from './application/tenant-lifecycle-preview.service';
import { TenantLifecycleRateLimitService } from './application/tenant-lifecycle-rate-limit.service';
import { TenantLifecycleService } from './application/tenant-lifecycle.service';
import {
  TenantLifecycleController,
  TenantLifecycleRequestsController,
} from './controllers/tenant-lifecycle.controller';

/**
 * Flexible Step 19 — Tenant Lifecycle Actions.
 * Contained behind TENANT_LIFECYCLE_ENABLED (default false).
 * Does not own Step 17 onboarding or Step 16 commercial SoR.
 */
@Module({
  imports: [
    InfrastructureModule,
    forwardRef(() => AuthModule),
    EffectiveEntitlementRuntimeModule,
  ],
  controllers: [TenantLifecycleController, TenantLifecycleRequestsController],
  providers: [
    LifecycleIdempotencyService,
    TenantLifecycleAuditLog,
    TenantLifecyclePreviewService,
    TenantLifecycleRateLimitService,
    TenantLifecycleService,
  ],
  exports: [TenantLifecycleService],
})
export class TenantLifecycleModule {}
