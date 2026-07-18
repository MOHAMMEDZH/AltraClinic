import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { NotificationChannelId, ProviderSendResult } from '../delivery.types';
import { NotificationProviderAdapter, ProviderHealth, ProviderSendInput, ProviderUnavailableError } from '../provider-adapter.contract';

export function isTwilioWhatsAppConfigured(): boolean {
  const adapter = process.env.WHATSAPP_ADAPTER?.trim();
  if (adapter !== 'twilio-content') return false;
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_WHATSAPP_FROM?.trim(),
  );
}

/**
 * WhatsApp adapter. Deliberately independent of the SMS adapter/provider: if Twilio WhatsApp
 * content credentials aren't configured, this MUST throw ProviderUnavailableError rather than
 * ever silently degrading to SMS (the legacy NotificationProcessorService bug this phase fixes).
 * There is no code path in this file that touches SmsSenderPort.
 */
@Injectable()
export class WhatsappAdapter implements NotificationProviderAdapter {
  readonly providerKey = 'whatsapp-twilio-content';
  readonly channelId: NotificationChannelId = 'whatsapp';

  constructor(private readonly prisma: PrismaService) {}

  isAvailable(): boolean {
    return isTwilioWhatsAppConfigured();
  }

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    if (!isTwilioWhatsAppConfigured()) {
      throw new ProviderUnavailableError(
        this.providerKey,
        'WHATSAPP_ADAPTER must be "twilio-content" with TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_WHATSAPP_FROM configured',
      );
    }

    const phone = await this.resolveRecipientPhone(input);
    if (!phone) {
      throw new ProviderUnavailableError(this.providerKey, 'no recipient phone number on file for WhatsApp');
    }

    const externalId = await this.sendViaTwilioContentApi(phone, input);
    return { success: true, providerKey: this.providerKey, channel: this.channelId, externalId };
  }

  health(): ProviderHealth {
    return isTwilioWhatsAppConfigured() ? { healthy: true } : { healthy: false, detail: 'twilio-content credentials missing' };
  }

  /** Isolated so unit tests can mock the network boundary without hitting Twilio. */
  protected async sendViaTwilioContentApi(phone: string, input: ProviderSendInput): Promise<string> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID as string;
    const authToken = process.env.TWILIO_AUTH_TOKEN as string;
    const from = process.env.TWILIO_WHATSAPP_FROM as string;

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: `whatsapp:${from}`,
        To: `whatsapp:${phone}`,
        Body: input.body,
      }).toString(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Twilio WhatsApp API failed: ${response.status} ${body}`);
    }

    const json = (await response.json()) as { sid?: string };
    return json.sid ?? '';
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
