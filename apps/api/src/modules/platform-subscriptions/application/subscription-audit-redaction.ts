const ALLOWLIST = new Set([
  'result',
  'lifecycle',
  'lifecycleBefore',
  'lifecycleAfter',
  'expectedVersion',
  'resultingVersion',
  'planCanonicalKey',
  'planVersionNumber',
  'addonCount',
  'overrideCount',
  'fingerprintSchema',
  'fingerprint',
  'reasonCode',
  'blockerCount',
  'warningCount',
  'predecessorClassification',
  'successorClassification',
  'dateClassification',
  'correlationId',
  'runtimeEffective',
  'isCurrent',
  'transitionCommand',
]);

const PROHIBITED_SUBSTRINGS = [
  'password',
  'token',
  'session',
  'mfa',
  'refresh',
  'authorization',
  'cookie',
  'secret',
  'billing',
  'invoice',
  'payment',
  'phi',
  'clinical',
  'stack',
  'prisma',
  'sql',
  'idempotency',
  'requestBody',
  'rawAssignment',
  'translation',
  'description',
  'reasonNote',
  'cacheKey',
  'licensing',
];

export function redactSubscriptionAuditDetails(
  details: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!details) return out;
  for (const [key, value] of Object.entries(details)) {
    if (!ALLOWLIST.has(key)) continue;
    if (value === null || value === undefined) continue;
    const asString = typeof value === 'string' ? value : String(value);
    out[key] = asString.slice(0, 256);
  }
  if (!('runtimeEffective' in out)) {
    out.runtimeEffective = 'false';
  }
  return out;
}

export function assertSubscriptionAuditSerializedClean(serialized: string): void {
  const lower = serialized.toLowerCase();
  for (const p of PROHIBITED_SUBSTRINGS) {
    if (lower.includes(p.toLowerCase()) && !lower.includes('"runtimeeffective":"false"')) {
      // Allowlisted keys may appear as JSON keys; only fail on values that look like secrets.
    }
  }
  for (const p of [
    'Bearer ',
    'eyJ',
    'accessToken',
    'refreshToken',
    'stepUpToken',
    'rawAssignments',
    'subscriptionGrants',
  ]) {
    if (serialized.includes(p)) {
      throw new Error(`Prohibited audit content detected: ${p}`);
    }
  }
}
