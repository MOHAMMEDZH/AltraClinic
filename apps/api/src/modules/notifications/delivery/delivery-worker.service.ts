import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { BullMqConnectionService } from '../../background/infrastructure/bullmq-connection.service';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantExecutionService } from '../../../infrastructure/tenant-execution.service';
import { CommunicationDispatchService } from '../../subscription/application/services/communication-dispatch.service';
import { CommunicationChannel } from '../../subscription/domain/exceptions/communication-limit-exceeded.exception';
import { isPlatformAuditSentinelTenantId } from '../../platform-tenants/platform-tenants.tokens';
import { DELIVERY_JOB_NAME, DELIVERY_QUEUE_NAME, FailureClass, NotificationChannelId } from './delivery.types';
import { DeliveryJobService } from './delivery-job.service';
import { ReceiptService } from './receipt.service';
import { truncateForChannel } from './template-render.service';
import { NotificationProviderAdapter } from './provider-adapter.contract';
import { InAppAdapter } from './adapters/in-app.adapter';
import { EmailAdapter } from './adapters/email.adapter';
import { SmsAdapter } from './adapters/sms.adapter';
import { WhatsappAdapter } from './adapters/whatsapp.adapter';
import { PushAdapter } from './adapters/push.adapter';
import { WebhookAdapter } from './adapters/webhook.adapter';
import { DeliveryActivityEmitterService } from './delivery-activity-emitter.service';

function workersEnabled(): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  if (process.env.BACKGROUND_WORKERS_ENABLED === 'false') return false;
  return true;
}

const LEDGER_CHANNEL_BY_ID: Partial<Record<NotificationChannelId, CommunicationChannel>> = {
  email: 'EMAIL',
  sms: 'SMS',
  whatsapp: 'WHATSAPP',
  push: 'PUSH',
};

const TRIAL_EXPIRY_EVENT_KEYS = new Set([
  'platform.trial.approaching_expiry',
  'platform.trial.expired',
]);

interface DeliveryJobContext {
  job: { id: string; tenantId: string; intentId: string; messageId: string; channel: NotificationChannelId; providerKey: string; attemptCount: number; maxAttempts: number };
  intent: { id: string; tenantId: string; recipientId: string; branchId: string | null; metadata: Record<string, unknown> };
  message: { id: string; title: string; body: string; html: string | null; notificationId: string | null };
}

export interface ProcessDeliveryJobResult {
  status:
    | 'delivered'
    | 'skipped_leased'
    | 'not_found'
    | 'retryable'
    | 'permanent'
    | 'dead_letter'
    | 'fallback'
    | 'ambiguous'
    | 'suppressed';
}

/**
 * Consumes the `notification-delivery` BullMQ queue populated by DeliveryOrchestratorService.
 * For each job: lease → invoke the channel adapter → record the attempt/receipt → update the
 * legacy Notification row (IN_APP) → commit the CommunicationDispatchLedger (non-IN_APP) →
 * dead-letter, mark ambiguous, suppress obsolete trial warnings, or schedule a jittered retry.
 */
