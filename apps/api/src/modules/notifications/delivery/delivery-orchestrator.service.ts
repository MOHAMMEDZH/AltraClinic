import { Injectable, Logger } from '@nestjs/common';
import { CANONICAL_NOTIFICATION_TYPES, type CanonicalNotificationType } from '@booking/module-registry/notification';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { JobQueueService } from '../../background/infrastructure/job-queue.service';
import { BackgroundQueueName } from '../../background/config/queue-names';
import {
  ChannelPlan,
  ConsentDecision,
  DELIVERY_JOB_NAME,
  DELIVERY_QUEUE_NAME,
  IntentInput,
  NotificationChannelId,
  PreferenceDecision,
  QuietHoursDecision,
} from './delivery.types';
import { ConsentEvaluationService, ConsentPolicyId } from './consent-evaluation.service';
import { PreferenceEvaluationService } from './preference-evaluation.service';
import { QuietHoursService } from './quiet-hours.service';
import { ChannelRoutingService } from './channel-routing.service';
import { TemplateRenderService } from './template-render.service';
import { NotificationIntentService } from './notification-intent.service';
import { DeliveryJobService } from './delivery-job.service';
import { NotificationProviderAdapter } from './provider-adapter.contract';
import { InAppAdapter } from './adapters/in-app.adapter';
import { EmailAdapter } from './adapters/email.adapter';
import { SmsAdapter } from './adapters/sms.adapter';
import { WhatsappAdapter } from './adapters/whatsapp.adapter';
import { PushAdapter } from './adapters/push.adapter';
import { WebhookAdapter } from './adapters/webhook.adapter';
import { DeliveryActivityEmitterService } from './delivery-activity-emitter.service';
import { OutboundBrandingResolverService } from './outbound-branding-resolver.service';

/** Channels whose delivery is silent/non-intrusive and therefore exempt from quiet-hours
 * deferral (an inbox item appearing at 3am does not wake anyone up, unlike SMS/push/calls). */
const QUIET_HOURS_EXEMPT_CHANNELS: ReadonlySet<NotificationChannelId> = new Set(['in-app']);

export interface DeliveryResult {
  intentId: string;
  intentPersisted: boolean;
  messageId: string | null;
  status: 'dispatched' | 'deferred' | 'blocked_consent' | 'blocked_preference' | 'blocked_no_channel';
  consentDecision: ConsentDecision;
  preferenceDecision?: PreferenceDecision;
  quietHoursDecision?: QuietHoursDecision;
  plan: ChannelPlan[];
  rejectedChannels: { channel: NotificationChannelId; reason: string }[];
  jobIds: string[];
  legacyNotificationId?: string | null;
}

/**
 * Delivery pipeline: validate → consent → preferences → quiet hours (schedule defer) →
 * render immutable message → create per-channel jobs → enqueue on BullMQ.
 *
 * Consumes (never redefines) the frozen Phase 41a-c config platform: canonical notification
 * type metadata (consent policy id, transactional flag, default channels) is looked up from
 * `@booking/module-registry`'s CANONICAL_NOTIFICATION_TYPES when a notificationTypeId is given.
 */
@Injectable()
export class DeliveryOrchestratorService {
  private readonly logger = new Logger(DeliveryOrchestratorService.name);
  private readonly adapters: Record<NotificationChannelId, NotificationProviderAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobQueue: JobQueueService,
    private readonly intentService: NotificationIntentService,
    private readonly consentEval: ConsentEvaluationService,
    private readonly preferenceEval: PreferenceEvaluationService,
    private readonly quietHours: QuietHoursService,
    private readonly channelRouting: ChannelRoutingService,
    private readonly templateRender: TemplateRenderService,
    private readonly deliveryJobs: DeliveryJobService,
    private readonly inAppAdapter: InAppAdapter,
    private readonly emailAdapter: EmailAdapter,
    private readonly smsAdapter: SmsAdapter,
    private readonly whatsappAdapter: WhatsappAdapter,
    private readonly pushAdapter: PushAdapter,
    private readonly webhookAdapter: WebhookAdapter,
    private readonly activity: DeliveryActivityEmitterService,
    private readonly brandingResolver: OutboundBrandingResolverService,
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

