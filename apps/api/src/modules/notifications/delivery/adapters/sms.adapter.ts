import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { SMS_SENDER, SmsSenderPort } from '../../../auth/infrastructure/services/sms-sender.port';
import { NotificationChannelId, ProviderSendResult } from '../delivery.types';
import { NotificationProviderAdapter, ProviderHealth, ProviderSendInput, ProviderUnavailableError } from '../provider-adapter.contract';

@Injectable()
export class SmsAdapter implements NotificationProviderAdapter {
  readonly providerKey = 'sms-port';
  readonly channelId: NotificationChannelId = 'sms';

  constructor(
    @Inject(SMS_SENDER) private readonly sms: SmsSenderPort,
    private readonly prisma: PrismaService,
  ) {}

  isAvailable(): boolean {
    return true;
  }

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    const phone = await this.resolveRecipientPhone(input);
    if (!phone) {
      throw new ProviderUnavailableError(this.providerKey, 'no recipient phone number on file');
    }

    await this.sms.sendInvite(phone, input.body);
    return { success: true, providerKey: this.providerKey, channel: this.channelId };
  }

  health(): ProviderHealth {
    return { healthy: true };
  }

  private async resolveRecipientPhone(input: ProviderSendInput): Promise<string | null> {
    const metaPhone = input.metadata?.recipientPhone;
    if (typeof metaPhone === 'string' && metaPhone.trim()) {
      return metaPhone.trim();
    }
    const user = await this.prisma.user.findFirst({
      where: { id: input.recipientId, tenantId: input.tenantId },
      select: { phone: true },
    });
    return user?.phone ?? null;
  }
}
