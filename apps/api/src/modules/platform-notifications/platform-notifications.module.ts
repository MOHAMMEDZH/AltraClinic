import { Module, forwardRef } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notifications/notifications.module';
import { PlatformNotificationsController } from './api/platform-notifications.controller';
import { PlatformNotificationAuditLog } from './application/platform-notification-audit.log';
import { PlatformNotificationDispatchService } from './application/platform-notification-dispatch.service';
import { PlatformNotificationQueryService } from './application/platform-notification-query.service';
import { PlatformNotificationPreferenceService } from './application/preferences/platform-notification-preference.service';
import { PlatformNotificationEventAdapters } from './application/adapters/platform-notification-event.adapters';
import { PlatformNotificationWarningScheduler } from './application/schedulers/platform-notification-warning.scheduler';

/**
 * Flexible Step 27 — Platform Notifications and Templates.
 * Reuses Phase 41d DeliveryModule via NotificationModule exports — no second engine.
 */
@Module({
  imports: [
    InfrastructureModule,
    forwardRef(() => AuthModule),
    forwardRef(() => NotificationModule),
  ],
  controllers: [PlatformNotificationsController],
  providers: [
    PlatformNotificationAuditLog,
    PlatformNotificationPreferenceService,
    PlatformNotificationDispatchService,
    PlatformNotificationQueryService,
    PlatformNotificationEventAdapters,
    PlatformNotificationWarningScheduler,
  ],
  exports: [
    PlatformNotificationDispatchService,
    PlatformNotificationEventAdapters,
    PlatformNotificationWarningScheduler,
    PlatformNotificationQueryService,
  ],
})
export class PlatformNotificationsModule {}
