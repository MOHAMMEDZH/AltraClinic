import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { DeliveryJobService } from '../../notifications/delivery/delivery-job.service';
import { DeliveryWorkerService } from '../../notifications/delivery/delivery-worker.service';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  PLATFORM_NOTIFICATION_AUDIT_ACTIONS,
  PLATFORM_NOTIFICATION_PERMISSIONS,
  isPlatformNotificationFailureInjectionActive,
} from '../platform-notifications.constants';
import {
  PlatformNotificationForbiddenError,
  PlatformNotificationNotFoundError,
  PlatformNotificationValidationError,
} from '../domain/platform-notifications.errors';
import {
  getPlatformTemplateByKey,
  listPlatformTemplates,
  renderPlatformTemplate,
  syntheticPreviewVariables,
} from './templates/platform-template.catalog';
import type { PlatformNotificationLocale } from '../domain/platform-notifications.types';
import { PlatformNotificationAuditLog } from './platform-notification-audit.log';

@Injectable()
export class PlatformNotificationQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: DeliveryJobService,
    private readonly worker: DeliveryWorkerService,
    private readonly audit: PlatformNotificationAuditLog,
  ) {}

  listTemplates(perms: ReadonlySet<string>) {
    if (!perms.has(PLATFORM_NOTIFICATION_PERMISSIONS.templatesView)) {
      throw new PlatformNotificationForbiddenError('Missing templates.view');
    }
    return listPlatformTemplates().map((t) => ({
      key: t.key,
      eventKeys: t.eventKeys,
      category: t.category,
      mandatory: t.mandatory,
      channels: t.channels,
      version: t.version,
      variables: t.variables,
      requiredVariables: t.requiredVariables,
      locales: Object.keys(t.locales),
    }));
  }

  getTemplate(perms: ReadonlySet<string>, key: string) {
    if (!perms.has(PLATFORM_NOTIFICATION_PERMISSIONS.templatesView)) {
      throw new PlatformNotificationForbiddenError('Missing templates.view');
    }
    const t = getPlatformTemplateByKey(key);
    return {
      ...t,
      locales: t.locales,
    };
  }

  preview(
    user: JwtClaimsVO,
    perms: ReadonlySet<string>,
    key: string,
    locale: PlatformNotificationLocale = 'en-US',
  ) {
    if (!perms.has(PLATFORM_NOTIFICATION_PERMISSIONS.templatesView)) {
      throw new PlatformNotificationForbiddenError('Missing templates.view');
    }
    const t = getPlatformTemplateByKey(key);
    const vars = syntheticPreviewVariables(t);
    const rendered = renderPlatformTemplate(t, locale, vars);
    // `audit_entries.resourceId` is `@db.Uuid`; the template key ("tpl.platform.*") is not a
    // UUID, so it travels in `details` instead and the actor's own id anchors the row.
    void this.audit.record({
      action: PLATFORM_NOTIFICATION_AUDIT_ACTIONS.PREVIEW,
      resourceType: 'platform_notification_template',
      resourceId: user.sub,
      actorId: user.sub,
      result: 'success',
      descriptionEn: 'Template previewed with synthetic data',
      descriptionAr: 'تم معاينة القالب ببيانات اصطناعية',
      details: { locale, synthetic: true, templateKey: key },
    });
    return { templateKey: key, locale, variables: vars, ...rendered };
  }

  async listDeliveries(
    perms: ReadonlySet<string>,
    q: { page?: number; pageSize?: number; status?: string },
  ) {
    if (!perms.has(PLATFORM_NOTIFICATION_PERMISSIONS.deliveriesView)) {
      throw new PlatformNotificationForbiddenError('Missing deliveries.view');
    }
    const page = Math.max(1, q.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 25));
    // NotificationIntentService.createIntent() does not persist the native `producerModuleId`
    // column (Phase 41d gap affecting every producer, not just Step 27) — filter on the
    // `metadata.step27` flag that PlatformNotificationDispatchService always sets instead.
    const where = {
      metadata: { path: ['step27'], equals: true } as Prisma.JsonFilter,
      ...(q.status ? { status: q.status } : {}),
    };
    const [total, items] = await this.prisma.withPlatformBypass(async (client) => {
      const totalCount = await client.notificationIntent.count({ where });
      const rows = await client.notificationIntent.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          status: true,
          notificationTypeId: true,
          category: true,
          recipientId: true,
          recipientType: true,
          createdAt: true,
          idempotencyKey: true,
          metadata: true,
            jobs: {
            select: {
              id: true,
              channel: true,
              status: true,
              attemptCount: true,
              scheduledAt: true,
              failureReason: true,
            },
            orderBy: { id: 'asc' },
          },
        },
      });
      return [totalCount, rows] as const;
    });

    return {
      page,
      pageSize,
      total,
      items: items.map((i) => ({
        id: i.id,
        status: i.status,
        // Step 27 template keys are intentionally not stored in notificationTypeId (that column
        // is validated against the clinic-facing canonical vocabulary) — recover from metadata.
        templateKey: (i.metadata as Record<string, unknown>)?.templateKey ?? i.notificationTypeId ?? null,
        category: i.category,
        recipientId: i.recipientId,
        recipientType: i.recipientType,
        createdAt: i.createdAt.toISOString(),
        eventKey: (i.metadata as Record<string, unknown>)?.eventKey ?? null,
        sourceType: (i.metadata as Record<string, unknown>)?.sourceType ?? null,
        sourceId: (i.metadata as Record<string, unknown>)?.sourceId ?? null,
        jobs: i.jobs.map((j) => ({
          id: j.id,
          channel: j.channel,
          status: j.status,
          attemptCount: j.attemptCount,
          nextRetryAt: j.scheduledAt?.toISOString() ?? null,
          errorClass: j.failureReason ? String(j.failureReason).slice(0, 120) : null,
        })),
      })),
    };
  }

  async getDelivery(perms: ReadonlySet<string>, id: string) {
    if (!perms.has(PLATFORM_NOTIFICATION_PERMISSIONS.deliveriesView)) {
      throw new PlatformNotificationForbiddenError('Missing deliveries.view');
    }
    const row = await this.prisma.withPlatformBypass((client) =>
      client.notificationIntent.findFirst({
        where: { id, metadata: { path: ['step27'], equals: true } as Prisma.JsonFilter },
        include: { jobs: { orderBy: { id: 'asc' } } },
      }),
    );
    if (!row) throw new PlatformNotificationNotFoundError('Delivery not found');
    return row;
  }

  async retryDelivery(
    user: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
    input: { reason: string; jobId?: string },
    idempotencyKey: string,
  ) {
    if (!perms.has(PLATFORM_NOTIFICATION_PERMISSIONS.deliveriesRetry)) {
      throw new PlatformNotificationForbiddenError('Missing deliveries.retry');
    }
    if (!input.reason?.trim()) {
      throw new PlatformNotificationValidationError('reason is required', 'reason_required');
    }
    if (isPlatformNotificationFailureInjectionActive('dead_letter_transition')) {
      throw new PlatformNotificationValidationError(
        'Injected dead-letter transition failure',
        'injected_failure',
      );
    }
    if (isPlatformNotificationFailureInjectionActive('multi_instance_retry')) {
      throw new PlatformNotificationValidationError(
        'Injected multi-instance retry failure',
        'injected_failure',
      );
    }
    const intent = await this.getDelivery(perms, id);
    const job =
      intent.jobs.find((j) => (input.jobId ? j.id === input.jobId : true)) ?? null;
    if (!job) throw new PlatformNotificationNotFoundError('Delivery job not found');

    await this.audit.record({
      action: PLATFORM_NOTIFICATION_AUDIT_ACTIONS.RETRY_REQUESTED,
      resourceType: 'delivery_job',
      resourceId: job.id,
      actorId: user.sub,
      reason: input.reason,
      result: 'success',
      descriptionEn: 'Manual delivery retry requested',
      descriptionAr: 'تم طلب إعادة محاولة التسليم يدوياً',
      details: { intentId: intent.id, idempotencyKey },
    });

    await this.jobs.requeueJob(job.id);
    if (process.env.NODE_ENV === 'test') {
      await this.worker.processDeliveryJob(job.id);
    }
    return { accepted: true, jobId: job.id, intentId: intent.id };
  }
}
