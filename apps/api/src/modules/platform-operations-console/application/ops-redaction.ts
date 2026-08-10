const FORBIDDEN_KEYS = [
  'token',
  'secret',
  'password',
  'credential',
  'connectionstring',
  'connection_string',
  'apikey',
  'api_key',
  'authorization',
  'bearer',
  'cookie',
  'session',
  'payload',
  'rawpayload',
  'headers',
  'stack',
  'prisma',
  'sql',
  'phi',
  'signedurl',
  'signed_url',
  'bucket',
  'objectkey',
  'object_key',
  'filepath',
  'file_path',
  'storagepath',
  'storage_path',
];

export function redactOpsDetails(
  details: Record<string, unknown> | null | undefined,
): Record<string, string> | null {
  if (!details) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(details)) {
    const lower = key.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (FORBIDDEN_KEYS.some((f) => lower.includes(f))) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'object') continue;
    const text = String(value);
    out[key] = text.length > 500 ? text.slice(0, 500) : text;
  }
  return Object.keys(out).length ? out : null;
}

export function assertNoForbiddenLeak(payload: unknown): void {
  const text = JSON.stringify(payload ?? {});
  if (
    /postgresql:\/\/|BEGIN RSA|Bearer\s+[A-Za-z0-9\-._~+/]+=*|sk_live|AKIA[0-9A-Z]{16}/i.test(
      text,
    )
  ) {
    throw new Error('ops_redaction_leak');
  }
}
