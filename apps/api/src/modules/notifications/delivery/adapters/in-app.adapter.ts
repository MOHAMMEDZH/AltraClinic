import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { NotificationChannelId, ProviderSendResult } from '../delivery.types';
import { NotificationProviderAdapter, ProviderHealth, ProviderSendInput } from '../provider-adapter.contract';

/**
 * In-app "adapter" is the legacy inbox itself — delivery is instantaneous and always available.
 * It updates (or, defensively, creates) the legacy `Notification` row so the existing inbox UI
 * keeps working unchanged while the new delivery engine becomes the source of truth for state.
 */
@Injectable()
export class InAppAdapter implements NotificationProviderAdapter {
  readonly providerKey = 'in-app-inbox';
  readonly channelId: NotificationChannelId = 'in-app';

  constructor(private readonly prisma: PrismaService) {}

  isAvailable(): boolean {
    return true;
  }

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    // Non-production gate hook only — used by Phase 41e runtime verification to exercise
    // retry / dead-letter without calling real external providers. Never active in production.
    if (
      process.env.NODE_ENV !== 'production' &&
      input.metadata?.deliveryGateForceFail === true
    ) {
      return {
        success: false,
        providerKey: this.providerKey,
        channel: this.channelId,
        error: 'deliveryGateForceFail',
        failureClass: 'retryable',
      };
    }

    const now = new Date();

    if (input.notificationId) {
      await this.prisma.notification.update({
        where: { id: input.notificationId },
        data: { status: 'DELIVERED', sentAt: now, deliveredAt: now, updatedAt: now },
      });
      return { success: true, providerKey: this.providerKey, channel: this.channelId, externalId: input.notificationId };
    }

    const created = await this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        branchId: input.branchId ?? null,
        recipientId: input.recipientId,
        channel: 'IN_APP',
        title: input.title,
        body: input.body,
        status: 'DELIVERED',
        sentAt: now,
        deliveredAt: now,
        metadata: (input.metadata as never) ?? undefined,
      },
    });

    return { success: true, providerKey: this.providerKey, channel: this.channelId, externalId: created.id };
  }

  health(): ProviderHealth {
    return { healthy: true };
  }
}
