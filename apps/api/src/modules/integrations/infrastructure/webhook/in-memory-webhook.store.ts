import { Injectable } from '@nestjs/common';
import type {
  InboundWebhookEndpoint,
  IntegrationProvider,
  IntegrationWebhookSecret,
  WebhookDelivery,
  WebhookDeliveryAttempt,
  WebhookSubscription,
} from '../../domain/webhook/webhook.types';

@Injectable()
export class InMemoryWebhookStore {
  readonly subscriptions = new Map<string, WebhookSubscription>();
  readonly secrets = new Map<string, IntegrationWebhookSecret>();
  readonly deliveries = new Map<string, WebhookDelivery>();
  readonly attempts = new Map<string, WebhookDeliveryAttempt>();
  readonly providers = new Map<string, IntegrationProvider>();
  readonly inboundEndpoints = new Map<string, InboundWebhookEndpoint>();
  readonly usedNonces = new Map<string, number>(); // nonce -> expiresAt epoch ms

  clear(): void {
    this.subscriptions.clear();
    this.secrets.clear();
    this.deliveries.clear();
    this.attempts.clear();
    this.providers.clear();
    this.inboundEndpoints.clear();
    this.usedNonces.clear();
  }

  listSubscriptions(tenantId: string): WebhookSubscription[] {
    return [...this.subscriptions.values()].filter((s) => s.tenantId === tenantId);
  }

  listDeliveries(tenantId: string, subscriptionId?: string): WebhookDelivery[] {
    return [...this.deliveries.values()].filter(
      (d) =>
        d.tenantId === tenantId &&
        (!subscriptionId || d.subscriptionId === subscriptionId),
    );
  }

  listAttempts(tenantId: string, deliveryId: string): WebhookDeliveryAttempt[] {
    return [...this.attempts.values()]
      .filter((a) => a.tenantId === tenantId && a.deliveryId === deliveryId)
      .sort((a, b) => a.attemptNumber - b.attemptNumber);
  }

  rememberNonce(nonce: string, ttlMs = 600_000): boolean {
    const now = Date.now();
    for (const [k, exp] of this.usedNonces) {
      if (exp <= now) this.usedNonces.delete(k);
    }
    if (this.usedNonces.has(nonce)) return false;
    this.usedNonces.set(nonce, now + ttlMs);
    return true;
  }
}
