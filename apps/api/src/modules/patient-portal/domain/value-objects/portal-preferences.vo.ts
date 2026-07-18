import { PortalValidationError } from '../exceptions/portal-domain.exception';

export const PORTAL_LOCALES = ['ar', 'en'] as const;

export type PortalLocale = (typeof PORTAL_LOCALES)[number];

export function isPortalLocale(value: unknown): value is PortalLocale {
  return typeof value === 'string' && (PORTAL_LOCALES as readonly string[]).includes(value);
}

export interface NotificationChannels {
  readonly email: boolean;
  readonly sms: boolean;
  readonly push: boolean;
}

/**
 * Patient-controlled portal preferences: the language the portal renders in
 * (Arabic / English — bilingual platform requirement) and the notification
 * channels the patient consents to receive messages on.
 *
 * Immutable: every mutation returns a new instance, so an aggregate can never
 * be left with partially-updated preferences.
 */
export class PortalPreferencesVO {
  private readonly _locale: PortalLocale;
  private readonly _channels: NotificationChannels;

  constructor(locale: string, channels: NotificationChannels) {
    if (!isPortalLocale(locale)) {
      throw new PortalValidationError(`Unsupported portal locale: ${locale}`);
    }
    if (!channels || typeof channels !== 'object') {
      throw new PortalValidationError('Notification channels are required');
    }
    const { email, sms, push } = channels;
    if (typeof email !== 'boolean' || typeof sms !== 'boolean' || typeof push !== 'boolean') {
      throw new PortalValidationError('Each notification channel must be a boolean preference');
    }

    this._locale = locale;
    this._channels = Object.freeze({ email, sms, push });
  }

  static default(locale: PortalLocale = 'en'): PortalPreferencesVO {
    return new PortalPreferencesVO(locale, { email: true, sms: true, push: false });
  }

  get locale(): PortalLocale {
    return this._locale;
  }

  get channels(): NotificationChannels {
    return this._channels;
  }

  withLocale(locale: string): PortalPreferencesVO {
    return new PortalPreferencesVO(locale, this._channels);
  }

  withChannels(channels: NotificationChannels): PortalPreferencesVO {
    return new PortalPreferencesVO(this._locale, channels);
  }

  equals(other: PortalPreferencesVO): boolean {
    return (
      this._locale === other._locale &&
      this._channels.email === other._channels.email &&
      this._channels.sms === other._channels.sms &&
      this._channels.push === other._channels.push
    );
  }
}
