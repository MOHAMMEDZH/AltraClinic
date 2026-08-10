/**
 * Phase 44c — delivery queue port + in-process implementation (tests / fail-safe).
 * BullMQ wrapper also implements this port.
 */

import { Injectable } from '@nestjs/common';

export const WEBHOOK_DELIVERY_QUEUE = Symbol('WEBHOOK_DELIVERY_QUEUE');

export interface WebhookQueueJobPayload {
  deliveryId: string;
  tenantId: string;
  correlationId: string;
  attempt: number;
}

export interface WebhookDeliveryQueuePort {
  readonly queueName: string;
  readonly wired: boolean;
  enqueue(
    payload: WebhookQueueJobPayload,
    options?: { delayMs?: number },
  ): Promise<string | undefined>;
  getDiagnostics(): {
    wired: boolean;
    depth: number;
    enqueued: number;
    processed: number;
    failed: number;
    dlq: number;
    bullmqWired?: boolean;
    backend?: 'bullmq' | 'in_process';
  };
}

export type WebhookJobHandler = (
  payload: WebhookQueueJobPayload,
) => Promise<void>;

/**
 * In-process queue with exponential backoff delays — no Redis required for unit tests.
 */
@Injectable()
export class InProcessWebhookDeliveryQueue
  implements WebhookDeliveryQueuePort
{
  readonly queueName = 'integrations-webhooks';
  readonly wired = true;
  private enqueued = 0;
  private processed = 0;
  private failed = 0;
  private dlq = 0;
  private pending = 0;
  private handler?: WebhookJobHandler;

  setHandler(handler: WebhookJobHandler): void {
    this.handler = handler;
  }

  async enqueue(
    payload: WebhookQueueJobPayload,
    options?: { delayMs?: number },
  ): Promise<string | undefined> {
    this.enqueued += 1;
    this.pending += 1;
    const jobId = `${payload.deliveryId}:${payload.attempt}`;
    const delay = options?.delayMs ?? 0;
    const run = async () => {
      this.pending = Math.max(0, this.pending - 1);
      if (!this.handler) return;
      try {
        await this.handler(payload);
        this.processed += 1;
      } catch {
        this.failed += 1;
      }
    };
    if (delay > 0) {
      setTimeout(() => void run(), delay).unref?.();
    } else {
      queueMicrotask(() => void run());
    }
    return jobId;
  }

  markDeadLetter(): void {
    this.dlq += 1;
  }

  getDiagnostics() {
    return {
      wired: true,
      depth: this.pending,
      enqueued: this.enqueued,
      processed: this.processed,
      failed: this.failed,
      dlq: this.dlq,
      backend: 'in_process' as const,
      bullmqWired: false,
    };
  }
}
