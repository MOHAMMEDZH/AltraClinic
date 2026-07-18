/**
 * SSRF guard for the webhook delivery adapter. Fail-closed: anything that cannot be proven
 * safe is rejected. Pure functions only — no I/O — so they stay trivially unit-testable.
 */

export class UnsafeWebhookUrlError extends Error {
  constructor(reason: string) {
    super(`Unsafe webhook URL: ${reason}`);
    this.name = 'UnsafeWebhookUrlError';
  }
}

const PRIVATE_IPV4_RANGES: Array<[number, number]> = [
  [ipv4ToLong('0.0.0.0'), ipv4ToLong('0.255.255.255')],
  [ipv4ToLong('10.0.0.0'), ipv4ToLong('10.255.255.255')],
  [ipv4ToLong('100.64.0.0'), ipv4ToLong('100.127.255.255')], // shared address space (CGNAT)
  [ipv4ToLong('127.0.0.0'), ipv4ToLong('127.255.255.255')], // loopback
  [ipv4ToLong('169.254.0.0'), ipv4ToLong('169.254.255.255')], // link-local (incl. cloud metadata 169.254.169.254)
  [ipv4ToLong('172.16.0.0'), ipv4ToLong('172.31.255.255')],
  [ipv4ToLong('192.0.0.0'), ipv4ToLong('192.0.0.255')],
  [ipv4ToLong('192.168.0.0'), ipv4ToLong('192.168.255.255')],
  [ipv4ToLong('198.18.0.0'), ipv4ToLong('198.19.255.255')], // benchmarking
  [ipv4ToLong('224.0.0.0'), ipv4ToLong('255.255.255.255')], // multicast/reserved
];

function ipv4ToLong(ip: string): number {
  const parts = ip.split('.').map((p) => Number(p));
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isValidIpv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

export function isPrivateOrReservedIpv4(host: string): boolean {
  if (!isValidIpv4(host)) return false;
  const value = ipv4ToLong(host);
  return PRIVATE_IPV4_RANGES.some(([start, end]) => value >= start && value <= end);
}

/** Best-effort IPv6 private/loopback/link-local/ULA detection (string-form checks only). */
export function isPrivateOrReservedIpv6(host: string): boolean {
  const normalized = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (isValidIpv4(mapped)) return isPrivateOrReservedIpv4(mapped);
  }
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local (fc00::/7)
  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
]);

export interface UrlSafetyResult {
  safe: boolean;
  reason: string;
  hostname: string | null;
}

/**
 * Validates a webhook target URL is HTTPS and does not resolve (by literal hostname/IP form)
 * to a private, loopback, link-local, or cloud-metadata address. This is a defense-in-depth
 * literal check; DNS-rebinding protection at connect time is the transport layer's job, but we
 * still fail closed here on anything suspicious.
 */
export function assertSafeWebhookUrl(rawUrl: string): URL {
  const result = evaluateWebhookUrlSafety(rawUrl);
  if (!result.safe) {
    throw new UnsafeWebhookUrlError(result.reason);
  }
  return new URL(rawUrl);
}

export function evaluateWebhookUrlSafety(rawUrl: string): UrlSafetyResult {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { safe: false, reason: 'URL is not parseable', hostname: null };
  }

  if (url.protocol !== 'https:') {
    return { safe: false, reason: `protocol "${url.protocol}" is not allowed; HTTPS only`, hostname: url.hostname };
  }

  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { safe: false, reason: `hostname "${hostname}" is blocked`, hostname };
  }

  if (hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { safe: false, reason: `hostname "${hostname}" is a reserved internal TLD`, hostname };
  }

  if (isValidIpv4(hostname) && isPrivateOrReservedIpv4(hostname)) {
    return { safe: false, reason: `IP "${hostname}" is a private/reserved address`, hostname };
  }

  if (hostname.includes(':') && isPrivateOrReservedIpv6(hostname)) {
    return { safe: false, reason: `IP "${hostname}" is a private/reserved IPv6 address`, hostname };
  }

  if (hostname === '0' || hostname === '0x0' || /^0+$/.test(hostname)) {
    return { safe: false, reason: 'hostname resolves to 0.0.0.0', hostname };
  }

  return { safe: true, reason: 'ok', hostname };
}
