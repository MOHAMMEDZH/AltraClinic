import { Module, forwardRef } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { AuthModule } from '../auth/auth.module';
import { PlatformSubscriptionsModule } from '../platform-subscriptions/platform-subscriptions.module';
import { EffectiveEntitlementRuntimeModule } from '../effective-entitlement-runtime/effective-entitlement-runtime.module';
import { PlatformSalesTrialsController } from './api/platform-sales-trials.controller';
import { TrialAdminService } from './application/trial-admin.service';
import { TrialAuditLog } from './application/trial-audit.log';
import { TrialConversionService } from './application/trial-conversion.service';
import { TrialDurableIdempotencyService } from './application/trial-durable-idempotency.service';
import { TrialEntitlementPreviewService } from './application/trial-entitlement-preview.service';
import { TrialExpiryService } from './application/trial-expiry.service';
import { TrialProvisioningAdapter } from './application/trial-provisioning.adapter';

/**
 * Flexible Step 25 — Trial Creation and Customer Conversion.
 * Contract: docs/TRIAL_CREATION_AND_CUSTOMER_CONVERSION.md
 *
 * Governance only: entitlements stay with the Step 16 commercial snapshot and the
 * Step 18 EER. No Step 26 commission/productivity, no billing, no PHI.
 */
@Module({
  imports: [
    InfrastructureModule,
    forwardRef(() => AuthModule),
    PlatformSubscriptionsModule,
    EffectiveEntitlementRuntimeModule,
  ],
  controllers: [PlatformSalesTrialsController],
  providers: [
    TrialAdminService,
    TrialAuditLog,
    TrialDurableIdempotencyService,
    TrialProvisioningAdapter,
    TrialEntitlementPreviewService,
    TrialExpiryService,
    TrialConversionService,
  ],
  exports: [
    TrialAdminService,
    TrialExpiryService,
    TrialConversionService,
    TrialEntitlementPreviewService,
  ],
})
export class PlatformSalesTrialsModule {}
