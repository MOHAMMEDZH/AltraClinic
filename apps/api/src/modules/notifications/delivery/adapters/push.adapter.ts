import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { PUSH_SENDER, PushSenderPort } from '../../../auth/infrastructure/services/push-sender.port';
import { NotificationChannelId, ProviderSendResult } from '../delivery.types';
import { NotificationProviderAdapter, ProviderHealth, ProviderSendInput, ProviderUnavailableError } from '../provider-adapter.contract';

@Injectable()
export class PushAdapter implements NotificationProviderAdapter {
  readonly providerKey = 'push-device-tokens';
  readonly channelId: NotificationChannelId = 'push';

  constructor(
    @Inject(PUSH_SENDER) private readonly push: PushSenderPort,
    private readonly prisma: PrismaService,
  ) {}

  isAvailable(): boolean {
    return true;
  }

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    const tokens = await (
      this.prisma as unknown as {
        userDeviceToken: { findMany: (args: unknown) => Promise<{ token: string }[]> };
      }
    ).userDeviceToken.findMany({
      where: { tenantId: input.tenantId, userId: input.recipientId, isActive: true },
      select: { token: true },
    });

    if (!tokens.length) {
      throw new ProviderUnavailableError(this.providerKey, 'recipient has no active device tokens');
    }

    const redactLockScreen = input.metadata?.redactLockScreen === true;
    const effectiveBody = redactLockScreen ? '' : input.body;

    for (const { token } of tokens) {
      await this.push.sendPush(token, input.title, effectiveBody);
    }

    return { success: true, providerKey: this.providerKey, channel: this.channelId };
  }

  health(): ProviderHealth {
    return { healthy: true };
  }
}
