/**
 * Phase 45c — Correlation context model (OD-CORRELATION).
 * IDs are observational only — never grant privilege.
 */

export interface CorrelationContext {
  correlationId: string;
  causationId?: string;
  tenantId?: string | null;
  branchId?: string | null;
  module?: string;
  operation?: string;
  source?: 'http' | 'queue' | 'job' | 'internal' | 'system';
  /** True when inbound header was accepted; false when generated at ingress. */
  inherited: boolean;
}

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const CAUSATION_ID_HEADER = 'x-causation-id';

/** UUID v4 or opaque safe token 8–128 chars. */
export const CORRELATION_ID_PATTERN =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[A-Za-z0-9_-]{8,128})$/i;
