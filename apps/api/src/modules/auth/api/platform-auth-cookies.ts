import { Response } from 'express';
import {
  PLATFORM_CSRF_COOKIE_NAME,
  PLATFORM_REFRESH_COOKIE_NAME,
} from '../platform-auth.tokens';

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(value);
  }
  return out;
}

export function getAllowedSuperAdminOrigins(): string[] {
  const fromDedicated = (process.env['SUPER_ADMIN_CORS_ORIGINS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromDedicated.length) return fromDedicated;

  const fromCors = (process.env['CORS_ORIGINS'] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const defaults = [
    'http://127.0.0.1:5176',
    'http://localhost:5176',
    'http://127.0.0.1:4176',
    'http://localhost:4176',
  ];

  return [...new Set([...fromCors, ...defaults])];
}

export function isAllowedPlatformOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  return getAllowedSuperAdminOrigins().includes(origin);
}

/**
 * CSRF for cookie-authenticated platform refresh/logout:
 * require Origin (or Referer host) in the exact allowlist.
 */
export function assertPlatformCookieCsrf(input: {
  origin?: string;
  referer?: string;
  method: string;
}): void {
  if (input.method === 'GET' || input.method === 'HEAD' || input.method === 'OPTIONS') {
    return;
  }
  const origin = input.origin?.trim();
  if (origin && isAllowedPlatformOrigin(origin)) return;

  if (input.referer) {
    try {
      const refOrigin = new URL(input.referer).origin;
      if (isAllowedPlatformOrigin(refOrigin)) return;
    } catch {
      /* ignore */
    }
  }

  const err = new Error('CSRF validation failed for platform authentication cookie request.');
  (err as Error & { statusCode?: number }).statusCode = 403;
  throw err;
}

export function setPlatformRefreshCookie(
  res: Response,
  refreshToken: string,
  maxAgeSeconds: number,
): void {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${PLATFORM_REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}`,
    'Path=/platform/auth',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.max(1, maxAgeSeconds)}`,
  ];
  if (isProd) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

export function clearPlatformRefreshCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${PLATFORM_REFRESH_COOKIE_NAME}=`,
    'Path=/platform/auth',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ];
  if (isProd) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

export function setPlatformCsrfCookie(res: Response, csrfToken: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${PLATFORM_CSRF_COOKIE_NAME}=${encodeURIComponent(csrfToken)}`,
    'Path=/platform/auth',
    'SameSite=Strict',
    'Max-Age=604800',
  ];
  if (isProd) parts.push('Secure');
  // Readable by JS so the SPA can echo it in X-Platform-CSRF (double-submit).
  res.append('Set-Cookie', parts.join('; '));
}

export function clearPlatformCsrfCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === 'production';
  const parts = [
    `${PLATFORM_CSRF_COOKIE_NAME}=`,
    'Path=/platform/auth',
    'SameSite=Strict',
    'Max-Age=0',
  ];
  if (isProd) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}