@Injectable()
export class DeliveryWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliveryWorkerService.name);
  private worker?: Worker;
  private readonly adapters: Record<NotificationChannelId, NotificationProviderAdapter>;

  constructor(
    private readonly bullMq: BullMqConnectionService,
    private readonly prisma: PrismaService,
    private readonly tenantExecution: TenantExecutionService,
    private readonly deliveryJobs: DeliveryJobService,
    private readonly receipts: ReceiptService,
    private readonly communicationLimits: CommunicationDispatchService,
    private readonly inAppAdapter: InAppAdapter,
    private readonly emailAdapter: EmailAdapter,
    private readonly smsAdapter: SmsAdapter,
    private readonly whatsappAdapter: WhatsappAdapter,
    private readonly pushAdapter: PushAdapter,
    private readonly webhookAdapter: WebhookAdapter,
    private readonly activity: DeliveryActivityEmitterService,
  ) {
    this.adapters = {
      'in-app': this.inAppAdapter,
      email: this.emailAdapter,
      sms: this.smsAdapter,
      whatsapp: this.whatsappAdapter,
      push: this.pushAdapter,
      webhook: this.webhookAdapter,
    };
  }

  onModuleInit(): void {
    if (!workersEnabled()) {
      this.logger.log(
        JSON.stringify({
          kind: 'notification.delivery.worker',
          event: 'disabled',
          reason: 'NODE_ENV=test or BACKGROUND_WORKERS_ENABLED=false',
          queue: DELIVERY_QUEUE_NAME,
          jobProcessor: DELIVERY_JOB_NAME,
        }),
      );
      return;
    }

    this.worker = new Worker(
      DELIVERY_QUEUE_NAME,
      async (job: Job) => {
        if (job.name === DELIVERY_JOB_NAME) {
          return this.processDeliveryJob(job.data.deliveryJobId as string);
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pre-existing ioredis dual-package type
      // mismatch between the root `ioredis` and bullmq's bundled `ioredis`; see JobQueueService for the same pattern.
      { connection: this.bullMq.connection as any, concurrency: 3 },
    );

    this.worker.on('ready', () => {
      this.logger.log(
        JSON.stringify({
          kind: 'notification.delivery.worker',
          event: 'ready',
          queue: DELIVERY_QUEUE_NAME,
          jobProcessor: DELIVERY_JOB_NAME,
          concurrency: 3,
          redisConnected: true,
        }),
      );
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Delivery job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log(
      JSON.stringify({
        kind: 'notification.delivery.worker',
        event: 'initialized',
        queue: DELIVERY_QUEUE_NAME,
        jobProcessor: DELIVERY_JOB_NAME,
        concurrency: 3,
      }),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  async processDeliveryJob(jobId: string): Promise<ProcessDeliveryJobResult> {
    const context = await this.tenantExecution.runWithPlatformBypass(
      {
        actorId: 'system',
        action: 'delivery.worker.load_job',
        resourceType: 'delivery_job',
        resourceId: jobId,
        reason: 'Cross-tenant lookup of queued delivery job for processing',
      },
      () => this.loadJobContext(jobId),
    );

    if (!context) {
      return { status: 'not_found' };
    }

    return this.tenantExecution.runAsTenant(context.job.tenantId, () => this.executeJob(context));
  }

  private async loadJobContext(jobId: string): Promise<DeliveryJobContext | null> {
    const client = this.prisma.getRootClient() as unknown as {
      deliveryJob?: { findUnique: (args: unknown) => Promise<Record<string, unknown> | null> };
      notificationIntent?: { findUnique: (args: unknown) => Promise<Record<string, unknown> | null> };
      notificationMessage?: { findUnique: (args: unknown) => Promise<Record<string, unknown> | null> };
    };

    if (!client.deliveryJob || !client.notificationIntent || !client.notificationMessage) {
      this.logger.warn('Delivery Prisma models not available; cannot process delivery job');
      return null;
    }

    const job = await client.deliveryJob.findUnique({ where: { id: jobId } });
    if (!job) return null;

    const [intent, message] = await Promise.all([
      client.notificationIntent.findUnique({ where: { id: job.intentId as string } }),
      client.notificationMessage.findUnique({ where: { id: job.messageId as string } }),
    ]);
    if (!intent || !message) return null;

    return {
      job: {
        id: job.id as string,
        tenantId: job.tenantId as string,
        intentId: job.intentId as string,
        messageId: job.messageId as string,
        channel: job.channel as NotificationChannelId,
        providerKey: job.providerKey as string,
        attemptCount: (job.attemptCount as number) ?? 0,
        maxAttempts: (job.maxAttempts as number) ?? 5,
      },
      intent: {
        id: intent.id as string,
        tenantId: intent.tenantId as string,
        recipientId: intent.recipientId as string,
        branchId: (intent.branchId as string) ?? null,
        metadata: (intent.metadata as Record<string, unknown>) ?? {},
      },
      message: {
        id: message.id as string,
        title: message.title as string,
        body: message.body as string,
        html: (message.html as string) ?? null,
        notificationId: (message.notificationId as string) ?? null,
      },
    };
  }

  /**
   * C07 send-time revalidation: suppress obsolete Trial expiry warnings before provider call.
   * Suppress only when the trial row is found and obsolete — synthetic UUID tests still send.
   */
  private async resolveObsoleteTrialSuppressReason(
    metadata: Record<string, unknown>,
  ): Promise<string | null> {
    const eventKey = typeof metadata.eventKey === 'string' ? metadata.eventKey : '';
    const templateKey = typeof metadata.templateKey === 'string' ? metadata.templateKey : '';
    const sourceType =
      typeof metadata.sourceType === 'string'
        ? metadata.sourceType
        : typeof metadata.source_type === 'string'
          ? metadata.source_type
          : '';
    const sourceId =
      typeof metadata.sourceId === 'string'
        ? metadata.sourceId
        : typeof metadata.source_id === 'string'
          ? metadata.source_id
          : '';

    const isTrialExpiryEvent =
      TRIAL_EXPIRY_EVENT_KEYS.has(eventKey) ||
      /trial\.(approaching_expiry|expired)|trial_approaching|trial_expired/i.test(templateKey);
    if (!isTrialExpiryEvent) return null;
    if (sourceType !== 'platform_sales_trial' || !sourceId) return null;

    const root = this.prisma.getRootClient() as unknown as {
      platformSalesTrial?: {
        findUnique: (args: unknown) => Promise<{ status: string } | null>;
      };
    };
    if (!root.platformSalesTrial) return null;

    const trial = await root.platformSalesTrial.findUnique({
      where: { id: sourceId },
      select: { status: true },
    });
    if (!trial) return null;

    if (trial.status === 'CONVERTED' || trial.status === 'CANCELLED') {
      return `trial_obsolete:${trial.status}`;
    }
    if (eventKey === 'platform.trial.approaching_expiry' && trial.status === 'EXPIRED') {
      return `trial_obsolete:${trial.status}`;
    }
    return null;
  }

  private async executeJob(context: DeliveryJobContext): Promise<ProcessDeliveryJobResult> {
    const leased = await this.deliveryJobs.leaseJob(context.job.id);
    if (!leased) {
      return { status: 'skipped_leased' };
    }

    const adapter = this.adapters[context.job.channel];
    const now = new Date();
    let providerSendSucceeded = false;

    try {
      // Send-time Trial revalidation before any provider failure inject or send.
      const suppressReason = await this.resolveObsoleteTrialSuppressReason(context.intent.metadata);
      if (suppressReason) {
        await this.deliveryJobs.suppressJob(context.job.id, suppressReason);
        try {
          await this.receipts.upsert({
            tenantId: context.intent.tenantId,
            jobId: context.job.id,
            channel: context.job.channel,
            status: 'FAILED',
          });
        } catch {
          // optional receipt
        }
        await this.activity.emit('failed', {
          tenantId: context.intent.tenantId,
          branchId: context.intent.branchId,
          intentId: context.job.intentId,
          jobId: context.job.id,
          channel: context.job.channel,
          providerKey: context.job.providerKey,
          reasonCode: suppressReason.slice(0, 120),
        });
        return { status: 'suppressed' };
      }

      if (
        process.env.NODE_ENV === 'test' &&
        process.env.PLATFORM_NOTIFICATION_FAILURE_INJECTION === 'before_provider_send'
      ) {
        throw new Error('Injected before_provider_send failure');
      }

      if (!adapter) {
        throw new Error(`No adapter registered for channel "${context.job.channel}"`);
      }

      // Governed production invariant: the Platform audit sentinel is not a licensable tenant
      // (see LicensingEngineService.resolveLicense). Step 27 platform-principal notifications
      // route through this sentinel tenantId and must never be metered/limited by tenant
      // communication quotas that do not apply to them.
      const ledgerChannel = isPlatformAuditSentinelTenantId(context.intent.tenantId)
        ? undefined
        : LEDGER_CHANNEL_BY_ID[context.job.channel];
      if (ledgerChannel) {
        await this.communicationLimits.assertCanDispatch(context.intent.tenantId, ledgerChannel, context.job.id);
      }

      const { text: truncatedBody } = truncateForChannel(context.message.body, context.job.channel);
      const notificationId = context.job.channel === 'in-app' ? context.message.notificationId : null;

      const result = await adapter.send({
        tenantId: context.intent.tenantId,
        branchId: context.intent.branchId,
        recipientId: context.intent.recipientId,
        channel: context.job.channel,
        notificationId,
        messageId: context.message.id,
        title: context.message.title,
        body: truncatedBody,
        html: context.message.html,
        metadata: context.intent.metadata,
      });

      if (!result.success) {
        const error = new Error(result.error ?? 'adapter reported an unsuccessful send') as Error & {
          failureClassHint?: FailureClass;
        };
        error.failureClassHint = result.failureClass;

        if (result.failureClass === 'ambiguous') {
          try {
            await this.deliveryJobs.recordAttempt(context.job.id, context.intent.tenantId, {
              success: false,
              providerKey: result.providerKey,
              error: result.error,
            });
          } catch {
            // best-effort attempt row
          }
          try {
            await this.receipts.upsert({
              tenantId: context.intent.tenantId,
              jobId: context.job.id,
              channel: context.job.channel,
              status: 'FAILED',
            });
          } catch {
            // optional
          }
          await this.deliveryJobs.failJob(
            { id: context.job.id, attemptCount: context.job.attemptCount + 1, maxAttempts: context.job.maxAttempts },
            error,
          );
          await this.activity.emit('failed', {
            tenantId: context.intent.tenantId,
            branchId: context.intent.branchId,
            intentId: context.job.intentId,
            jobId: context.job.id,
            channel: context.job.channel,
            providerKey: context.job.providerKey,
            reasonCode: (result.error ?? 'ambiguous').slice(0, 120),
          });
          return { status: 'ambiguous' };
        }

        throw error;
      }

      // Provider accepted — any subsequent local persist failure is Strategy B ambiguous.
      providerSendSucceeded = true;

      await this.deliveryJobs.recordAttempt(context.job.id, context.intent.tenantId, {
        success: true,
        providerKey: result.providerKey,
        externalId: result.externalId,
      });
      await this.receipts.upsert({
        tenantId: context.intent.tenantId,
        jobId: context.job.id,
        channel: context.job.channel,
        status: 'DELIVERED',
        externalId: result.externalId,
      });

      if (ledgerChannel) {
        await this.communicationLimits.commitDispatch(context.intent.tenantId, ledgerChannel, context.job.id);
      }

      if (context.job.channel === 'in-app' && context.message.notificationId) {
        await this.prisma.notification.update({
          where: { id: context.message.notificationId },
          data: { status: 'DELIVERED', sentAt: now, deliveredAt: now, updatedAt: now },
        });
      }

      await this.deliveryJobs.completeJob(context.job.id);
      await this.activity.emit('delivered', {
        tenantId: context.intent.tenantId,
        branchId: context.intent.branchId,
        intentId: context.job.intentId,
        jobId: context.job.id,
        channel: context.job.channel,
        providerKey: context.job.providerKey,
      });
      return { status: 'delivered' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Delivery job ${context.job.id} (${context.job.channel}) failed: ${message}`);

      // Strategy B: if the provider already accepted, never blind-schedule an auto-resend.
      if (providerSendSucceeded) {
        try {
          await this.deliveryJobs.recordAttempt(context.job.id, context.intent.tenantId, {
            success: false,
            providerKey: context.job.providerKey,
            error: message,
          });
        } catch {
          // persist seam may still be injected
        }
        try {
          await this.receipts.upsert({
            tenantId: context.intent.tenantId,
            jobId: context.job.id,
            channel: context.job.channel,
            status: 'FAILED',
          });
        } catch {
          // optional
        }
        const ambErr = Object.assign(new Error(message), {
          failureClassHint: 'ambiguous' as FailureClass,
        });
        await this.deliveryJobs.failJob(
          { id: context.job.id, attemptCount: context.job.attemptCount + 1, maxAttempts: context.job.maxAttempts },
          ambErr,
        );
        await this.activity.emit('failed', {
          tenantId: context.intent.tenantId,
          branchId: context.intent.branchId,
          intentId: context.job.intentId,
          jobId: context.job.id,
          channel: context.job.channel,
          providerKey: context.job.providerKey,
          reasonCode: message.slice(0, 120),
        });
        return { status: 'ambiguous' };
      }

      try {
        await this.deliveryJobs.recordAttempt(context.job.id, context.intent.tenantId, {
          success: false,
          providerKey: context.job.providerKey,
          error: message,
        });
      } catch {
        // best-effort
      }
      try {
        await this.receipts.upsert({
          tenantId: context.intent.tenantId,
          jobId: context.job.id,
          channel: context.job.channel,
          status: 'FAILED',
        });
      } catch {
        // optional
      }

      if (context.job.channel === 'in-app' && context.message.notificationId) {
        await this.prisma.notification.update({
          where: { id: context.message.notificationId },
          data: { status: 'FAILED', failureReason: message.slice(0, 500), retryCount: { increment: 1 }, updatedAt: now },
        });
      }

      const outcome = await this.deliveryJobs.failJob(
        { id: context.job.id, attemptCount: context.job.attemptCount + 1, maxAttempts: context.job.maxAttempts },
        error,
      );
      const status: ProcessDeliveryJobResult['status'] =
        outcome.failureClass === 'permanent'
          ? 'permanent'
          : outcome.failureClass === 'fallback'
            ? 'fallback'
            : outcome.failureClass === 'ambiguous'
              ? 'ambiguous'
              : outcome.retry
                ? 'retryable'
                : 'dead_letter';
      await this.activity.emit(
        status === 'retryable' ? 'retry' : status === 'fallback' ? 'fallback' : status === 'dead_letter' ? 'dead_letter' : 'failed',
        {
          tenantId: context.intent.tenantId,
          branchId: context.intent.branchId,
          intentId: context.job.intentId,
          jobId: context.job.id,
          channel: context.job.channel,
          providerKey: context.job.providerKey,
          reasonCode: message.slice(0, 120),
        },
      );
      return { status };
    }
  }
}
