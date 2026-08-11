import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobQueueService } from '../infrastructure/job-queue.service';
import { BACKGROUND_JOBS, BACKGROUND_QUEUES } from '../config/queue-names';

function schedulersEnabled(): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  if (process.env.BACKGROUND_SCHEDULERS_ENABLED === 'false') return false;
  return true;
}

/**
 * Cron schedulers enqueue BullMQ jobs — workers perform the actual processing.
 * Separation keeps HTTP process responsive and allows horizontal worker scaling.
 */
@Injectable()
export class BackgroundScheduler {
  private readonly logger = new Logger(BackgroundScheduler.name);

  constructor(private readonly jobQueue: JobQueueService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduleOutboxProcessing(): Promise<void> {
    if (!schedulersEnabled()) return;
    await this.jobQueue.enqueue(
      BACKGROUND_QUEUES.OUTBOX,
      BACKGROUND_JOBS.OUTBOX_PROCESS,
      {},
      { skipMetrics: true },
    );
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduleNotificationProcessing(): Promise<void> {
    if (!schedulersEnabled()) return;
    await this.jobQueue.enqueue(
      BACKGROUND_QUEUES.NOTIFICATIONS,
      BACKGROUND_JOBS.NOTIFICATIONS_PROCESS,
      {},
      { skipMetrics: true },
    );
  }

  /** Daily at 09:00 UTC — subscription expiration reminders (30/14/7/3/1 day). */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async scheduleSubscriptionReminders(): Promise<void> {
    if (!schedulersEnabled()) return;
    await this.jobQueue.enqueue(
      BACKGROUND_QUEUES.SUBSCRIPTION_REMINDERS,
      BACKGROUND_JOBS.SUBSCRIPTION_SCAN,
      {},
      { skipMetrics: true },
    );
  }

  /** Every 6 hours — low stock and expiry inventory alerts. */
  @Cron('0 */6 * * *')
  async scheduleInventoryAlerts(): Promise<void> {
    if (!schedulersEnabled()) return;
    await this.jobQueue.enqueue(
      BACKGROUND_QUEUES.INVENTORY_ALERTS,
      BACKGROUND_JOBS.INVENTORY_SCAN,
      {},
      { skipMetrics: true },
    );
  }

  /** Every 15 minutes — mark overdue appointments as no-show. */
  @Cron('*/15 * * * *')
  async scheduleAppointmentNoShowScan(): Promise<void> {
    if (!schedulersEnabled()) return;
    await this.jobQueue.enqueue(
      BACKGROUND_QUEUES.APPOINTMENT_NO_SHOW,
      BACKGROUND_JOBS.NO_SHOW_SCAN,
      {},
      { skipMetrics: true },
    );
  }

  /** Every 15 minutes — 24h and 1h appointment reminders. */
  @Cron('*/15 * * * *')
  async scheduleAppointmentReminders(): Promise<void> {
    if (!schedulersEnabled()) return;
    await this.jobQueue.enqueue(
      BACKGROUND_QUEUES.APPOINTMENT_REMINDERS,
      BACKGROUND_JOBS.APPOINTMENT_REMINDER_SCAN,
      {},
      { skipMetrics: true },
    );
  }

  /** Daily at 01:00 UTC — mark past-due invoices as overdue. */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async scheduleBillingOverdueScan(): Promise<void> {
    if (!schedulersEnabled()) return;
    await this.jobQueue.enqueue(
      BACKGROUND_QUEUES.BILLING_OVERDUE,
      BACKGROUND_JOBS.BILLING_OVERDUE_SCAN,
      {},
      { skipMetrics: true },
    );
  }

  /** Hourly — fire notification automation rules with cron schedules. */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduleNotificationAutomationRules(): Promise<void> {
    if (!schedulersEnabled()) return;
    await this.jobQueue.enqueue(
      BACKGROUND_QUEUES.NOTIFICATION_AUTOMATION,
      BACKGROUND_JOBS.NOTIFICATION_AUTOMATION_SCAN,
      {},
      { skipMetrics: true },
    );
  }

  /** Hourly — run due scheduled analytics report templates. */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduleReportRuns(): Promise<void> {
    if (!schedulersEnabled()) return;
    await this.jobQueue.enqueue(
      BACKGROUND_QUEUES.SCHEDULED_REPORTS,
      BACKGROUND_JOBS.SCHEDULED_REPORTS_SCAN,
      {},
      { skipMetrics: true },
    );
  }

  /** Daily at midnight UTC — persist Redis analytics counters. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduleAnalyticsRollup(): Promise<void> {
    if (!schedulersEnabled()) return;
    await this.jobQueue.enqueue(
      BACKGROUND_QUEUES.ANALYTICS,
      BACKGROUND_JOBS.ANALYTICS_ROLLUP,
      {},
      { skipMetrics: true },
    );
  }

  /**
   * Every 15 minutes — expire governed sales trials whose window has elapsed.
   * Enforcement is never UI-only: the worker transitions the aggregate and hands the
   * tenant to the Step 19 deny path.
   */
  @Cron('*/15 * * * *')
  async scheduleSalesTrialExpiryScan(): Promise<void> {
    if (!schedulersEnabled()) return;
    await this.jobQueue.enqueue(
      BACKGROUND_QUEUES.SALES_TRIAL_EXPIRY,
      BACKGROUND_JOBS.SALES_TRIAL_EXPIRY_SCAN,
      {},
      { skipMetrics: true },
    );
  }

  /** Every 15 minutes — escalate overdue workflow tasks and flag approval SLA breaches. */
  @Cron('*/15 * * * *')
  async scheduleWorkflowEscalationScan(): Promise<void> {
    if (!schedulersEnabled()) return;
    await this.jobQueue.enqueue(
      BACKGROUND_QUEUES.WORKFLOW_ESCALATION,
      BACKGROUND_JOBS.WORKFLOW_ESCALATION_SCAN,
      {},
      { skipMetrics: true },
    );
  }
}
