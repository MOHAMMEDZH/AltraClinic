/**
 * Demo data may only appear when explicitly enabled (VITE_ENABLE_DEMO_FALLBACK=true)
 * and the client is offline. Production builds must never silently show fabricated data.
 */

export function isDemoFallbackEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_DEMO_FALLBACK === 'true';
}

export function getHttpErrorStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

/** Returns true only when demo fallback is enabled, offline, and error is not auth/not-found. */
export function shouldUseDemoFallback(err: unknown, online: boolean): boolean {
  if (!isDemoFallbackEnabled()) return false;
  if (online) return false;
  const status = getHttpErrorStatus(err);
  if (status === 401 || status === 403 || status === 404) return false;
  return true;
}

export async function fetchWithDemoFallback<T>(
  fetchFn: () => Promise<T>,
  createDemo: () => T,
  online: boolean,
): Promise<T> {
  try {
    return await fetchFn();
  } catch (err) {
    if (shouldUseDemoFallback(err, online)) {
      return createDemo();
    }
    throw err;
  }
}

export function canShowDemoOverview(online: boolean, isError: boolean, hasData: boolean): boolean {
  if (!isDemoFallbackEnabled()) return false;
  return !online || (isError && !hasData);
}
