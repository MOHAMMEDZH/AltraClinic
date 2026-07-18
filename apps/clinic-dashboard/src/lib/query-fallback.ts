import { shouldUseDemoFallback } from './demo-fallback';

/** Prefer cached data, then gated demo fallback, otherwise rethrow. */
export function resolveOfflineQueryFallback<T>(
  err: unknown,
  online: boolean,
  createDemo: () => T,
  cached?: T | null,
): T {
  if (cached != null) return cached;
  if (shouldUseDemoFallback(err, online)) return createDemo();
  throw err;
}
