/**
 * Throttled interactive activity signaling for Super Admin sessions.
 *
 * Sends POST /platform/auth/activity only after real pointer/keyboard/touch
 * interaction. Does not treat bootstrap, refresh, or polling as activity.
 * Sends no keystrokes, coordinates, page content, or PHI.
 */

const DEFAULT_THROTTLE_MS = 60_000;

export interface PlatformActivitySignalOptions {
  /** Returns the in-memory access token, or null when logged out. */
  getAccessToken: () => string | null;
  /** Whether the user is fully authenticated (not loading / MFA pending). */
  isAuthenticated: () => boolean;
  /** Posts the activity signal; failures must not invent local session extension. */
  recordActivity: (accessToken: string) => Promise<unknown>;
  /** Client-side throttle between network signals (server also throttles). */
  throttleMs?: number;
  /** Optional clock for tests. */
  now?: () => number;
  /** Optional event target (defaults to window). */
  target?: EventTarget | null;
}

/**
 * Starts listening for meaningful interaction. Returns a cleanup function.
 */
export function startPlatformActivitySignal(
  options: PlatformActivitySignalOptions,
): () => void {
  const throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS;
  const now = options.now ?? (() => Date.now());
  const target =
    options.target ?? (typeof window !== 'undefined' ? window : null);

  if (!target) {
    return () => undefined;
  }

  let lastSentAt = 0;
  let cleanedUp = false;

  const onInteraction = () => {
    if (cleanedUp) return;
    if (!options.isAuthenticated()) return;
    const token = options.getAccessToken();
    if (!token) return;

    const t = now();
    if (t - lastSentAt < throttleMs) return;

    lastSentAt = t;
    void options.recordActivity(token).catch(() => {
      /* Network failure must not extend the session locally. */
    });
  };

  const events = ['pointerdown', 'keydown', 'touchstart'] as const;
  for (const event of events) {
    target.addEventListener(event, onInteraction, { passive: true });
  }

  return () => {
    cleanedUp = true;
    for (const event of events) {
      target.removeEventListener(event, onInteraction);
    }
  };
}

export const PLATFORM_ACTIVITY_CLIENT_THROTTLE_MS = DEFAULT_THROTTLE_MS;
