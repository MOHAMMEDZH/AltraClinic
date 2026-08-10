/**
 * Step 17 focused unit — cache single-flight + identity-before-reuse (no DB).
 */
import {
  EFFECTIVE_ENTITLEMENT_RESOLVER_SCHEMA,
  type EffectiveEntitlementBundle,
} from '../domain/effective-entitlement.types';
import {
  buildEffectiveEntitlementCacheKey,
  EffectiveEntitlementCache,
  identityFromProbe,
} from '../application/effective-entitlement.cache';

function bundle(
  partial: Partial<EffectiveEntitlementBundle> & Pick<EffectiveEntitlementBundle, 'tenantId' | 'code'>,
): EffectiveEntitlementBundle {
  return {
    source: 'SNAPSHOT',
    modules: [],
    features: [],
    specialties: [],
    limits: {},
    evaluatedAt: new Date().toISOString(),
    resolverSchema: EFFECTIVE_ENTITLEMENT_RESOLVER_SCHEMA,
    ...partial,
  };
}

describe('EffectiveEntitlementCache (unit) — Option B identity-safe', () => {
  it('formats keys as schema|tenant|provenance|source|lifecycle|snapshot|fingerprint', () => {
    expect(
      buildEffectiveEntitlementCacheKey({
        tenantId: 'tenant-a',
        provenance: 'AUTHORITATIVE_ACTIVE',
        source: 'SNAPSHOT',
        lifecycle: 'ACTIVE_COMMERCIAL',
        snapshotId: 'snap-1',
        fingerprint: 'fp-1',
      }),
    ).toBe(
      `${EFFECTIVE_ENTITLEMENT_RESOLVER_SCHEMA}|tenant-a|AUTHORITATIVE_ACTIVE|SNAPSHOT|ACTIVE_COMMERCIAL|snap-1|fp-1`,
    );

    expect(
      buildEffectiveEntitlementCacheKey({
        tenantId: 'tenant-a',
        provenance: 'NEVER_MANAGED',
        source: 'LEGACY',
      }),
    ).toBe(
      `${EFFECTIVE_ENTITLEMENT_RESOLVER_SCHEMA}|tenant-a|NEVER_MANAGED|LEGACY|none|none|none`,
    );
  });

  it('single-flights concurrent misses for the same key+identity', async () => {
    const cache = new EffectiveEntitlementCache({ positiveTtlMs: 60_000 });
    let factoryCalls = 0;
    const identity = identityFromProbe({
      tenantId: 't1',
      provenance: 'AUTHORITATIVE_ACTIVE',
      source: 'SNAPSHOT',
      lifecycle: 'ACTIVE_COMMERCIAL',
      snapshotId: 's1',
      fingerprint: 'f1',
    });
    const key = buildEffectiveEntitlementCacheKey(identity);
    const factory = async () => {
      factoryCalls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return bundle({ tenantId: 't1', code: 'snapshot_resolved', fingerprint: 'f1' });
    };
    const [a, b, c] = await Promise.all([
      cache.singleFlight(key, identity, factory),
      cache.singleFlight(key, identity, factory),
      cache.singleFlight(key, identity, factory),
    ]);
    expect(factoryCalls).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('rejects cache hit when authoritative identity changed (stale lifecycle)', () => {
    const cache = new EffectiveEntitlementCache({ positiveTtlMs: 60_000 });
    const activeId = identityFromProbe({
      tenantId: 't1',
      provenance: 'AUTHORITATIVE_ACTIVE',
      source: 'SNAPSHOT',
      lifecycle: 'ACTIVE_COMMERCIAL',
      snapshotId: 's1',
      fingerprint: 'f1',
    });
    const key = buildEffectiveEntitlementCacheKey(activeId);
    cache.set(key, bundle({ tenantId: 't1', code: 'snapshot_resolved', fingerprint: 'f1' }), activeId);
    expect(cache.get(key, activeId)?.code).toBe('snapshot_resolved');

    const suspendedId = identityFromProbe({
      tenantId: 't1',
      provenance: 'AUTHORITATIVE_SUSPENDED',
      source: 'SNAPSHOT',
      lifecycle: 'SUSPENDED',
      snapshotId: 's1',
      fingerprint: 'f1',
    });
    // Different provenance → different key; old key unreachable for new identity.
    const suspendedKey = buildEffectiveEntitlementCacheKey(suspendedId);
    expect(suspendedKey).not.toBe(key);
    expect(cache.get(suspendedKey, suspendedId)).toBeNull();
    // Lookup of old key with new identity rejects and clears.
    expect(cache.get(key, suspendedId)).toBeNull();
  });

  it('isolates tenants', () => {
    const cache = new EffectiveEntitlementCache({ positiveTtlMs: 60_000 });
    const i1 = identityFromProbe({
      tenantId: 't1',
      provenance: 'AUTHORITATIVE_ACTIVE',
      source: 'SNAPSHOT',
      snapshotId: 's1',
      fingerprint: 'f1',
    });
    const i2 = identityFromProbe({
      tenantId: 't2',
      provenance: 'AUTHORITATIVE_ACTIVE',
      source: 'SNAPSHOT',
      snapshotId: 's1',
      fingerprint: 'f1',
    });
    const k1 = buildEffectiveEntitlementCacheKey(i1);
    const k2 = buildEffectiveEntitlementCacheKey(i2);
    cache.set(k1, bundle({ tenantId: 't1', code: 'snapshot_resolved' }), i1);
    cache.set(k2, bundle({ tenantId: 't2', code: 'snapshot_resolved' }), i2);
    cache.invalidateTenant('t1');
    expect(cache.get(k1, i1)).toBeNull();
    expect(cache.get(k2, i2)?.tenantId).toBe('t2');
  });
});
