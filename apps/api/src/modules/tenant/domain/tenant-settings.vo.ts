const LOCALE_REGEX = /^[a-z]{2}-[A-Z]{2}$/;

export class TenantSettingsVO {
  constructor(
    public readonly timezone: string = 'UTC',
    public readonly locale: string = 'en-US',
    public readonly dataRetentionDays: number = 365,
    public readonly features: Record<string, boolean> = {}
  ) {
    if (!timezone) throw new Error('Invalid timezone');
    if (!LOCALE_REGEX.test(locale)) throw new Error('Invalid locale');
    if (dataRetentionDays <= 0) throw new Error('dataRetentionDays must be positive');
  }
}
