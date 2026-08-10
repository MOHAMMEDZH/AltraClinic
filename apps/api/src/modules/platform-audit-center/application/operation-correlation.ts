/**
 * Step 21 — request/operation correlation (not actor, token jti, or idempotency).
 */
import { randomUUID } from 'crypto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let contextGetter: (() => string | undefined) | null = null;

/** Wired by CorrelationContextService so HTTP ALS is visible without Nest DI in every domain service. */
export function registerOperationCorrelationContextGetter(
  getter: (() => string | undefined) | null,
): void {
  contextGetter = getter;
}

export function isOperationCorrelationId(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

/**
 * Resolve the durable operation correlation ID.
 * Precedence: explicit → ALS/request context (registered getter) → fromContext opt → server UUID.
 * Never uses actor.jti, session ID, tenant ID, or raw idempotency keys.
 */
export function resolveOperationCorrelationId(opts?: {
  explicit?: string | null;
  fromContext?: string | null;
}): string {
  const candidates = [
    opts?.explicit,
    opts?.fromContext,
    contextGetter?.(),
  ];
  for (const c of candidates) {
    if (isOperationCorrelationId(c)) return c.trim();
  }
  return randomUUID();
}
