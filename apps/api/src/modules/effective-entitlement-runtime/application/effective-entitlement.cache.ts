import {
  EFFECTIVE_ENTITLEMENT_RESOLVER_SCHEMA,
  type EffectiveEntitlementBundle,
} from '../domain/effective-entitlement.types';

type CacheEntry = {
  expiresAt: number;
  bundle: EffectiveEntitlementBundle;
  /** Authoritative identity captured at write time — must match re-read identity. */
  identity: RuntimeCacheIdentity;
};

/** Lightweight identity re-read from PostgreSQL before any cache reuse (Option B). */
export type RuntimeCacheIdentity = {
  tenantId: string;
  provenance: string;
  source: 'SNAPSHOT' | 'LEGACY';
  lifecycle: string;
  snapshotId: string;
  fingerprint: string;
};

export function buildEffectiveEntitlementCacheKey(parts: {
  tenantId: string;
  provenance: string;
  source: 'SNAPSHOT' | 'LEGACY';
  snapshotId?: string;
  fingerprint?: string;
  lifecycle?: string;
}): string {
  return [
    EFFECTIVE_ENTITLEMENT_RESOLVER_SCHEMA,
    parts.tenantId,
    parts.provenance,
    parts.source,
    parts.lifecycle ?? 'none',
    parts.snapshotId ?? 'none',
    parts.fingerprint ?? 'none',
  ].join('|');
}

export function identityFromProbe(parts: {
  tenantId: string;
  provenance: string;
  source: 'SNAPSHOT' | 'LEGACY';
  lifecycle?: string;
  snapshotId?: string;
  fingerprint?: string;
}): RuntimeCacheIdentity {
  return {
    tenantId: parts.tenantId,
    provenance: parts.provenance,
    source: parts.source,
    lifecycle: parts.lifecycle ?? 'none',
    snapshotId: parts.snapshotId ?? 'none',
    fingerprint: parts.fingerprint ?? 'none',
  };
}

export function identitiesEqual(a: RuntimeCacheIdentity, b: RuntimeCacheIdentity): boolean {
  return (
    a.tenantId === b.tenantId &&
    a.provenance === b.provenance &&
    a.source === b.source &&
    a.lifecycle === b.lifecycle &&
    a.snapshotId === b.snapshotId &&
    a.fingerprint === b.fingerprint
  );
}

/**
 * Option B — Safe process-local cache.
 * Optimization only: every resolve re-reads authoritative identity from PostgreSQL
 * before looking up the cache. Lifecycle/provenance/snapshot identity is never taken
 * solely from local cache. Multi-instance: old keys become unreachable when identity
 * changes; no cross-instance invalidation bus required for authorization safety.
 */
export class EffectiveEntitlementCache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<EffectiveEntitlementBundle>>();
  private readonly positiveTtlMs: number;
  private readonly negativeTtlMs: number;
  private readonly enabled: boolean;

  constructor(opts?: { positiveTtlMs?: number; negativeTtlMs?: number; enabled?: boolean }) {
    this.positiveTtlMs = opts?.positiveTtlMs ?? 60_000;
    this.negativeTtlMs = opts?.negativeTtlMs ?? 30_000;
    this.enabled =
      opts?.enabled ??
      !['0', 'false', 'off', 'no'].includes(
        (process.env.EFFECTIVE_ENTITLEMENT_CACHE_ENABLED ?? 'true').trim().toLowerCase(),
      );
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  get(key: string, expectedIdentity: RuntimeCacheIdentity): EffectiveEntitlementBundle | null {
    if (!this.enabled) return null;
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    if (hit.bundle.resolverSchema !== EFFECTIVE_ENTITLEMENT_RESOLVER_SCHEMA) {
      this.store.delete(key);
      return null;
    }
    if (!identitiesEqual(hit.identity, expectedIdentity)) {
      this.store.delete(key);
      return null;
    }
    if (
      hit.bundle.fingerprint &&
      expectedIdentity.fingerprint !== 'none' &&
      hit.bundle.fingerprint !== expectedIdentity.fingerprint
    ) {
      this.store.delete(key);
      return null;
    }
    return hit.bundle;
  }

  set(key: string, bundle: EffectiveEntitlementBundle, identity: RuntimeCacheIdentity): void {
    if (!this.enabled) return;
    const deny =
      bundle.code.startsWith('runtime_') ||
      bundle.code.includes('malformed') ||
      bundle.code.includes('mismatch') ||
      bundle.code.includes('ambiguous') ||
      bundle.code.includes('denied') ||
      bundle.code.includes('terminal') ||
      bundle.code.includes('pending');
    const ttl = deny ? this.negativeTtlMs : this.positiveTtlMs;
    this.store.set(key, { bundle, identity, expiresAt: Date.now() + ttl });
  }

  invalidateTenant(tenantId: string): void {
    for (const key of [...this.store.keys()]) {
      if (key.includes(`|${tenantId}|`)) this.store.delete(key);
    }
  }

  async singleFlight(
    key: string,
    identity: RuntimeCacheIdentity,
    factory: () => Promise<EffectiveEntitlementBundle>,
  ): Promise<EffectiveEntitlementBundle> {
    const cached = this.get(key, identity);
    if (cached) return cached;
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const pending = factory()
      .then((bundle) => {
        this.set(key, bundle, identity);
        return bundle;
      })
      .finally(() => {
        this.inflight.delete(key);
      });
    this.inflight.set(key, pending);
    return pending;
  }

  size(): number {
    return this.store.size;
  }
}
