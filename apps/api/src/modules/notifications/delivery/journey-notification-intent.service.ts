import { Injectable, Logger } from '@nestjs/common';
import { NotificationIntentProducerService } from './notification-intent-producer.service';

export interface JourneyCommunicationRequest {
  tenantId: string;
  branchId?: string | null;
  recipientId: string;
  title: string;
  body: string;
  journeyInstanceId: string;
  correlationId?: string;
  causationId?: string;
  notificationTypeId?: string;
  idempotencyKey: string;
  channels?: Array<'in-app' | 'email' | 'sms' | 'push'>;
  metadata?: Record<string, unknown>;
}

/**
 * Phase 41e — Journey may only create notification intents.
 * Never calls provider adapters. Correlation/journey IDs are preserved on the intent.
 */
@Injectable()
export class JourneyNotificationIntentService {
  private readonly logger = new Logger(JourneyNotificationIntentService.name);

  constructor(private readonly producer: NotificationIntentProducerService) {}

  async createFromJourney(request: JourneyCommunicationRequest) {
    this.logger.log(
      `Journey communication intent tenant=${request.tenantId} journey=${request.journeyInstanceId}`,
    );
    return this.producer.produceChannels({
      tenantId: request.tenantId,
      branchId: request.branchId,
      recipientId: request.recipientId,
      title: request.title,
      body: request.body,
      channels: request.channels?.length ? request.channels : ['in-app'],
      idempotencyKey: request.idempotencyKey,
      notificationTypeId: request.notificationTypeId,
      category: 'journey-follow-up',
      transactional: true,
      producerModuleId: 'journey.communication',
      correlationId: request.correlationId,
      causationId: request.causationId,
      journeyInstanceId: request.journeyInstanceId,
      metadata: {
        ...(request.metadata ?? {}),
        journeyInstanceId: request.journeyInstanceId,
      },
    });
  }
}
