import { Injectable, Logger } from '@nestjs/common';
import { QueueMetricsService } from '../../../infrastructure/redis/services/queue-metrics.service';
import { DELIVERY_QUEUE_NAME } from './delivery.types';

/**
 * Phase 41e — observational Activity metadata for delivery lifecycle.
 * Does NOT redesign Activity Center. Emits structured, PHI-free events only:
 * no message bodies, credentials, or unrestricted content.
 *
 * Events are recorded as Redis counters (existing observability) + structured logs
 * so Activity/ops dashboards can observe delivery without a second Activity SoR.
 */
export type DeliveryActivityEvent =
  | 'intent_created'
  | 'rendering_completed'
  | 'queued'
  | 'dispatched'
  | 'delivered'
  | 'read'
  | 'retry'
  | 'fallback'
  | 'failed'
  | 'dead_letter'
  | 'manual_retry'
  | 'cancelled'
  | 'blocked_consent'
  | 'blocked_preference'
  | 'quiet_hours_deferred';

export interface DeliveryActivityPayload {
  tenantId: string;
  branchId?: string | null;
  intentId?: string;
  jobId?: string;
  channel?: string;
  providerKey?: string;
  notificationTypeId?: string;
  producerModuleId?: string;
  reasonCode?: string;
}

@Injectable()
export class DeliveryActivityEmitterService {
  private readonly logger = new Logger(DeliveryActivityEmitterService.name);

  constructor(private readonly queueMetrics: QueueMetricsService) {}

  async emit(event: DeliveryActivityEvent, payload: DeliveryActivityPayload): Promise<void> {
    // Structured observational log — never includes body/PHI/secrets.
    this.logger.log({
      kind: 'notification.delivery.activity',
      event,
      tenantId: payload.tenantId,
      branchId: payload.branchId ?? null,
      intentId: payload.intentId ?? null,
      jobId: payload.jobId ?? null,
      channel: payload.channel ?? null,
      providerKey: payload.providerKey ?? null,
      notificationTypeId: payload.notificationTypeId ?? null,
      producerModuleId: payload.producerModuleId ?? null,
      reasonCode: payload.reasonCode ?? null,
    });

    try {
      if (event === 'queued' || event === 'dispatched') {
        await this.queueMetrics.recordEnqueued(`${DELIVERY_QUEUE_NAME}:${event}`);
      } else if (event === 'delivered') {
        await this.queueMetrics.recordCompleted(`${DELIVERY_QUEUE_NAME}:delivered`);
      } else if (event === 'failed' || event === 'dead_letter') {
        await this.queueMetrics.recordFailed(`${DELIVERY_QUEUE_NAME}:${event}`);
      } else if (
        event === 'blocked_consent' ||
        event === 'blocked_preference' ||
        event === 'quiet_hours_deferred' ||
        event === 'retry' ||
        event === 'fallback'
      ) {
        await this.queueMetrics.recordEnqueued(`${DELIVERY_QUEUE_NAME}:ops:${event}`);
      }
    } catch (error) {
      this.logger.warn(`Delivery activity metrics failed for ${event}: ${String(error)}`);
    }
  }
}
