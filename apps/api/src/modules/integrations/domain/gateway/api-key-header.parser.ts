/**
 * Phase 44d — OD-AUTHN header parsing.
 * Distinguishes bk_/bki_ API keys from JWT Bearer tokens.
 */

import {
  CREDENTIAL_PREFIX_INTEGRATION,
  CREDENTIAL_PREFIX_USER,
} from '../credential-hashing';
import type { ParsedApiKeyCredential } from './gateway.types';

export function isApiKeyPrefixed(raw: string): boolean {
  const v = raw.trim();
  return (
    v.startsWith(CREDENTIAL_PREFIX_USER) ||
    v.startsWith(CREDENTIAL_PREFIX_INTEGRATION)
  );
}

export function lookslikeJwt(raw: string): boolean {
  // Compact JWT: three base64url segments separated by dots.
  const parts = raw.trim().split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

/**
 * Extract API key from Authorization Bearer or X-Api-Key.
 * Returns null when no API-key shaped credential is present (JWT may still apply).
 * Throws structured code strings for explicit API-key auth failures.
 */
export function parseApiKeyFromHeaders(input: {
  authorization?: string | string[] | null;
  apiKey?: string | string[] | null;
}):
  | { kind: 'none' }
  | { kind: 'parsed'; credential: ParsedApiKeyCredential }
  | { kind: 'reject'; reason: 'jwt_not_api_key' | 'invalid_prefix' | 'missing_credential' } {
  const xRaw = firstHeader(input.apiKey)?.trim() ?? '';
  if (xRaw.length > 0) {
    if (!isApiKeyPrefixed(xRaw)) {
      return { kind: 'reject', reason: 'invalid_prefix' };
    }
    return {
      kind: 'parsed',
      credential: {
        raw: xRaw,
        source: 'x_api_key',
        prefixKind: xRaw.startsWith(CREDENTIAL_PREFIX_INTEGRATION)
          ? 'bki_'
          : 'bk_',
      },
    };
  }

  const auth = firstHeader(input.authorization)?.trim() ?? '';
  if (!auth) {
    return { kind: 'none' };
  }

  const bearerMatch = /^Bearer\s+(.+)$/i.exec(auth);
  if (!bearerMatch) {
    return { kind: 'none' };
  }

  const token = bearerMatch[1]!.trim();
  if (!token) {
    return { kind: 'reject', reason: 'missing_credential' };
  }

  if (isApiKeyPrefixed(token)) {
    return {
      kind: 'parsed',
      credential: {
        raw: token,
        source: 'bearer',
        prefixKind: token.startsWith(CREDENTIAL_PREFIX_INTEGRATION)
          ? 'bki_'
          : 'bk_',
      },
    };
  }

  // JWT or other Bearer — not an Integrations API key; leave to JwtAuthGuard.
  if (lookslikeJwt(token) || !isApiKeyPrefixed(token)) {
    return { kind: 'none' };
  }

  return { kind: 'reject', reason: 'invalid_prefix' };
}

function firstHeader(
  value: string | string[] | null | undefined,
): string | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}
