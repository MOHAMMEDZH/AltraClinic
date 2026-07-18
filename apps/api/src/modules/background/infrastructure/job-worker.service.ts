import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { BullMqConnectionService } from './bullmq-connection.service';
import { QueueMetricsService } from '../../../infrastructure/redis/services/queue-metrics.service';
import { TenantExecutionService } from '../../../infrastructure/tenant-execution.service';
import {
  BACKGROUND_JOBS,
  BACKGROUND_QUEUES,
  BackgroundQueueName,
} from '../config/queue-names';
import { OutboxProcessorService } from '../application/services/outbox-processor.service';
import { NotificationProcessorService } from '../application/services/notification-processor.service';
import { SubscriptionReminderService } from '../application/services/subscription-reminder.service';
import { InventoryAlertService } from '../application/services/inventory-alert.service';
import { AppointmentNoShowService } from '../application/services/appointment-no-show.service';
import { AppointmentReminderService } from '../application/services/appointment-reminder.service';
import { BeautyFollowUpReminderService } from '../application/services/beauty-follow-up-reminder.service';
import { AnalyticsRollupService } from '../application/services/analytics-rollup.service';
import { BillingOverdueService } from '../application/services/billing-overdue.service';
import { ScheduledAnalyticsReportService } from '../../analytics/application/services/scheduled-analytics-report.service';
import { NotificationAutomationSchedulerService } from '../application/services/notification-automation-scheduler.service';
import { WorkflowEscalationService } from '../../workflow/application/services/workflow-escalation.service';

function workersEnabled(): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  if (process.env.BACKGROUND_WORKERS_ENABLED === 'false') return false;
  return true;
}

