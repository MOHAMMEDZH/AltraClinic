import { ValueObject } from '../../../../common/value-object.base';

const validChannels = new Set(['in-app', 'email', 'sms', 'push', 'whatsapp']);

export class NotificationChannel extends ValueObject<{ channel: string; failoverChannel: string | null }> {
  public readonly channel: string;
  public readonly failoverChannel: string | null;

  private constructor(channel: string, failoverChannel: string | null) {
    super({ channel, failoverChannel });
    this.channel = channel;
    this.failoverChannel = failoverChannel;
  }

  public static create(channel: string, failoverChannel: string | null = null): NotificationChannel {
    const normalized = String(channel ?? '').trim();
    if (!normalized || !validChannels.has(normalized)) {
      throw new Error(`Invalid notification channel: ${channel}`);
    }

    const normalizedFailover = failoverChannel ? String(failoverChannel).trim() : null;
    return new NotificationChannel(normalized, normalizedFailover);
  }

  public getPriority(): number {
    switch (this.channel) {
      case 'push':
        return 5;
      case 'email':
        return 4;
      case 'sms':
        return 3;
      case 'whatsapp':
        return 2;
      default:
        return 1;
    }
  }

  public toJSON() {
    return {
      channel: this.channel,
      failoverChannel: this.failoverChannel,
    };
  }
}
