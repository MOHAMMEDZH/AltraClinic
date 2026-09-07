import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { NotificationIntentProducerService } from '../../notifications/delivery/notification-intent-producer.service';
import { DeliveryWorkerService } from '../../notifications/delivery/delivery-worker.service';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import {
  PLATFORM_NOTIFICATION_AUDIT_ACTIONS,
  PLATFORM_NOTIFICATION_PRODUCER_MODULE,
  PLATFORM_NOTIFICATION_SYSTEM_ACTOR_ID,
  isPlatformNotificationFailureInjectionActive,
} from '../platform-notifications.constants';
import type {
  PlatformDispatchRequest,
  PlatformDispatchResult,
  PlatformNotificationLocale,
} from '../domain/platform-notifications.types';
import {
  PlatformNotificationValidationError,
} from '../domain/platform-notifications.errors';
import {
  getPlatformTemplateForEvent,
  renderPlatformTemplate,
} from './templates/platform-template.catalog';
import { PlatformNotificationPreferenceService } from './preferences/platform-notification-preference.service';
import { PlatformNotificationAuditLog } from './platform-notification-audit.log';

function buildDedupeKey(req: PlatformDispatchRequest, channel: string): string {
  return [
    req.eventKey,
    req.sourceType,
    req.sourceId,
    req.windowKey ?? 'default',
    req.recipientId,
    channel,
  ].join('|');
}

/**
 * Flexible Step 27 — single sanctioned produce path into the Phase 41d engine.
 * Never mutates business SoRs. Dedupes via NotificationIntent unique (tenantId, idempotencyKey).
 */
