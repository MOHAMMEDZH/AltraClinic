/**
 * Phase 44d — Quota policy value objects (OD-REDIS: in-process until Redis).
 */

export type QuotaScopeKind =
  | 'tenant'
  | 'credential'
  | 'service_account'
  | 'endpoint'
  | 'operation';

export interface RateLimitWindow {
  limit: number;
  windowSeconds: number;
}

export interface QuotaPolicyDefinition {
  id: string;
  tenantId: string | null;
  name: string;
  scopeKind: QuotaScopeKind;
  /** Sliding-window request limit. */
  window: RateLimitWindow;
  /** Burst tokens (token-bucket) allowed above sustained rate. */
  burstLimit: number;
  enabled: boolean;
}

export interface QuotaEvaluationInput {
  tenantId: string;
  credentialId: string;
  serviceAccountId: string | null;
  endpoint: string;
  operation: string;
  nowMs?: number;
}

export interface QuotaEvaluationResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAtMs: number;
  violatedScope: QuotaScopeKind | null;
  retryAfterSeconds: number | null;
}

export interface QuotaConsumeResult extends QuotaEvaluationResult {
  consumed: boolean;
}

/** Default single-node policies (documented; OD-REDIS deferred). */
export const DEFAULT_CREDENTIAL_WINDOW: RateLimitWindow = {
  limit: 1_000,
  windowSeconds: 3_600,
};

export const DEFAULT_TENANT_WINDOW: RateLimitWindow = {
  limit: 10_000,
  windowSeconds: 3_600,
};

export const DEFAULT_SERVICE_ACCOUNT_WINDOW: RateLimitWindow = {
  limit: 5_000,
  windowSeconds: 3_600,
};

export const DEFAULT_ENDPOINT_WINDOW: RateLimitWindow = {
  limit: 600,
  windowSeconds: 60,
};

export const DEFAULT_BURST_LIMIT = 50;
