import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type {
  WebhookDeliveryQueuePort,
  WebhookJobHandler,
  WebhookQueueJobPayload,
} from '../../application/webhook/webhook-delivery-queue.port';
import { InProcessWebhookDeliveryQueue } from '../../application/webhook/webhook-delivery-queue.port';
import { IntegrationsWebhookBullMqQueue } from './integrations-webhook-bullmq.queue';
import { INTEGRATIONS_WEBHOOKS_QUEUE_NAME } from '../../integrations.constants';

/**
 * Prefers BullMQ when wired; falls back to in-process queue (tests / Redis-less).
 * Never double-enqueues.
 */
@Injectable()
export class WebhookQueueFacade
  implements WebhookDeliveryQueuePort, OnModuleInit
{
  readonly queueName = INTEGRATIONS_WEBHOOKS_QUEUE_NAME;
  private handler?: WebhookJobHandler;

  constructor(
    private readonly inProcess: InProcessWebhookDeliveryQueue,
    private readonly bullMq: IntegrationsWebhookBullMqQueue,
  ) {}

  onModuleInit(): void {
    if (this.handler) {
      this.inProcess.setHandler(this.handler);
      this.bullMq.setHandler(this.handler);
    }
  }

  setHandler(handler: WebhookJobHandler): void {
    this.handler = handler;
    this.inProcess.setHandler(handler);
    this.bullMq.setHandler(handler);
  }

  get wired(): boolean {
    return this.inProcess.wired || this.bullMq.wired;
  }

  get bullMqWired(): boolean {
    return this.bullMq.wired;
  }

  async enqueue(
    payload: WebhookQueueJobPayload,
    options?: { delayMs?: number },
  ): Promise<string | undefined> {
    if (this.bullMq.wired) {
      try {
        return await this.bullMq.enqueue(payload, options);
      } catch {
        // fall through to in-process
      }
    }
    return this.inProcess.enqueue(payload, options);
  }

  getDiagnostics() {
    const primary = this.bullMq.wired
      ? this.bullMq.getDiagnostics()
      : this.inProcess.getDiagnostics();
    return {
      ...primary,
      wired: this.wired,
      bullmqWired: this.bullMq.wired,
      backend: this.bullMq.wired ? ('bullmq' as const) : ('in_process' as const),
    };
  }

  markDeadLetter(): void {
    this.inProcess.markDeadLetter();
  }
}
