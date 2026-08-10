/**
 * Phase 44d — Usage accounting (no secrets / no PHI).
 */

export type GatewayUsageOutcome =
  | 'success'
  | 'auth_failure'
  | 'authorization_failure'
  | 'quota_failure'
  | 'denied';

export interface GatewayUsageEvent {
  tenantId: string;
  credentialId: string | null;
  serviceAccountId: string | null;
  endpoint: string;
  operation: string;
  outcome: GatewayUsageOutcome;
  reason?: string;
  latencyMs?: number;
  correlationId?: string;
  at: string;
}

export interface GatewayUsageCounters {
  success: number;
  authFailure: number;
  authorizationFailure: number;
  quotaFailure: number;
  denied: number;
}

export interface GatewayUsageSnapshot {
  tenantId: string;
  totals: GatewayUsageCounters;
  byCredential: Record<string, GatewayUsageCounters>;
  byServiceAccount: Record<string, GatewayUsageCounters>;
  byEndpoint: Record<string, GatewayUsageCounters>;
  recent: readonly GatewayUsageEvent[];
}

function emptyCounters(): GatewayUsageCounters {
  return {
    success: 0,
    authFailure: 0,
    authorizationFailure: 0,
    quotaFailure: 0,
    denied: 0,
  };
}

function bump(
  counters: GatewayUsageCounters,
  outcome: GatewayUsageOutcome,
): void {
  switch (outcome) {
    case 'success':
      counters.success += 1;
      break;
    case 'auth_failure':
      counters.authFailure += 1;
      break;
    case 'authorization_failure':
      counters.authorizationFailure += 1;
      break;
    case 'quota_failure':
      counters.quotaFailure += 1;
      break;
    default:
      counters.denied += 1;
  }
}

export class InMemoryUsageAccountingStore {
  private readonly byTenant = new Map<
    string,
    {
      totals: GatewayUsageCounters;
      byCredential: Map<string, GatewayUsageCounters>;
      byServiceAccount: Map<string, GatewayUsageCounters>;
      byEndpoint: Map<string, GatewayUsageCounters>;
      recent: GatewayUsageEvent[];
    }
  >();

  private readonly maxRecent = 200;

  record(event: GatewayUsageEvent): void {
    let bucket = this.byTenant.get(event.tenantId);
    if (!bucket) {
      bucket = {
        totals: emptyCounters(),
        byCredential: new Map(),
        byServiceAccount: new Map(),
        byEndpoint: new Map(),
        recent: [],
      };
      this.byTenant.set(event.tenantId, bucket);
    }
    bump(bucket.totals, event.outcome);
    if (event.credentialId) {
      const c =
        bucket.byCredential.get(event.credentialId) ?? emptyCounters();
      bump(c, event.outcome);
      bucket.byCredential.set(event.credentialId, c);
    }
    if (event.serviceAccountId) {
      const s =
        bucket.byServiceAccount.get(event.serviceAccountId) ?? emptyCounters();
      bump(s, event.outcome);
      bucket.byServiceAccount.set(event.serviceAccountId, s);
    }
    const e = bucket.byEndpoint.get(event.endpoint) ?? emptyCounters();
    bump(e, event.outcome);
    bucket.byEndpoint.set(event.endpoint, e);
    bucket.recent.unshift(event);
    if (bucket.recent.length > this.maxRecent) {
      bucket.recent.length = this.maxRecent;
    }
  }

  snapshot(tenantId: string): GatewayUsageSnapshot {
    const bucket = this.byTenant.get(tenantId);
    if (!bucket) {
      return {
        tenantId,
        totals: emptyCounters(),
        byCredential: {},
        byServiceAccount: {},
        byEndpoint: {},
        recent: [],
      };
    }
    return {
      tenantId,
      totals: { ...bucket.totals },
      byCredential: Object.fromEntries(
        [...bucket.byCredential.entries()].map(([k, v]) => [k, { ...v }]),
      ),
      byServiceAccount: Object.fromEntries(
        [...bucket.byServiceAccount.entries()].map(([k, v]) => [k, { ...v }]),
      ),
      byEndpoint: Object.fromEntries(
        [...bucket.byEndpoint.entries()].map(([k, v]) => [k, { ...v }]),
      ),
      recent: [...bucket.recent],
    };
  }

  clear(tenantId?: string): void {
    if (tenantId) this.byTenant.delete(tenantId);
    else this.byTenant.clear();
  }
}