  async deliver(input: IntentInput): Promise<DeliveryResult> {
    const intent = await this.intentService.createIntent(input);
    await this.activity.emit('intent_created', {
      tenantId: input.tenantId,
      branchId: input.branchId,
      intentId: intent.id,
      notificationTypeId: input.notificationTypeId ?? undefined,
      producerModuleId: input.producerModuleId ?? undefined,
    });

    const canonicalType: CanonicalNotificationType | undefined = input.notificationTypeId
      ? CANONICAL_NOTIFICATION_TYPES.find((t) => t.typeId === input.notificationTypeId)
      : undefined;
    const consentPolicyId: ConsentPolicyId = (canonicalType?.consentPolicyId as ConsentPolicyId) ?? 'transactional-necessity';
    const transactional = input.transactional ?? canonicalType?.transactional ?? true;

    const preferenceSnapshot = await this.preferenceEval.loadPreference({
      tenantId: input.tenantId,
      recipientId: input.recipientId,
      recipientType: input.recipientType,
    });

    const consentDecision = this.consentEval.evaluate({
      policyId: consentPolicyId,
      transactional,
      metadata: input.metadata,
      preference: { promotionalOptIn: preferenceSnapshot.promotionalOptIn, optedOut: preferenceSnapshot.optedOut },
    });

    if (!consentDecision.allowed) {
      await this.intentService.updateStatus(intent.id, 'blocked_consent');
      await this.activity.emit('blocked_consent', {
        tenantId: input.tenantId,
        branchId: input.branchId,
        intentId: intent.id,
        reasonCode: consentDecision.reason,
      });
      return {
        intentId: intent.id,
        intentPersisted: intent.persisted,
        messageId: null,
        status: 'blocked_consent',
        consentDecision,
        plan: [],
        rejectedChannels: input.requestedChannels.map((channel) => ({ channel, reason: consentDecision.reason })),
        jobIds: [],
      };
    }

    const preferenceDecision = this.preferenceEval.evaluate({
      requestedChannels: input.requestedChannels,
      category: input.category,
      transactional,
      snapshot: preferenceSnapshot,
    });

    if (preferenceDecision.allowedChannels.length === 0) {
      await this.intentService.updateStatus(intent.id, 'blocked_preference');
      await this.activity.emit('blocked_preference', {
        tenantId: input.tenantId,
        branchId: input.branchId,
        intentId: intent.id,
        reasonCode: preferenceDecision.reason,
      });
      return {
        intentId: intent.id,
        intentPersisted: intent.persisted,
        messageId: null,
        status: 'blocked_preference',
        consentDecision,
        preferenceDecision,
        plan: [],
        rejectedChannels: preferenceDecision.blockedChannels,
        jobIds: [],
      };
    }

    const availableProviders = await this.resolveAvailableProviders(input.requestedChannels);
    const routing = this.channelRouting.route({
      requestedChannels: input.requestedChannels,
      allowedByConsent: input.requestedChannels,
      allowedByPreference: preferenceDecision.allowedChannels,
      availableProviders,
    });

    if (routing.plan.length === 0) {
      await this.intentService.updateStatus(intent.id, 'blocked_no_channel');
      return {
        intentId: intent.id,
        intentPersisted: intent.persisted,
        messageId: null,
        status: 'blocked_no_channel',
        consentDecision,
        preferenceDecision,
        plan: [],
        rejectedChannels: routing.rejected,
        jobIds: [],
      };
    }

    const quietHoursDecision = await this.evaluateQuietHours(input, preferenceSnapshot, consentDecision);

    const rendered = this.templateRender.render({
      subject: { en: input.title, ar: input.titleAr ?? null },
      body: { en: input.body, ar: input.bodyAr ?? null },
      variables: input.templateVars ?? {},
      locale: input.locale ?? 'en',
      // Canonical message is stored untruncated; per-channel length limits are applied by the
      // worker immediately before invoking each channel's adapter.
      channel: 'in-app',
    });
    await this.activity.emit('rendering_completed', {
      tenantId: input.tenantId,
      branchId: input.branchId,
      intentId: intent.id,
    });

    if (quietHoursDecision.inQuietHours) {
      await this.activity.emit('quiet_hours_deferred', {
        tenantId: input.tenantId,
        branchId: input.branchId,
        intentId: intent.id,
        reasonCode: quietHoursDecision.reason,
      });
    }

    let legacyNotificationId: string | null = null;
    {
      const primaryChannel = routing.plan[0]?.channel ?? 'in-app';
      const prismaChannel =
        primaryChannel === 'in-app'
          ? 'IN_APP'
          : primaryChannel === 'email'
            ? 'EMAIL'
            : primaryChannel === 'sms'
              ? 'SMS'
              : primaryChannel === 'push'
                ? 'PUSH'
                : primaryChannel === 'whatsapp'
                  ? 'WHATSAPP'
                  : 'IN_APP';
      const legacy = await this.prisma.notification.create({
        data: {
          tenantId: input.tenantId,
          branchId: input.branchId ?? null,
          recipientId: input.recipientId,
          channel: prismaChannel as never,
          title: rendered.subject ?? input.title,
          body: rendered.body,
          priority: (input.priority?.toUpperCase() as never) ?? 'MEDIUM',
          status: 'QUEUED',
          metadata: {
            ...((input.metadata as Record<string, unknown> | undefined) ?? {}),
            deliveryEngine: '41d',
            intentId: intent.id,
            channelPlan: routing.plan.map((p) => p.channel),
          } as never,
        },
      });
      legacyNotificationId = legacy.id;
    }

    const messageId = await this.persistMessage(intent.id, input, rendered, legacyNotificationId);

    const jobIds: string[] = [];
    for (const plan of routing.plan) {
      const deferred = !QUIET_HOURS_EXEMPT_CHANNELS.has(plan.channel) && quietHoursDecision.inQuietHours;
      const scheduledAt = deferred ? quietHoursDecision.deferUntil : input.scheduledAt ?? null;

      const job = await this.deliveryJobs.createJob({
        tenantId: input.tenantId,
        intentId: intent.id,
        messageId,
        channel: plan.channel,
        providerKey: plan.providerKey,
        scheduledAt,
      });
      jobIds.push(job.id);

      const delayMs = scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0;
      await this.jobQueue.enqueue(
        // Cast: this queue name is intentionally local to the delivery module (see
        // delivery.types.ts) rather than added to background/config/queue-names.ts, to avoid a
        // circular Nest module dependency with BackgroundModule.
        DELIVERY_QUEUE_NAME as unknown as BackgroundQueueName,
        DELIVERY_JOB_NAME,
        { deliveryJobId: job.id, tenantId: input.tenantId },
        delayMs > 0 ? { delay: delayMs } : {},
      );
      await this.activity.emit('queued', {
        tenantId: input.tenantId,
        branchId: input.branchId,
        intentId: intent.id,
        jobId: job.id,
        channel: plan.channel,
        providerKey: plan.providerKey,
      });
    }

    await this.intentService.updateStatus(intent.id, quietHoursDecision.inQuietHours ? 'deferred' : 'dispatched');
    await this.activity.emit('dispatched', {
      tenantId: input.tenantId,
      branchId: input.branchId,
      intentId: intent.id,
    });

    return {
      intentId: intent.id,
      intentPersisted: intent.persisted,
      messageId,
      status: quietHoursDecision.inQuietHours ? 'deferred' : 'dispatched',
      consentDecision,
      preferenceDecision,
      quietHoursDecision,
      plan: routing.plan,
      rejectedChannels: routing.rejected,
      jobIds,
      legacyNotificationId,
    };
  }

