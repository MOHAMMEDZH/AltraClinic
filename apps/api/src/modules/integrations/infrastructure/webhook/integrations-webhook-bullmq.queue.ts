import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JobsOptions, Queue, Worker } from 'bullmq';
import { BullMqConnectionService } from '../../../background/infrastructure/bullmq-connection.service';
import { INTEGRATIONS_LOG_KIND, INTEGRATIONS_WEBHOOKS_QUEUE_NAME } from '../../integrations.constants';
import { isApiKeysIntegrationsCenterEnabled } from '../../config/integrations-config';
import type {
  WebhookDeliveryQueuePort,
  WebhookJobHandler,
  WebhookQueueJobPayload,
} from '../../application/webhook/webhook-delivery-queue.port';
import { redactWebhookSensitive } from '../../domain/webhook/webhook-hmac';

export const INTEGRATIONS_WEBHOOK_JOB_NAME = 'deliver-webhook';

/**
 * Phase 44c — BullMQ queue `integrations-webhooks` (isolated; never shares N/IE/BR queues).
 * Soft-fail if Redis unavailable — in-process queue remains available for tests.
 */
@Injectable()
export class IntegrationsWebhookBullMqQueue
  implements WebhookDeliveryQueuePort, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(IntegrationsWebhookBullMqQueue.name);
  readonly queueName = INTEGRATIONS_WEBHOOKS_QUEUE_NAME;
  private queue?: Queue;
  private worker?: Worker;
  private _wired = false;
  private enqueued = 0;
  private processed = 0;
  private failed = 0;
  private dlq = 0;
  private handler?: WebhookJobHandler;

  constructor(private readonly bullMq: BullMqConnectionService) {}

  get wired(): boolean {
    return this._wired;
  }

  setHandler(handler: WebhookJobHandler): void {
    this.handler = handler;
  }

  onModuleInit(): void {
    try {
      this.queue = new Queue(INTEGRATIONS_WEBHOOKS_QUEUE_NAME, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        connection: this.bullMq.connection as any,
      });
      this.worker = new Worker(
        INTEGRATIONS_WEBHOOKS_QUEUE_NAME,
        async (job) => {
          const payload = job.data as WebhookQueueJobPayload;
          if (!this.handler) return;
          try {
            await this.handler(payload);
            this.processed += 1;
          } catch (err) {
            this.failed += 1;
            throw err;
          }
        },
        {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          connection: this.bullMq.connection as any,
          concurrency: 2,
        },
      );
      this.worker.on('failed', (job, err) => {
        if (job && (job.attemptsMade ?? 0) >= (job.opts.attempts ?? 1)) {
          this.dlq += 1;
        }
        this.logger.warn(
          JSON.stringify({
            kind: INTEGRATIONS_LOG_KIND,
            component: 'webhook_worker',
            event: 'failed',
            message: redactWebhookSensitive(err.message),
          }),
        );
      });
      this._wired = true;
      this.logger.log(
        JSON.stringify({
          kind: INTEGRATIONS_LOG_KIND,
          component: 'queue',
          event: 'registered',
          queue: INTEGRATIONS_WEBHOOKS_QUEUE_NAME,
          featureEnabled: isApiKeysIntegrationsCenterEnabled(),
        }),
      );
    } catch (err) {
      this._wired = false;
      this.logger.warn(
        JSON.stringify({
          kind: INTEGRATIONS_LOG_KIND,
          component: 'queue',
          event: 'init_failed',
          message: err instanceof Error ? err.message : 'unknown',
        }),
      );
    }
  }

  async enqueue(
    payload: WebhookQueueJobPayload,
    options?: { delayMs?: number },
  ): Promise<string | undefined> {
    if (!this.queue) {
      throw new Error('integrations-webhooks queue not initialized');
    }
    const opts: JobsOptions = {
      removeOnComplete: 200,
      removeOnFail: 100,
      attempts: 1, // orchestration retries owned by WebhookEngine
      delay: options?.delayMs ?? 0,
    };
    const job = await this.queue.add(INTEGRATIONS_WEBHOOK_JOB_NAME, payload, opts);
    this.enqueued += 1;
    return job.id;
  }

  getDiagnostics() {
    return {
      wired: this._wired,
      depth: 0,
      enqueued: this.enqueued,
      processed: this.processed,
      failed: this.failed,
      dlq: this.dlq,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    this._wired = false;
  }
}
