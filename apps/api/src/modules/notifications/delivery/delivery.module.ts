import { Module } from '@nestjs/common';
import { SubscriptionModule } from '../../subscription/subscription.module';
import { RedisModule } from '../../../infrastructure/redis/redis.module';
import { BullMqConnectionService } from '../../background/infrastructure/bullmq-connection.service';
import { JobQueueService } from '../../background/infrastructure/job-queue.service';
import { smsSenderProvider } from '../../auth/infrastructure/services/sms-sender.provider';
import { pushSenderProvider } from '../../auth/infrastructure/services/push-sender.provider';
import { TemplateRenderService } from './template-render.service';
import { ConsentEvaluationService } from './consent-evaluation.service';
import { PreferenceEvaluationService } from './preference-evaluation.service';
import { QuietHoursService } from './quiet-hours.service';
import { ChannelRoutingService } from './channel-routing.service';
import { NotificationIntentService } from './notification-intent.service';
import { DeliveryJobService } from './delivery-job.service';
import { ReceiptService } from './receipt.service';
import { CommunicationHistoryService } from './communication-history.service';
import { DeliveryOrchestratorService } from './delivery-orchestrator.service';
import { DeliveryWorkerService } from './delivery-worker.service';
import { NotificationIntentProducerService } from './notification-intent-producer.service';
import { DeliveryActivityEmitterService } from './delivery-activity-emitter.service';
import { OutboundBrandingResolverService } from './outbound-branding-resolver.service';
import { JourneyNotificationIntentService } from './journey-notification-intent.service';
import { WorkflowNotificationIntentService } from './workflow-notification-intent.service';
import { InAppAdapter } from './adapters/in-app.adapter';
import { EmailAdapter } from './adapters/email.adapter';
import { SmsAdapter } from './adapters/sms.adapter';
import { WhatsappAdapter } from './adapters/whatsapp.adapter';
import { PushAdapter } from './adapters/push.adapter';
import { WebhookAdapter } from './adapters/webhook.adapter';

/**
 * Phase 41d/41e — Notification Delivery Engine.
 * Self-contained BullMQ wiring avoids circular import with BackgroundModule.
 */
@Module({
  imports: [SubscriptionModule, RedisModule],
  providers: [
    smsSenderProvider,
    pushSenderProvider,
    BullMqConnectionService,
    JobQueueService,
    TemplateRenderService,
    ConsentEvaluationService,
    PreferenceEvaluationService,
    QuietHoursService,
    ChannelRoutingService,
    NotificationIntentService,
    DeliveryJobService,
    ReceiptService,
    CommunicationHistoryService,
    DeliveryActivityEmitterService,
    OutboundBrandingResolverService,
    JourneyNotificationIntentService,
    WorkflowNotificationIntentService,
    InAppAdapter,
    EmailAdapter,
    SmsAdapter,
    WhatsappAdapter,
    PushAdapter,
    WebhookAdapter,
    DeliveryOrchestratorService,
    DeliveryWorkerService,
    NotificationIntentProducerService,
  ],
  exports: [
    DeliveryOrchestratorService,
    CommunicationHistoryService,
    NotificationIntentService,
    DeliveryWorkerService,
    DeliveryJobService,
    ReceiptService,
    NotificationIntentProducerService,
    DeliveryActivityEmitterService,
    OutboundBrandingResolverService,
    JourneyNotificationIntentService,
    WorkflowNotificationIntentService,
  ],
})
export class DeliveryModule {}
