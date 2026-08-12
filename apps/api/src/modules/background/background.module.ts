import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationModule } from '../notifications/notifications.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { PlatformSalesTrialsModule } from '../platform-sales-trials/platform-sales-trials.module';
import { PlatformNotificationsModule } from '../platform-notifications/platform-notifications.module';
import { BullMqConnectionService } from './infrastructure/bullmq-connection.service';
import { JobQueueService } from './infrastructure/job-queue.service';
import { JobWorkerService } from './infrastructure/job-worker.service';
import { BackgroundScheduler } from './schedulers/background.scheduler';
import { JobDeduplicationService } from './application/services/job-deduplication.service';
import { OutboxEventRehydratorService } from './application/services/outbox-event-rehydrator.service';
import { OutboxProcessorService } from './application/services/outbox-processor.service';
import { SubscriptionReminderService } from './application/services/subscription-reminder.service';
import { InventoryAlertService } from './application/services/inventory-alert.service';
import { NotificationProcessorService } from './application/services/notification-processor.service';
import { AppointmentNoShowService } from './application/services/appointment-no-show.service';
import { AppointmentReminderService } from './application/services/appointment-reminder.service';
import { BeautyFollowUpReminderService } from './application/services/beauty-follow-up-reminder.service';
import { AnalyticsRollupService } from './application/services/analytics-rollup.service';
import { BillingOverdueService } from './application/services/billing-overdue.service';
import { NotificationAutomationSchedulerService } from './application/services/notification-automation-scheduler.service';
import { smsSenderProvider } from '../auth/infrastructure/services/sms-sender.provider';
import { pushSenderProvider } from '../auth/infrastructure/services/push-sender.provider';

/**
 * Background processing bounded context.
 *
 * NestJS Schedule cron → BullMQ queues → in-process workers (Phase 1).
 * Workers can be split to a dedicated process in Phase 2 via the same queue names.
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    NotificationModule,
    AnalyticsModule,
    WorkflowModule,
    SubscriptionModule,
    PlatformSalesTrialsModule,
    PlatformNotificationsModule,
  ],
  providers: [
    smsSenderProvider,
    pushSenderProvider,
    BullMqConnectionService,
    JobQueueService,
    JobWorkerService,
    BackgroundScheduler,
    JobDeduplicationService,
    OutboxEventRehydratorService,
    OutboxProcessorService,
    SubscriptionReminderService,
    InventoryAlertService,
    NotificationProcessorService,
    AnalyticsRollupService,
    AppointmentNoShowService,
    AppointmentReminderService,
    BeautyFollowUpReminderService,
    BillingOverdueService,
    NotificationAutomationSchedulerService,
  ],
  exports: [
    JobQueueService,
    OutboxProcessorService,
    SubscriptionReminderService,
    InventoryAlertService,
    NotificationProcessorService,
    AnalyticsRollupService,
  ],
})
export class BackgroundModule {}
