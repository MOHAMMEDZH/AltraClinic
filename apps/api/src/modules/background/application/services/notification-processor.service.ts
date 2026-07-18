import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantExecutionService } from '../../../../infrastructure/tenant-execution.service';
import { TransactionalEmailService } from '../../../../infrastructure/transactional-email.service';
import { SMS_SENDER, SmsSenderPort } from '../../../auth/infrastructure/services/sms-sender.port';
import { PUSH_SENDER, PushSenderPort } from '../../../auth/infrastructure/services/push-sender.port';
import { LicensingExecutionGuard } from '../../../subscription/application/services/licensing-execution.guard';
import { CommunicationDispatchService } from '../../../subscription/application/services/communication-dispatch.service';
import {
  CommunicationChannel,
  CommunicationLimitExceededException,
} from '../../../subscription/domain/exceptions/communication-limit-exceeded.exception';

export interface NotificationProcessResult {
  processed: number;
  failed: number;
  skippedUnlicensed: number;
  skippedQuota: number;
}

export class NotificationDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationDeliveryError';
  }
}

/**
 * Phase 41d/41e legacy safety net ONLY. Every notification producer must now route through
 * `DeliveryOrchestratorService` — either via `CreateNotificationHandler` (user-facing
 * compose/API path) or `NotificationIntentProducerService` (all other producers; see
 * notifications/delivery/notification-intent-producer.service.ts). Rows created that way are
 * tagged `metadata.deliveryEngine === '41d'` and are owned end-to-end by `DeliveryWorkerService`
 * — this processor explicitly skips them (see the check in the loop below).
 *
 * New producers MUST NOT write directly to the `notification` table and rely on this processor
 * to pick the row up; that bypasses consent/preference/quiet-hours gating entirely. This class
 * exists only to keep draining any pre-41d rows still sitting in QUEUED status until they're
 * fully cleared.
 */
