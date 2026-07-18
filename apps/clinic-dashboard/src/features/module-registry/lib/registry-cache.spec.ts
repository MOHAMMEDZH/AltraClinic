/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildPartialRegistryIdentity,
  buildRegistryCacheKey,
} from './registry-cache-identity';
import {
  clearRegistryCache,
  readRegistryCache,
  writeRegistryCache,
} from './registry-cache';

const bootstrapPayload = {
  snapshot: {
    schemaVersion: '1.0' as const,
    platformVersion: '1.0.0',
    generatedAt: '2026-07-13T00:00:00.000Z',
    catalogGeneration: 1,
    moduleCount: 21,
    dependencyOrder: ['dashboard'],
    entitlementVersion: 'active|w:true|m:true|lm:|mf:',
  },
  modules: [],
};

describe('registry cache isolation', () => {
  beforeEach(() => {
    clearRegistryCache();
    sessionStorage.clear();
  });

  it('does not reuse cache across tenants', () => {
    const tenantA = buildPartialRegistryIdentity({
      tenantId: 'tenant-a',
      userId: 'user-1',
      roles: ['owner'],
    });
    const tenantB = buildPartialRegistryIdentity({
      tenantId: 'tenant-b',
      userId: 'user-1',
      roles: ['owner'],
    });
    const identityA = {
      ...tenantA,
      catalogGeneration: 1,
      entitlementVersion: 'v1',
    };

    writeRegistryCache(identityA, bootstrapPayload, buildRegistryCacheKey(identityA));

    expect(readRegistryCache(tenantA)).not.toBeNull();
    expect(readRegistryCache(tenantB)).toBeNull();
  });

  it('does not reuse cache across users', () => {
    const userA = buildPartialRegistryIdentity({
      tenantId: 'tenant-a',
      userId: 'user-a',
      roles: ['owner'],
    });
    const userB = buildPartialRegistryIdentity({
      tenantId: 'tenant-a',
      userId: 'user-b',
      roles: ['owner'],
    });
    const identityA = {
      ...userA,
      catalogGeneration: 1,
      entitlementVersion: 'v1',
    };

    writeRegistryCache(identityA, bootstrapPayload, buildRegistryCacheKey(identityA));

    expect(readRegistryCache(userA)).not.toBeNull();
    expect(readRegistryCache(userB)).toBeNull();
  });

  it('does not reuse cache across role changes', () => {
    const owner = buildPartialRegistryIdentity({
      tenantId: 'tenant-a',
      userId: 'user-a',
      roles: ['owner'],
    });
    const receptionist = buildPartialRegistryIdentity({
      tenantId: 'tenant-a',
      userId: 'user-a',
      roles: ['receptionist'],
    });
    const identityOwner = {
      ...owner,
      catalogGeneration: 1,
      entitlementVersion: 'v1',
    };

    writeRegistryCache(identityOwner, bootstrapPayload, buildRegistryCacheKey(identityOwner));

    expect(readRegistryCache(owner)).not.toBeNull();
    expect(readRegistryCache(receptionist)).toBeNull();
  });
});
