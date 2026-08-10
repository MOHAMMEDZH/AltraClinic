/**
 * Phase 44c — webhook / provider domain aggregates.
 */

export type WebhookSubscriptionStatus = 'active' | 'disabled' | 'paused';

export type WebhookDeliveryStatus =
  | 'pending'
  | 'queued'
  | 'delivering'
  | 'succeeded'
  | 'failed'
  | 'dead_lettered'
  | 'cancelled';

export type WebhookAttemptOutcome =
  | 'succeeded'
  | 'retryable'
  | 'permanent'
  | 'timeout';

export const INTEGRATION_EVENT_TYPES = [
  'credential.created',
  'credential.rotated',
  'credential.revoked',
  'credential.expired',
  'service-account.created',
  'service-account.disabled',
] as const;

export type IntegrationEventType = (typeof INTEGRATION_EVENT_TYPES)[number];

export interface IntegrationProvider {
  id: string;
  tenantId: string | null; // null = platform catalog
  providerKey: string;
  displayName: string;
  direction: 'outbound' | 'inbound' | 'both';
  status: 'active' | 'disabled' | 'inactive';
  adapterKind: 'generic.http' | 'generic.inbound';
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationWebhookSecret {
  id: string;
  tenantId: string;
  subscriptionId: string;
  version: number;
  /** AES-256-GCM envelope (base64) — never plaintext. */
  ciphertextEnvelope: string;
  status: 'active' | 'retired';
  createdAt: string;
  retiredAt: string | null;
}

export interface WebhookSubscription {
  id: string;
  tenantId: string;
  name: string;
  targetUrl: string;
  providerKey: string;
  status: WebhookSubscriptionStatus;
  eventFilters: readonly string[];
  secretId: string;
  secretVersion: number;
  maxAttempts: number;
  timeoutMs: number;
  customHeaders: Record<string, string>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  disabledAt: string | null;
}

export interface WebhookDelivery {
  id: string;
  tenantId: string;
  subscriptionId: string;
  eventType: string;
  eventId: string;
  correlationId: string;
  causationId: string | null;
  payloadJson: string;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  responseCode: number | null;
  deadLetteredAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface WebhookDeliveryAttempt {
  id: string;
  tenantId: string;
  deliveryId: string;
  attemptNumber: number;
  outcome: WebhookAttemptOutcome;
  responseCode: number | null;
  latencyMs: number | null;
  errorMessage: string | null;
  nonce: string | null;
  createdAt: string;
}

export interface InboundWebhookEndpoint {
  id: string;
  tenantId: string;
  tenantSlug: string;
  providerKey: string;
  pathKey: string;
  status: 'active' | 'disabled';
  secretId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationEventEnvelope {
  id: string;
  type: IntegrationEventType | string;
  version: '1';
  tenantId: string;
  occurredAt: string;
  correlationId: string;
  causationId?: string | null;
  data: Record<string, unknown>;
}

export function computeBackoffDelayMs(
  attemptNumber: number,
  baseMs = 1000,
  maxMs = 60_000,
): number {
  const exp = Math.min(attemptNumber - 1, 6);
  const delay = baseMs * 2 ** exp;
  return Math.min(delay, maxMs);
}