@Injectable()
export class NotificationProcessorService {
  private readonly logger = new Logger(NotificationProcessorService.name);
  private hasLoggedLegacyDrained = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantExecution: TenantExecutionService,
    private readonly email: TransactionalEmailService,
    @Inject(SMS_SENDER) private readonly sms: SmsSenderPort,
    @Inject(PUSH_SENDER) private readonly push: PushSenderPort,
    private readonly licensing: LicensingExecutionGuard,
    private readonly communicationLimits: CommunicationDispatchService,
  ) {}

  async processQueued(batchSize = 100): Promise<NotificationProcessResult> {
    const result: NotificationProcessResult = {
      processed: 0,
      failed: 0,
      skippedUnlicensed: 0,
      skippedQuota: 0,
    };

    const rows = await this.prisma.getRootClient().notification.findMany({
      where: {
        status: 'QUEUED',
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    let legacyRowsSeen = 0;

    for (const row of rows) {
      const meta = (row.metadata as Record<string, unknown> | null) ?? {};
      // Phase 41d ownership: DeliveryWorkerService owns rows created by the orchestrator.
      if (meta.deliveryEngine === '41d') {
        continue;
      }
      legacyRowsSeen++;

      const allowed = await this.licensing.allowWorkerExecution({
        tenantId: row.tenantId,
        workerName: 'notification-processor',
        moduleId: 'notifications',
        source: 'worker.notifications',
        allowReadOnly: this.isSystemNotification(row.metadata, row.title),
      });
      if (!allowed) {
        result.skippedUnlicensed++;
        continue;
      }

      try {
        await this.tenantExecution.runAsTenant(row.tenantId, () => this.dispatch(row));
        result.processed++;
      } catch (error) {
        if (error instanceof CommunicationLimitExceededException) {
          result.skippedQuota++;
          await this.tenantExecution.runAsTenant(row.tenantId, () =>
            this.prisma.notification.update({
              where: { id: row.id },
              data: {
                status: 'FAILED',
                failureReason: JSON.stringify(error.getResponse()).slice(0, 500),
                updatedAt: new Date(),
              },
            }),
          );
          continue;
        }

        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Notification dispatch failed for ${row.id}`, error instanceof Error ? error.stack : String(error));
        await this.tenantExecution.runAsTenant(row.tenantId, () =>
          this.prisma.notification.update({
            where: { id: row.id },
            data: {
              status: 'FAILED',
              failureReason: message.slice(0, 500),
              retryCount: { increment: 1 },
              updatedAt: new Date(),
            },
          }),
        );
        result.failed++;
      }
    }

    if (legacyRowsSeen === 0 && !this.hasLoggedLegacyDrained) {
      this.logger.log(
        'No remaining pre-41d QUEUED notifications found; all producers appear to be routed through DeliveryOrchestratorService.',
      );
      this.hasLoggedLegacyDrained = true;
    } else if (legacyRowsSeen > 0) {
      // Once legacy rows resume being drained (e.g. after a rollback), allow the "drained" log
      // to fire again next time the backlog reaches zero.
      this.hasLoggedLegacyDrained = false;
    }

    return result;
  }

  private async dispatch(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    recipientId: string;
    channel: string;
    priority: string;
    title: string;
    body: string;
    metadata: unknown;
  }): Promise<void> {
    const now = new Date();
    const channel = this.normalizeChannel(row.channel);

    if (channel !== 'IN_APP') {
      if (await this.communicationLimits.isAlreadyCommitted(row.id)) {
        await this.prisma.notification.update({
          where: { id: row.id },
          data: { status: 'DELIVERED', sentAt: now, deliveredAt: now, updatedAt: now },
        });
        return;
      }
      await this.communicationLimits.assertCanDispatch(row.tenantId, channel, row.id);
    }

    switch (channel) {
      case 'IN_APP':
        await this.prisma.notification.update({
          where: { id: row.id },
          data: { status: 'DELIVERED', sentAt: now, deliveredAt: now, updatedAt: now },
        });
        break;

      case 'EMAIL': {
        const meta = (row.metadata as Record<string, unknown> | null) ?? {};
        const recipientEmail =
          typeof meta.recipientEmail === 'string'
            ? meta.recipientEmail
            : await this.resolveUserEmail(row.tenantId, row.recipientId);
        if (!recipientEmail?.trim()) {
          throw new NotificationDeliveryError('EMAIL delivery requires recipientEmail or user email');
        }
        await this.email.send({
          to: recipientEmail,
          subject: row.title,
          text: row.body,
          html: `<p>${row.body.replace(/\n/g, '<br/>')}</p>`,
        });
        await this.communicationLimits.commitDispatch(row.tenantId, channel, row.id);
        await this.prisma.notification.update({
          where: { id: row.id },
          data: { status: 'DELIVERED', sentAt: now, deliveredAt: now, updatedAt: now },
        });
        break;
      }

      case 'SMS': {
        const meta = (row.metadata as Record<string, unknown> | null) ?? {};
        const phone =
          typeof meta.recipientPhone === 'string'
            ? meta.recipientPhone
            : await this.resolveUserPhone(row.tenantId, row.recipientId);
        if (!phone?.trim()) {
          throw new NotificationDeliveryError('SMS delivery requires recipientPhone or user phone');
        }
        await this.sms.sendInvite(phone, row.body);
        await this.communicationLimits.commitDispatch(row.tenantId, channel, row.id);
        await this.prisma.notification.update({
          where: { id: row.id },
          data: { status: 'DELIVERED', sentAt: now, deliveredAt: now, updatedAt: now },
        });
        break;
      }

      case 'PUSH': {
        const tokens = await (this.prisma as unknown as {
          userDeviceToken: { findMany: (args: unknown) => Promise<{ token: string }[]> };
        }).userDeviceToken.findMany({
          where: { tenantId: row.tenantId, userId: row.recipientId, isActive: true },
          select: { token: true },
        });
        if (!tokens.length) {
          throw new NotificationDeliveryError('PUSH delivery requires at least one active device token');
        }
        for (const { token } of tokens) {
          await this.push.sendPush(token, row.title, row.body);
        }
        await this.communicationLimits.commitDispatch(row.tenantId, channel, row.id);
        await this.prisma.notification.update({
          where: { id: row.id },
          data: { status: 'DELIVERED', sentAt: now, deliveredAt: now, updatedAt: now },
        });
        break;
      }

      case 'WHATSAPP': {
        // Phase 41d: never claim WhatsApp success via SMS. Legacy processor fails closed;
        // unified WhatsApp adapter lives in DeliveryModule (WHATSAPP_ADAPTER gate).
        throw new NotificationDeliveryError(
          'WHATSAPP delivery via legacy processor is disabled; use DeliveryOrchestrator WhatsApp adapter (fail-closed when unconfigured)',
        );
      }

      default:
        await this.prisma.notification.update({
          where: { id: row.id },
          data: { status: 'SENT', sentAt: now, updatedAt: now },
        });
    }
  }

  private normalizeChannel(raw: string): CommunicationChannel {
    const upper = raw.toUpperCase();
    if (upper === 'IN_APP' || upper === 'IN-APP') return 'IN_APP';
    if (upper === 'EMAIL') return 'EMAIL';
    if (upper === 'SMS') return 'SMS';
    if (upper === 'PUSH') return 'PUSH';
    if (upper === 'WHATSAPP') return 'WHATSAPP';
    return 'IN_APP';
  }

  private isSystemNotification(metadata: unknown, title?: string): boolean {
    const meta = metadata as Record<string, unknown> | null;
    if (meta?.system === true) return true;
    return typeof title === 'string' && title.startsWith('Subscription expires');
  }

  private async resolveUserEmail(tenantId: string, userId: string): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { email: true },
    });
    return user?.email ?? null;
  }

  private async resolveUserPhone(tenantId: string, userId: string): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { phone: true },
    });
    return user?.phone ?? null;
  }
}
