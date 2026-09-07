/**
 * Shared HTTP/WebSocket CORS origin allowlists.
 * Credentials MUST never pair with wildcard `*`.
 */

export function parseOriginList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getAllowedSuperAdminOrigins(): string[] {
  const fromDedicated = parseOriginList(process.env.SUPER_ADMIN_CORS_ORIGINS);
  if (fromDedicated.length) return fromDedicated;

  const fromCors = parseOriginList(process.env.CORS_ORIGINS);
  const defaults = [
    'http://127.0.0.1:5176',
    'http://localhost:5176',
    'http://127.0.0.1:4176',
    'http://localhost:4176',
  ];

  return [...new Set([...fromCors, ...defaults])];
}

/**
 * Browser CORS allowlist for the Nest HTTP API (clinic + Super Admin origins).
 */
export function getAllowedHttpCorsOrigins(): string[] {
  const base = parseOriginList(process.env.CORS_ORIGINS ?? 'http://localhost:5173');
  const merged = [...new Set([...base, ...getAllowedSuperAdminOrigins()])];
  if (merged.includes('*')) {
    throw new Error('CORS_ORIGINS must not include wildcard (*) when credentials are enabled.');
  }
  return merged;
}

export function isAllowedPlatformOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return getAllowedSuperAdminOrigins().includes(origin);
}

/**
 * Socket.IO /realtime CORS origin decision — allowlist only (G-CORS-01).
 * Missing Origin is allowed for non-browser clients; JWT still required at connect.
 */
export function isAllowedRealtimeCorsOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  return getAllowedHttpCorsOrigins().includes(origin);
}

export function realtimeCorsOriginOption(): (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) => void {
  return (origin, callback) => {
    try {
      callback(null, isAllowedRealtimeCorsOrigin(origin));
    } catch (err) {
      callback(err instanceof Error ? err : new Error('CORS origin evaluation failed'), false);
    }
  };
}
