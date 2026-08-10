import { Module, forwardRef } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { PlatformSubscriptionsModule } from '../platform-subscriptions/platform-subscriptions.module';
import { EffectiveEntitlementRuntimeModule } from '../effective-entitlement-runtime/effective-entitlement-runtime.module';
import { ProvisioningIdempotencyService } from './application/provisioning-idempotency.service';
import { TenantProvisioningValidationService } from './application/tenant-provisioning-validation.service';
import { TenantAdminInvitationAdapter } from './application/tenant-admin-invitation.adapter';
import { TenantProvisioningRateLimitService } from './application/tenant-provisioning-rate-limit.service';
import { TenantProvisioningAuditLog } from './application/tenant-provisioning-audit.log';
import { TenantProvisioningService } from './application/tenant-provisioning.service';
import { TenantProvisioningController } from './controllers/tenant-provisioning.controller';

/**
 * Flexible Step 17 — Tenant Creation and Provisioning.
 * Contained behind TENANT_PROVISIONING_ENABLED (default false).
 * Onboarding only — does not own Step 19 lifecycle administration.
 */
@Module({
  imports: [
    InfrastructureModule,
    forwardRef(() => AuthModule),
    TenantModule,
    PlatformSubscriptionsModule,
    EffectiveEntitlementRuntimeModule,
  ],
  controllers: [TenantProvisioningController],
  providers: [
    ProvisioningIdempotencyService,
    TenantProvisioningValidationService,
    TenantAdminInvitationAdapter,
    TenantProvisioningRateLimitService,
    TenantProvisioningAuditLog,
    TenantProvisioningService,
  ],
  exports: [TenantProvisioningService, TenantProvisioningValidationService],
})
export class TenantProvisioningModule {}
