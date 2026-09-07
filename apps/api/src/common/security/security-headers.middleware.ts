import { Request, Response, NextFunction } from 'express';

/**
 * Baseline security headers for the Nest HTTP API JSON surface.
 * Super Admin browser CSP remains owned by apps/super-admin vite headers.
 * HSTS is opt-in via ENABLE_HSTS=true when TLS termination ownership is clear.
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // API responses are not HTML documents; deny framing and default resource loads.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  const path = (req.path ?? req.url ?? '').split('?')[0];
  if (path.startsWith('/platform/') || path.startsWith('/auth')) {
    res.setHeader('Cache-Control', 'private, no-store');
  }

  if (process.env.ENABLE_HSTS === 'true') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}
