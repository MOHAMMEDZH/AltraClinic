import { Module, forwardRef } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { AuthModule } from '../auth/auth.module';
import { FeatureFlagIdempotencyService } from './application/feature-flag-idempotency.service';
import { FeatureFlagsSettingsAuditLog } from './application/feature-flags-settings-audit.log';
import { FeatureFlagsSettingsRateLimitService } from './application/feature-flags-settings-rate-limit.service';
import { FeatureFlagsSettingsService } from './application/feature-flags-settings.service';
import { OperationalDecisionService } from './application/operational-decision.service';
import {
  FeatureFlagsController,
  GlobalSettingsController,
} from './controllers/feature-flags.controller';

/**
 * Flexible Step 20 — Feature Flags and Global Settings.
 * Contained behind FEATURE_FLAGS_SETTINGS_ENABLED (default false).
 * Never grants commercial entitlements.
 */
@Module({
  imports: [InfrastructureModule, forwardRef(() => AuthModule)],
  controllers: [FeatureFlagsController, GlobalSettingsController],
  providers: [
    FeatureFlagIdempotencyService,
    FeatureFlagsSettingsAuditLog,
    FeatureFlagsSettingsRateLimitService,
    FeatureFlagsSettingsService,
    OperationalDecisionService,
  ],
  exports: [OperationalDecisionService, FeatureFlagsSettingsService],
})
export class FeatureFlagsSettingsModule {}