@Injectable()
export class JobWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobWorkerService.name);
  private readonly workers: Worker[] = [];

  constructor(
    private readonly bullMq: BullMqConnectionService,
    private readonly queueMetrics: QueueMetricsService,
    private readonly tenantExecution: TenantExecutionService,
    private readonly outboxProcessor: OutboxProcessorService,
    private readonly notificationProcessor: NotificationProcessorService,
    private readonly subscriptionReminders: SubscriptionReminderService,
    private readonly inventoryAlerts: InventoryAlertService,
    private readonly analyticsRollup: AnalyticsRollupService,
    private readonly appointmentNoShow: AppointmentNoShowService,
    private readonly appointmentReminders: AppointmentReminderService,
    private readonly beautyFollowUpReminders: BeautyFollowUpReminderService,
    private readonly billingOverdue: BillingOverdueService,
    private readonly scheduledReports: ScheduledAnalyticsReportService,
    private readonly notificationAutomationScheduler: NotificationAutomationSchedulerService,
    private readonly workflowEscalation: WorkflowEscalationService,
  ) {}

  onModuleInit(): void {
    if (!workersEnabled()) {
      this.logger.log('Background workers disabled (test or BACKGROUND_WORKERS_ENABLED=false)');
      return;
    }

    this.registerWorker(BACKGROUND_QUEUES.OUTBOX, async (job) => {
      if (job.name === BACKGROUND_JOBS.OUTBOX_PROCESS) {
        return this.runBackgroundJob(BACKGROUND_QUEUES.OUTBOX, job.name, () => this.outboxProcessor.processPending());
      }
    });

    this.registerWorker(BACKGROUND_QUEUES.NOTIFICATIONS, async (job) => {
      if (job.name === BACKGROUND_JOBS.NOTIFICATIONS_PROCESS) {
        return this.runBackgroundJob(BACKGROUND_QUEUES.NOTIFICATIONS, job.name, () => this.notificationProcessor.processQueued());
      }
    });

    this.registerWorker(BACKGROUND_QUEUES.SUBSCRIPTION_REMINDERS, async (job) => {
      if (job.name === BACKGROUND_JOBS.SUBSCRIPTION_SCAN) {
        return this.runBackgroundJob(BACKGROUND_QUEUES.SUBSCRIPTION_REMINDERS, job.name, () => this.subscriptionReminders.scanAndSendReminders());
      }
    });

    this.registerWorker(BACKGROUND_QUEUES.INVENTORY_ALERTS, async (job) => {
      if (job.name === BACKGROUND_JOBS.INVENTORY_SCAN) {
        return this.runBackgroundJob(BACKGROUND_QUEUES.INVENTORY_ALERTS, job.name, () => this.inventoryAlerts.scanAndSendAlerts());
      }
    });

    this.registerWorker(BACKGROUND_QUEUES.ANALYTICS, async (job) => {
      if (job.name === BACKGROUND_JOBS.ANALYTICS_ROLLUP) {
        return this.runBackgroundJob(BACKGROUND_QUEUES.ANALYTICS, job.name, () => this.analyticsRollup.aggregateDaily());
      }
    });

    this.registerWorker(BACKGROUND_QUEUES.APPOINTMENT_NO_SHOW, async (job) => {
      if (job.name === BACKGROUND_JOBS.NO_SHOW_SCAN) {
        return this.runBackgroundJob(BACKGROUND_QUEUES.APPOINTMENT_NO_SHOW, job.name, () => this.appointmentNoShow.scanAndMarkNoShows());
      }
    });

    this.registerWorker(BACKGROUND_QUEUES.APPOINTMENT_REMINDERS, async (job) => {
      if (job.name === BACKGROUND_JOBS.APPOINTMENT_REMINDER_SCAN) {
        return this.runBackgroundJob(BACKGROUND_QUEUES.APPOINTMENT_REMINDERS, job.name, async () => {
          const appt = await this.appointmentReminders.scanAndSendReminders();
          const beauty = await this.beautyFollowUpReminders.scanAndNotify();
          return { ...appt, beautyFollowUps: beauty.remindersSent };
        });
      }
    });

    this.registerWorker(BACKGROUND_QUEUES.BILLING_OVERDUE, async (job) => {
      if (job.name === BACKGROUND_JOBS.BILLING_OVERDUE_SCAN) {
        return this.runBackgroundJob(BACKGROUND_QUEUES.BILLING_OVERDUE, job.name, () => this.billingOverdue.scanAndMarkOverdue());
      }
    });

    this.registerWorker(BACKGROUND_QUEUES.SCHEDULED_REPORTS, async (job) => {
      if (job.name === BACKGROUND_JOBS.SCHEDULED_REPORTS_SCAN) {
        return this.runBackgroundJob(BACKGROUND_QUEUES.SCHEDULED_REPORTS, job.name, () => this.scheduledReports.scanAndRunDueReports());
      }
    });

    this.registerWorker(BACKGROUND_QUEUES.NOTIFICATION_AUTOMATION, async (job) => {
      if (job.name === BACKGROUND_JOBS.NOTIFICATION_AUTOMATION_SCAN) {
        return this.runBackgroundJob(BACKGROUND_QUEUES.NOTIFICATION_AUTOMATION, job.name, () => this.notificationAutomationScheduler.scanDueScheduledRules());
      }
    });

    this.registerWorker(BACKGROUND_QUEUES.WORKFLOW_ESCALATION, async (job) => {
      if (job.name === BACKGROUND_JOBS.WORKFLOW_ESCALATION_SCAN) {
        return this.runBackgroundJob(BACKGROUND_QUEUES.WORKFLOW_ESCALATION, job.name, () => this.workflowEscalation.processOverdueTasksAndApprovals());
      }
    });

    this.logger.log(`Started ${this.workers.length} BullMQ workers`);
  }

  /** Wrap background job handlers in audited platform RLS bypass for cross-tenant scans. */
  private runBackgroundJob<T>(queueName: BackgroundQueueName, jobName: string, fn: () => Promise<T>): Promise<T> {
    return this.tenantExecution.runWithPlatformBypass(
      {
        actorId: 'system',
        action: `background.${queueName}.${jobName}`,
        resourceType: 'background_job',
        reason: 'Scheduled background worker cross-tenant scan',
      },
      fn,
    );
  }

  private registerWorker(
    queueName: BackgroundQueueName,
    processor: (job: Job) => Promise<unknown>,
  ): void {
    const worker = new Worker(
      queueName,
      async (job) => {
        try {
          const result = await processor(job);
          await this.queueMetrics.recordCompleted(queueName);
          return result;
        } catch (error) {
          await this.queueMetrics.recordFailed(queueName);
          throw error;
        }
      },
      {
        connection: this.bullMq.connection,
        concurrency: 2,
      },
    );

    worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.name} on ${queueName} failed: ${err.message}`);
    });

    this.workers.push(worker);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
  }
}
