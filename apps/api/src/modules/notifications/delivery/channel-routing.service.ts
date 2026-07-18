import { Injectable } from '@nestjs/common';
import { ChannelPlan, NotificationChannelId } from './delivery.types';

/** Deterministic fallback order when a requested channel's provider is unavailable.
 * WhatsApp NEVER falls back through the SMS adapter (see whatsapp.adapter.ts) — if WhatsApp
 * is unavailable it is simply dropped from fallback candidacy for other channels' sake, but
 * more importantly `sms` and `whatsapp` are always routed to their own distinct adapters. */
export const DEFAULT_CHANNEL_FALLBACK_ORDER: readonly NotificationChannelId[] = [
  'in-app',
  'push',
  'email',
  'whatsapp',
  'sms',
  'webhook',
];

export interface ChannelRoutingInput {
  requestedChannels: NotificationChannelId[];
  allowedByConsent: NotificationChannelId[];
  allowedByPreference: NotificationChannelId[];
  /** Channel -> providerKey, present only for channels whose adapter reports available. */
  availableProviders: Partial<Record<NotificationChannelId, string>>;
  fallbackOrder?: readonly NotificationChannelId[];
  allowFallback?: boolean;
}

export interface RejectedChannel {
  channel: NotificationChannelId;
  reason: string;
}

export interface ChannelRoutingResult {
  plan: ChannelPlan[];
  rejected: RejectedChannel[];
}

/**
 * Deterministic routing: requested ∩ consent ∩ preference ∩ provider-availability, with an
 * optional ordered fallback list. Never assigns a provider key that would deliver WhatsApp
 * content through the SMS adapter (or vice versa) — each channel keeps its own dedicated
 * adapter identity end to end.
 */
@Injectable()
export class ChannelRoutingService {
  route(input: ChannelRoutingInput): ChannelRoutingResult {
    const consentSet = new Set(input.allowedByConsent);
    const preferenceSet = new Set(input.allowedByPreference);
    const fallbackOrder = input.fallbackOrder ?? DEFAULT_CHANNEL_FALLBACK_ORDER;
    const allowFallback = input.allowFallback ?? true;

    const eligible: NotificationChannelId[] = [];
    const rejected: RejectedChannel[] = [];

    for (const channel of input.requestedChannels) {
      if (!consentSet.has(channel)) {
        rejected.push({ channel, reason: 'blocked by consent policy' });
        continue;
      }
      if (!preferenceSet.has(channel)) {
        rejected.push({ channel, reason: 'blocked by recipient preference' });
        continue;
      }
      eligible.push(channel);
    }

    const plan: ChannelPlan[] = [];
    const planned = new Set<NotificationChannelId>();
    let order = 0;

    for (const channel of eligible) {
      const providerKey = input.availableProviders[channel];
      if (providerKey) {
        this.assertNoCrossChannelLeak(channel, providerKey);
        plan.push({ channel, providerKey, order: order++, isFallback: false });
        planned.add(channel);
        continue;
      }

      rejected.push({ channel, reason: 'provider unavailable' });

      if (!allowFallback) continue;

      const fallbackChannel = fallbackOrder.find(
        (candidate) =>
          candidate !== channel &&
          !planned.has(candidate) &&
          consentSet.has(candidate) &&
          preferenceSet.has(candidate) &&
          Boolean(input.availableProviders[candidate]),
      );

      if (fallbackChannel) {
        const providerKey = input.availableProviders[fallbackChannel] as string;
        this.assertNoCrossChannelLeak(fallbackChannel, providerKey);
        plan.push({ channel: fallbackChannel, providerKey, order: order++, isFallback: true });
        planned.add(fallbackChannel);
      }
    }

    return { plan, rejected };
  }

  private assertNoCrossChannelLeak(channel: NotificationChannelId, providerKey: string): void {
    const key = providerKey.toLowerCase();
    if (channel === 'whatsapp' && (key.includes('sms') && !key.includes('whatsapp'))) {
      throw new Error(`Routing integrity violation: WhatsApp channel cannot use SMS provider "${providerKey}"`);
    }
    if (channel === 'sms' && key.includes('whatsapp')) {
      throw new Error(`Routing integrity violation: SMS channel cannot use WhatsApp provider "${providerKey}"`);
    }
  }
}
