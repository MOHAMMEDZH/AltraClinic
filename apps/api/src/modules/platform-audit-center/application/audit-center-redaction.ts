const SECRET_MARKERS = [
  'password',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'session',
  'private_key',
  'privatekey',
  'connection_string',
  'credential',
  'mfa',
  'otp',
  'recovery',
];

const PHI_MARKERS = ['patient', 'mrn', 'ssn', 'national_id', 'diagnosis', 'clinical'];

export function summarizeUserAgent(ua: string | null | undefined): string | null {
  if (!ua?.trim()) return null;
  const v = ua.toLowerCase();
  const browser = v.includes('edg/')
    ? 'Edge'
    : v.includes('chrome')
      ? 'Chrome'
      : v.includes('firefox')
        ? 'Firefox'
        : v.includes('safari')
          ? 'Safari'
          : 'Browser';
  const os = v.includes('windows')
    ? 'Windows'
    : v.includes('mac os')
      ? 'macOS'
      : v.includes('android')
        ? 'Android'
        : v.includes('iphone') || v.includes('ipad')
          ? 'iOS'
          : v.includes('linux')
            ? 'Linux'
            : 'OS';
  return `${browser} on ${os}`;
}

export function maskIp(ip: string | null | undefined): string | null {
  if (!ip?.trim()) return null;
  if (ip.includes(':')) return '****:****';
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  return '***.***.***';
}

export function redactJson(
  value: unknown,
  opts: { allowSensitive: boolean } = { allowSensitive: false },
): unknown {
  if (value == null) return null;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (SECRET_MARKERS.some((m) => lower.includes(m)) || PHI_MARKERS.some((m) => lower.includes(m))) {
      return '[redacted]';
    }
    if (value.length > 2000) return `${value.slice(0, 2000)}…`;
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redactJson(v, opts));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lk = k.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (SECRET_MARKERS.some((m) => lk.includes(m)) || PHI_MARKERS.some((m) => lk.includes(m))) {
        out['[redacted]'] = '[redacted]';
        continue;
      }
      if (!opts.allowSensitive && (lk.includes('snapshot') || lk.includes('raw'))) {
        out[k] = '[redacted]';
        continue;
      }
      out[k] = redactJson(v, opts);
    }
    return out;
  }
  return value;
}

/** CSV formula-injection neutralization. */
export function csvSafeCell(value: unknown): string {
  let s = value == null ? '' : String(value);
  s = s.replace(/\r?\n/g, ' ').replace(/"/g, '""');
  if (/^[=+\-@|]/.test(s)) {
    s = `'${s}`;
  }
  return `"${s}"`;
}