@Injectable()
export class PlatformNotificationDispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: NotificationIntentProducerService,
    private readonly worker: DeliveryWorkerService,
    private readonly prefs: PlatformNotificationPreferenceService,
    private readonly audit: PlatformNotificationAuditLog,
  ) {}

  async dispatch(
    req: PlatformDispatchRequest,
    actorId: string = PLATFORM_NOTIFICATION_SYSTEM_ACTOR_ID,
  ): Promise<PlatformDispatchResult> {
    if (isPlatformNotificationFailureInjectionActive('event_adapter')) {
      throw new PlatformNotificationValidationError(
        'Injected event adapter failure',
        'injected_failure',
      );
    }
    if (isPlatformNotificationFailureInjectionActive('recipient_resolution')) {
      throw new PlatformNotificationValidationError(
        'Injected recipient resolution failure',
        'injected_failure',
      );
    }

    const template = getPlatformTemplateForEvent(req.eventKey);
    const locale: PlatformNotificationLocale = req.locale ?? 'en-US';
    const channels =
      req.channels ??
      (req.recipientKind === 'platform_user'
        ? (['email'] as const)
        : (template.channels as Array<'email' | 'in-app'>));

    if (req.recipientKind === 'platform_user') {
      const enabled = await this.prefs.isEnabled(
        req.recipientId,
        template.category,
        'email',
      );
      if (!enabled) {
        return {
          accepted: false,
          suppressed: true,
          suppressReason: 'preference_disabled',
          dedupeKey: buildDedupeKey(req, 'email'),
        };
      }
      if (!req.recipientEmail?.trim()) {
        throw new PlatformNotificationValidationError(
          'recipientEmail required for platform_user',
          'recipient_email_required',
        );
      }
    }

    const rendered = renderPlatformTemplate(template, locale, req.variables);
    const primaryChannel = channels[0] ?? 'email';
    const dedupeKey = buildDedupeKey(req, primaryChannel);

    const tenantId =
      req.recipientKind === 'clinic_user'
        ? req.clinicTenantId
        : PLATFORM_AUDIT_SENTINEL_TENANT_ID;
    if (!tenantId) {
      throw new PlatformNotificationValidationError(
        'clinicTenantId required for clinic_user',
        'clinic_tenant_required',
      );
    }

    if (isPlatformNotificationFailureInjectionActive('intent_persist')) {
      throw new PlatformNotificationValidationError(
        'Injected intent persist failure',
        'injected_failure',
      );
    }

    try {
      const result = await this.producer.produceChannels({
        tenantId,
        recipientId: req.recipientId,
        recipientType: req.recipientKind === 'platform_user' ? 'platform_user' : 'user',
        title: rendered.subject,
        body: rendered.body,
        titleAr: locale === 'ar-SY' ? rendered.subject : undefined,
        bodyAr: locale === 'ar-SY' ? rendered.body : undefined,
        channels: [...channels],
        // NOT template.key: NotificationIntentService.validate() rejects any notificationTypeId
        // outside @booking/module-registry's clinic-facing CANONICAL_NOTIFICATION_TYPE_IDS, and
        // Step 27 platform template keys (`tpl.platform.*`) are intentionally not part of that
        // clinic vocabulary. The template key is still fully recoverable from
        // `metadata.templateKey` below (see PlatformNotificationQueryService.listDeliveries).
        category: template.category,
        // Always true (not template.mandatory): without a matching canonical notification type,
        // DeliveryOrchestratorService's ConsentEvaluationService falls back to the
        // 'transactional-necessity' policy, which unconditionally DENIES non-transactional
        // messages. Step 27 already performs its own mandatory-vs-optional gate above via
        // `this.prefs.isEnabled()` (MANDATORY_PREFERENCE_CATEGORIES) *before* reaching the
        // producer, so the generic engine's consent stage must always allow the message through.
        transactional: true,
        priority: template.mandatory ? 'high' : 'medium',
        idempotencyKey: dedupeKey.slice(0, 200),
        producerModuleId: PLATFORM_NOTIFICATION_PRODUCER_MODULE,
        correlationId: req.correlationId,
        metadata: {
          recipientEmail: req.recipientEmail,
          recipientType: req.recipientKind === 'platform_user' ? 'platform_user' : 'user',
          eventKey: req.eventKey,
          sourceType: req.sourceType,
          sourceId: req.sourceId,
          windowKey: req.windowKey ?? 'default',
          templateKey: template.key,
          templateVersion: template.version,
          step27: true,
          ...(isPlatformNotificationFailureInjectionActive('provider_transient')
            ? { deliveryGateForceFail: true }
            : {}),
        },
      });

      let jobIds: string[] = [];
      const jobs = await this.prisma.withPlatformBypass((client) =>
        client.deliveryJob.findMany({
          where: { intentId: result.intentId },
          select: { id: true, status: true },
          orderBy: { id: 'asc' },
        }),
      );
      jobIds = jobs.map((j) => j.id);

      // NODE_ENV=test workers are disabled — process synchronously for observability.
      if (process.env.NODE_ENV === 'test') {
        for (const job of jobs) {
          if (job.status === 'pending' || job.status === 'queued') {
            await this.worker.processDeliveryJob(job.id);
          }
        }
      }

      await this.audit.record({
        action: PLATFORM_NOTIFICATION_AUDIT_ACTIONS.DISPATCHED,
        resourceType: 'notification_intent',
        resourceId: result.intentId,
        actorId,
        result: 'success',
        descriptionEn: 'Platform notification dispatched',
        descriptionAr: 'تم إرسال إشعار المنصة',
        details: {
          eventKey: req.eventKey,
          sourceType: req.sourceType,
          sourceId: req.sourceId,
          templateKey: template.key,
        },
        correlationId: req.correlationId,
      });

      return {
        accepted: true,
        intentId: result.intentId,
        jobIds,
        dedupeKey,
        replayed: false,
      };
    } catch (err) {
      if (err instanceof ConflictException || (err as { status?: number })?.status === 409) {
        const existing = await this.prisma.withPlatformBypass((client) =>
          client.notificationIntent.findFirst({
            where: { tenantId, idempotencyKey: dedupeKey.slice(0, 200) },
            select: { id: true },
          }),
        );
        return {
          accepted: true,
          replayed: true,
          intentId: existing?.id,
          dedupeKey,
        };
      }
      throw err;
    }
  }
}
