/**
 * Step 15 audit metadata allowlist — serialized details must stay bounded.
 * Free-form notes, translations, raw effect arrays, tokens, and request bodies are stripped.
 */
export const ADDON_AUDIT_DETAILS_ALLOWLIST = new Set([
  'result',
  'canonicalKey',
  'lifecycle',
  'lifecycleBefore',
  'lifecycleAfter',
  'expectedVersion',
  'resultingVersion',
  'rowVersion',
  'reasonCode',
  'count',
  'effectCount',
  'entitlementCount',
  'limitEffectCount',
  'applicabilityCount',
  'effectType',
  'fingerprint',
  'fingerprintSchemaVersion',
  'sourceVersionClassification',
  'predecessorClassification',
  'successorClassification',
  'creatorApproverSeparated',
  'expiryCategory',
  'addOnId',
  'versionId',
  'overrideId',
  'runtimeChanged',
  'publicationReady',
  'approvalCorrelationId',
]);

const PROHIBITED_SUBSTRINGS = [
  'translation',
  'displayName',
  'shortDescription',
  'releaseLabel',
  'reasonNote',
  'idempotency',
  'accessToken',
  'refreshToken',
  'stepUp',
  'sessionId',
  'mfa',
  'password',
  'bearer',
  'authorization',
  'catalogItemIds',
  'planCanonicalKeys',
  'effects',
  'grants',
  'applicability',
  'requestBody',
  'licensing',
  'cacheKey',
  'stack',
  'prisma',
  'sql',
];

export function redactAddonAuditDetails(
  details: Record<string, string> | null | undefined,
): Record<string, string> | null {
  if (!details) return null;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(details)) {
    if (!ADDON_AUDIT_DETAILS_ALLOWLIST.has(key)) continue;
    if (typeof value !== 'string') continue;
    const lowerKey = key.toLowerCase();
    if (PROHIBITED_SUBSTRINGS.some((p) => lowerKey.includes(p.toLowerCase()))) continue;
    // Bound scalar strings only
    out[key] = value.slice(0, 256);
  }
  return Object.keys(out).length ? out : null;
}

export function assertAddonAuditSerializedClean(serialized: string): void {
  const lower = serialized.toLowerCase();
  for (const p of [
    'translations',
    'displayname',
    'shortdescription',
    'releaselabel',
    'reasonnote',
    'idempotency-key',
    'accesstoken',
    'refreshtoken',
    'bear er',
    'bearer ',
    'password',
    'catalogitemids',
    'plancanonicalkeys',
    '"effects"',
    'requestbody',
    'stack',
    'select ',
    'phi',
  ]) {
    if (p === 'bear er') continue;
    if (lower.includes(p)) {
      throw new Error(`Prohibited audit content detected: ${p}`);
    }
  }
}
