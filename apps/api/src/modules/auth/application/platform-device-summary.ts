/**
 * Privacy-minimized device summary for platform session APIs.
 * Raw user-agent may remain stored for investigation; it must not be returned
 * on ordinary self-service session list responses.
 */

export type DeviceCategory = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';

export interface DeviceSummary {
  summary: string;
  category: DeviceCategory;
}

export function summarizeUserAgent(userAgent: string | null | undefined): DeviceSummary {
  const ua = (userAgent ?? '').trim();
  if (!ua) {
    return { summary: 'Unknown browser', category: 'unknown' };
  }
  const lower = ua.toLowerCase();

  if (
    lower.includes('bot') ||
    lower.includes('crawler') ||
    lower.includes('spider') ||
    lower.includes('curl/') ||
    lower.includes('wget') ||
    lower.includes('postman')
  ) {
    return { summary: 'Automated client', category: 'bot' };
  }

  const os =
    lower.includes('android')
      ? 'Android'
      : lower.includes('iphone') || lower.includes('ipad') || lower.includes('ios')
        ? lower.includes('ipad')
          ? 'iPadOS'
          : 'iOS'
        : lower.includes('mac os') || lower.includes('macintosh')
          ? 'macOS'
          : lower.includes('windows')
            ? 'Windows'
            : lower.includes('linux')
              ? 'Linux'
              : 'Unknown OS';

  const browser =
    lower.includes('edg/') || lower.includes('edgios') || lower.includes('edga/')
      ? 'Edge'
      : lower.includes('chrome') && !lower.includes('edg')
        ? 'Chrome'
        : lower.includes('firefox') || lower.includes('fxios')
          ? 'Firefox'
          : lower.includes('safari') && !lower.includes('chrome')
            ? lower.includes('mobile') || lower.includes('iphone') || lower.includes('ipad')
              ? 'Mobile Safari'
              : 'Safari'
            : 'Unknown browser';

  const category: DeviceCategory =
    lower.includes('ipad') || (lower.includes('android') && lower.includes('tablet'))
      ? 'tablet'
      : lower.includes('mobile') ||
          lower.includes('iphone') ||
          lower.includes('android')
        ? 'mobile'
        : 'desktop';

  if (browser === 'Unknown browser' && os === 'Unknown OS') {
    return { summary: 'Unknown browser', category: 'unknown' };
  }
  if (browser === 'Unknown browser') {
    return { summary: `Browser on ${os}`, category };
  }
  if (os === 'Unknown OS') {
    return { summary: browser, category };
  }
  return { summary: `${browser} on ${os}`, category };
}
