import { createHmac } from 'crypto';
import { Injectable } from '@nestjs/common';
import { NotificationChannelId, ProviderSendResult } from '../delivery.types';
import { NotificationProviderAdapter, ProviderHealth, ProviderSendInput, ProviderUnavailableError } from '../provider-adapter.contract';
import { evaluateWebhookUrlSafety } from '../ssrf-guard';

const WEBHOOK_TIMEOUT_MS = 10_000;
export const WEBHOOK_SIGNATURE_HEADER = 'X-Booking-Signature';
export const WEBHOOK_TIMESTAMP_HEADER = 'X-Booking-Timestamp';

export function signWebhookPayload(secret: string, timestamp: string, rawBody: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

/**
 * Generic outbound webhook adapter. HTTPS-only, SSRF-guarded (rejects private/loopback/
 * link-local/metadata addresses), HMAC-SHA256 signed with a timestamp to prevent replay, and
 * bounded to a 10s timeout so a slow/unresponsive endpoint cannot stall the delivery worker.
 */
@Injectable()
export class WebhookAdapter implements NotificationProviderAdapter {
  readonly providerKey = 'webhook-generic';
  readonly channelId: NotificationChannelId = 'webhook';

  isAvailable(): boolean {
    return Boolean(process.env.WEBHOOK_SIGNING_SECRET?.trim());
  }

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    const url = input.metadata?.webhookUrl;
    if (typeof url !== 'string' || !url.trim()) {
      throw new ProviderUnavailableError(this.providerKey, 'no webhookUrl provided in metadata');
    }

    const safety = evaluateWebhookUrlSafety(url);
    if (!safety.safe) {
      throw new ProviderUnavailableError(this.providerKey, safety.reason);
    }

    const secret =
      (typeof input.metadata?.webhookSecret === 'string' && input.metadata.webhookSecret.trim()) ||
      process.env.WEBHOOK_SIGNING_SECRET?.trim();
    if (!secret) {
      throw new ProviderUnavailableError(this.providerKey, 'no webhook signing secret configured');
    }

    const payload = {
      tenantId: input.tenantId,
      recipientId: input.recipientId,
      title: input.title,
      body: input.body,
      notificationId: input.notificationId ?? null,
      metadata: input.metadata ?? {},
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signWebhookPayload(secret, timestamp, rawBody);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [WEBHOOK_SIGNATURE_HEADER]: signature,
          [WEBHOOK_TIMESTAMP_HEADER]: timestamp,
        },
        body: rawBody,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return {
          success: false,
          providerKey: this.providerKey,
          channel: this.channelId,
          error: `webhook responded ${response.status}: ${text.slice(0, 300)}`,
          failureClass: response.status >= 500 ? 'retryable' : 'permanent',
        };
      }

      return { success: true, providerKey: this.providerKey, channel: this.channelId };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isAbort = error instanceof Error && error.name === 'AbortError';
      return {
        success: false,
        providerKey: this.providerKey,
        channel: this.channelId,
        error: isAbort ? `webhook timed out after ${WEBHOOK_TIMEOUT_MS}ms` : message,
        failureClass: 'retryable',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  health(): ProviderHealth {
    return this.isAvailable() ? { healthy: true } : { healthy: false, detail: 'WEBHOOK_SIGNING_SECRET missing' };
  }
}