  private async resolveAvailableProviders(
    channels: NotificationChannelId[],
  ): Promise<Partial<Record<NotificationChannelId, string>>> {
    const unique = Array.from(new Set(channels));
    const entries = await Promise.all(
      unique.map(async (channel) => {
        const adapter = this.adapters[channel];
        if (!adapter) return [channel, undefined] as const;
        try {
          const available = await adapter.isAvailable();
          return [channel, available ? adapter.providerKey : undefined] as const;
        } catch (error) {
          this.logger.warn(`isAvailable() threw for channel ${channel}: ${error instanceof Error ? error.message : String(error)}`);
          return [channel, undefined] as const;
        }
      }),
    );
    const result: Partial<Record<NotificationChannelId, string>> = {};
    for (const [channel, providerKey] of entries) {
      if (providerKey) result[channel] = providerKey;
    }
    return result;
  }

  private async evaluateQuietHours(
    input: IntentInput,
    preferenceSnapshot: { quietHoursStart: string | null; quietHoursEnd: string | null; timezone: string | null },
    consentDecision: ConsentDecision,
  ): Promise<QuietHoursDecision> {
    const emergencyOverrideBypass = consentDecision.policyId === 'emergency-override' && consentDecision.allowed;

    const [tenant, recipientUser] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: input.tenantId }, select: { timezone: true } }).catch(() => null),
      this.prisma.user.findFirst({ where: { id: input.recipientId, tenantId: input.tenantId }, select: { timezone: true } }).catch(() => null),
    ]);

    return this.quietHours.evaluate({
      quietHoursStart: preferenceSnapshot.quietHoursStart,
      quietHoursEnd: preferenceSnapshot.quietHoursEnd,
      recipientTimezone: recipientUser?.timezone ?? preferenceSnapshot.timezone ?? null,
      tenantTimezone: tenant?.timezone ?? null,
      emergencyOverrideBypass,
    });
  }

  private async persistMessage(
    intentId: string,
    input: IntentInput,
    rendered: { subject?: string; body: string; html?: string; locale: string },
    legacyNotificationId: string | null,
  ): Promise<string> {
    const client = this.prisma as unknown as {
      notificationMessage?: {
        create: (args: unknown) => Promise<{ id: string }>;
      };
    };

    if (!client.notificationMessage) {
      this.logger.warn('notificationMessage Prisma model not available; returning unpersisted synthetic message id');
      return `unpersisted-${intentId}`;
    }

    let brandingRef: string | null = null;
    let html = rendered.html ?? null;
    try {
      const branding = await this.brandingResolver.resolve(
        input.tenantId,
        input.branchId,
        rendered.locale,
      );
      brandingRef = branding.brandingRef;
      const bodyHtml = html ?? `<p>${rendered.body.replace(/\n/g, '<br/>')}</p>`;
      html = this.brandingResolver.wrapEmailHtml(bodyHtml, branding);
    } catch (error) {
      this.logger.warn(`Outbound branding resolve failed: ${String(error)}`);
    }

    const created = await client.notificationMessage.create({
      data: {
        tenantId: input.tenantId,
        intentId,
        notificationId: legacyNotificationId,
        title: rendered.subject ?? input.title,
        body: rendered.body,
        html,
        locale: rendered.locale,
        variables: (input.templateVars as never) ?? {},
        brandingRef,
      },
    });
    return created.id;
  }
}
