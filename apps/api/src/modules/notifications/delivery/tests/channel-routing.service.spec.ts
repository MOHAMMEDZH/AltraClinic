import { ChannelRoutingService } from '../channel-routing.service';
import { NotificationChannelId } from '../delivery.types';

describe('ChannelRoutingService', () => {
  let service: ChannelRoutingService;

  beforeEach(() => {
    service = new ChannelRoutingService();
  });

  it('routes a requested channel that is allowed and available', () => {
    const result = service.route({
      requestedChannels: ['email'],
      allowedByConsent: ['email'],
      allowedByPreference: ['email'],
      availableProviders: { email: 'email-transactional' },
    });
    expect(result.plan).toEqual([{ channel: 'email', providerKey: 'email-transactional', order: 0, isFallback: false }]);
    expect(result.rejected).toEqual([]);
  });

  it('rejects a channel blocked by consent even if the provider is available', () => {
    const result = service.route({
      requestedChannels: ['sms'],
      allowedByConsent: [],
      allowedByPreference: ['sms'],
      availableProviders: { sms: 'sms-port' },
    });
    expect(result.plan).toEqual([]);
    expect(result.rejected).toEqual([{ channel: 'sms', reason: 'blocked by consent policy' }]);
  });

  it('rejects a channel blocked by preference', () => {
    const result = service.route({
      requestedChannels: ['push'],
      allowedByConsent: ['push'],
      allowedByPreference: [],
      availableProviders: { push: 'push-device-tokens' },
    });
    expect(result.rejected).toEqual([{ channel: 'push', reason: 'blocked by recipient preference' }]);
  });

  it('falls back to the next available channel when the requested provider is unavailable', () => {
    const result = service.route({
      requestedChannels: ['whatsapp'],
      allowedByConsent: ['whatsapp', 'sms', 'push', 'in-app'],
      allowedByPreference: ['whatsapp', 'sms', 'push', 'in-app'],
      availableProviders: { push: 'push-device-tokens', sms: 'sms-port' },
    });
    expect(result.plan).toHaveLength(1);
    expect(result.plan[0].isFallback).toBe(true);
    // DEFAULT_CHANNEL_FALLBACK_ORDER places push before sms.
    expect(result.plan[0].channel).toBe('push');
  });

  it('never routes the whatsapp channel through an SMS provider key', () => {
    expect(() =>
      service.route({
        requestedChannels: ['whatsapp'],
        allowedByConsent: ['whatsapp'],
        allowedByPreference: ['whatsapp'],
        availableProviders: { whatsapp: 'sms-port' },
      }),
    ).toThrow(/cannot use SMS provider/);
  });

  it('does not fall back when allowFallback is false', () => {
    const result = service.route({
      requestedChannels: ['whatsapp'],
      allowedByConsent: ['whatsapp', 'sms'],
      allowedByPreference: ['whatsapp', 'sms'],
      availableProviders: { sms: 'sms-port' },
      allowFallback: false,
    });
    expect(result.plan).toEqual([]);
    expect(result.rejected).toEqual([{ channel: 'whatsapp', reason: 'provider unavailable' }]);
  });

  it('produces a deterministic order across repeated calls with the same input', () => {
    const channels: NotificationChannelId[] = ['email', 'sms', 'push'];
    const availableProviders = { email: 'email-transactional', sms: 'sms-port', push: 'push-device-tokens' };

    const first = service.route({
      requestedChannels: [...channels],
      allowedByConsent: [...channels],
      allowedByPreference: [...channels],
      availableProviders,
    });
    const second = service.route({
      requestedChannels: [...channels],
      allowedByConsent: [...channels],
      allowedByPreference: [...channels],
      availableProviders,
    });
    expect(first.plan).toEqual(second.plan);
  });
});
