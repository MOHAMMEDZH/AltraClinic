import { NotificationChannelId, ProviderSendResult } from './delivery.types';

export class ProviderUnavailableError extends Error {
  constructor(
    public readonly providerKey: string,
    reason: string,
  ) {
    super(`Provider "${providerKey}" is unavailable: ${reason}`);
    this.name = 'ProviderUnavailableError';
  }
}

export interface ProviderSendInput {
  tenantId: string;
  branchId?: string | null;
  recipientId: string;
  channel: NotificationChannelId;
  notificationId?: string | null;
  messageId?: string | null;
  title: string;
  body: string;
  html?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ProviderHealth {
  healthy: boolean;
  detail?: string;
}

/**
 * Every channel adapter implements this contract. Adapters are the ONLY layer allowed to talk
 * to an actual transport (SMTP/Twilio/FCM/HTTP/DB). They must never claim success for a channel
 * they did not actually deliver on (e.g. WhatsApp must never silently succeed via SMS).
 */
export interface NotificationProviderAdapter {
  readonly providerKey: string;
  readonly channelId: NotificationChannelId;

  isAvailable(): Promise<boolean> | boolean;

  /** Throws ProviderUnavailableError if the adapter cannot service this send at all
   * (misconfiguration, missing credentials) — this is distinct from a retryable send failure. */
  send(input: ProviderSendInput): Promise<ProviderSendResult>;

  health(): Promise<ProviderHealth> | ProviderHealth;
}
