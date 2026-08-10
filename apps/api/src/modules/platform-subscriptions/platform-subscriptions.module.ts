import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { PlatformAddonsModule } from '../platform-addons/platform-addons.module';
import { EffectiveEntitlementRuntimeModule } from '../effective-entitlement-runtime/effective-entitlement-runtime.module';
import { PlatformSubscriptionsController } from './api/platform-subscriptions.controller';
import { PlatformSubscriptionsService } from './application/platform-subscriptions.service';
import { SubscriptionIdempotencyService } from './application/subscription-idempotency.service';
import { AuditTrailPlatformSubscriptionsAuditLog } from './infrastructure/audit-trail-platform-subscriptions-audit-log';
import {
  loadPlatformSubscriptionsConfig,
  type PlatformSubscriptionsConfig,
} from './config/platform-subscriptions.config';
import {
  PLATFORM_SUBSCRIPTIONS_AUDIT_LOG,
  PLATFORM_SUBSCRIPTIONS_CONFIG,
} from './platform-subscriptions.tokens';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    AuditModule,
    PlatformAddonsModule,
    EffectiveEntitlementRuntimeModule,
  ],
  controllers: [PlatformSubscriptionsController],
  providers: [
    SubscriptionIdempotencyService,
    {
      provide: PLATFORM_SUBSCRIPTIONS_CONFIG,
      useFactory: (): PlatformSubscriptionsConfig => loadPlatformSubscriptionsConfig(),
    },
    {
      provide: PLATFORM_SUBSCRIPTIONS_AUDIT_LOG,
      useClass: AuditTrailPlatformSubscriptionsAuditLog,
    },
    PlatformSubscriptionsService,
  ],
  exports: [PlatformSubscriptionsService],
})
export class PlatformSubscriptionsModule {}
