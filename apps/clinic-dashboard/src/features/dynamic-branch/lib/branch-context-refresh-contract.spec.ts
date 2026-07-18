import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { BranchSnapshot } from './branch-types';
import { EMPTY_BRANCH_CAPABILITIES } from './branch-types';
import {
  assertMayApplyBranchSnapshot,
  getBranchPublicationGeneration,
  getPublishedBranchContext,
  publishBranchContext,
  registerBranchConsumer,
  resetBranchContextBus,
  StaleBranchSnapshotError,
} from './branch-context-bus';
import type { BranchContextPayload } from './branch-context-payload';
import {
  getBranchRefreshOrderForTests,
  runBranchContextRefresh,
  toBranchContextPayload,
} from './branch-context-refresh-contract';

function emptyConfiguration(): BranchSnapshot['view']['configuration'] {
  return {
    identity: {
      displayName: null,
      nameAr: null,
      code: null,
      isActive: true,
      overriddenFields: [],
    },
    address: {
      city: null,
      address: null,
      phone: null,
      timezone: null,
      overriddenFields: [],
    },
    clinical: {
      hoursConfigured: false,
      defaultsConfigured: false,
      queueConfigured: false,
      overriddenFields: [],
    },
    financial: {
      sequencesConfigured: false,
      taxConfigured: false,
      overriddenFields: [],
    },
    inventory: {
      warehousesConfigured: false,
      transfersConfigured: false,
      overriddenFields: [],
    },
    reporting: {
      defaultBranchFilter: null,
      crossBranchAllowed: false,
      overriddenFields: [],
    },
    analytics: {
      defaultBranchFilter: null,
      crossBranchAllowed: false,
      overriddenFields: [],
    },
    whiteLabel: {
      displayName: null,
      logoStorageKey: null,
      accentColor: null,
      emailSenderName: null,
      pdfHeaderEnabled: false,
      overriddenFields: [],
    },
  };
}

function makeSnapshot(activeBranchId: string | null, version: string): BranchSnapshot {
  return {
    kind: 'branch',
    view: {
      tenantId: 't1',
      organizationProfileId: null,
      regionId: null,
      branchId: activeBranchId,
      userId: 'u1',
      locale: 'en',
      departmentId: null,
      branchAccessMode: 'multi',
      accessibleBranchIds: activeBranchId ? [activeBranchId, 'b2'] : ['b1', 'b2'],
      primaryBranchId: 'b1',
      canSelectBranch: true,
      canViewCrossBranch: true,
      canManageBranches: false,
      branches: [
        { id: 'b1', name: 'One', nameAr: null, isActive: true },
        { id: 'b2', name: 'Two', nameAr: null, isActive: true },
      ],
      activeBranch: activeBranchId
        ? { id: activeBranchId, name: 'Active', nameAr: null, isActive: true }
        : null,
      accessibleSurfaces: [],
      lockedSurfaces: [],
      configuration: emptyConfiguration(),
      capabilities: {
        ...EMPTY_BRANCH_CAPABILITIES,
        canAccessBranch: true,
        canSwitchBranch: true,
        canViewCrossBranch: true,
      },
      source: 'registry',
      catalogGeneration: 1,
      settingsVersion: 's1',
      branchSnapshotVersion: version,
      resolvedAt: new Date().toISOString(),
    },
    source: 'registry',
    registryMode: true,
    staticCatalogHash: 'hash',
    entitlementVersion: 'e1',
    catalogGeneration: 1,
    settingsVersion: 's1',
    branchSnapshotVersion: version,
    capabilities: {
      ...EMPTY_BRANCH_CAPABILITIES,
      canAccessBranch: true,
      canSwitchBranch: true,
      canViewCrossBranch: true,
    },
    entries: [],
    activeBranchId,
    accessibleBranchIds: activeBranchId ? [activeBranchId, 'b2'] : ['b1', 'b2'],
    identity: {
      tenantId: 't1',
      userId: 'u1',
      rolesHash: 'r',
      locale: 'en',
      activeBranchId,
      primaryBranchId: 'b1',
    },
  };
}

describe('BranchContextRefreshContract (Phase 36b remediation)', () => {
  beforeEach(() => {
    resetBranchContextBus();
  });

  it('exposes deterministic refresh order matching SSOT §21', () => {
    expect(getBranchRefreshOrderForTests()).toEqual([
      'whiteLabel',
      'navigation',
      'routing',
      'dashboard',
      'search',
      'reporting',
      'analytics',
      'activity',
      'audit',
      'journey',
      'notification',
    ]);
  });

  it('executes refresh ordering: invalidate → rebuild → WL → nav/route → catalog → publish', async () => {
    const phases: string[] = [];
    const consumerOrder: string[] = [];
    let session: string | null = 'b1';
    let current = makeSnapshot('b1', 'v1');

    for (const id of getBranchRefreshOrderForTests()) {
      registerBranchConsumer({
        id,
        getObservedVersion: () => null,
        refresh: async (payload) => {
          consumerOrder.push(id);
          assertMayApplyBranchSnapshot(id, payload);
        },
      });
    }

    publishBranchContext(toBranchContextPayload(current, 'branch.context.ready'));

    const result = await runBranchContextRefresh({
      event: 'branch.context.changed',
      nextActiveBranchId: 'b2',
      previous: {
        activeBranchId: 'b1',
        branchSnapshot: current,
        payload: toBranchContextPayload(current, 'branch.context.ready'),
      },
      onPhase: (step) => {
        if (step.status === 'started' || step.phase === 'complete') {
          phases.push(step.phase);
        }
      },
      hooks: {
        persistActiveBranchId: (id) => {
          session = id;
        },
        invalidateBranchCache: () => {
          phases.push('cache-cleared');
        },
        rebuildEffectiveBranchView: () => {
          current = makeSnapshot(session, 'v2');
          return current;
        },
        restoreActiveBranchId: (id) => {
          session = id;
        },
        restoreBranchSnapshot: (snap) => {
          if (snap) current = snap;
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.rolledBack).toBe(false);
    expect(phases.filter((p) => p !== 'cache-cleared')).toEqual([
      'persist',
      'invalidate-branch-cache',
      'rebuild-effective-branch-view',
      'refresh-white-label',
      'refresh-navigation-routing',
      'refresh-navigation-routing',
      'refresh-catalog-tier',
      'refresh-catalog-tier',
      'refresh-catalog-tier',
      'refresh-catalog-tier',
      'refresh-catalog-tier',
      'refresh-catalog-tier',
      'refresh-catalog-tier',
      'refresh-catalog-tier',
      'publish',
      'complete',
    ]);
    expect(consumerOrder[0]).toBe('whiteLabel');
    expect(new Set(consumerOrder.slice(1, 3))).toEqual(new Set(['navigation', 'routing']));
    expect(new Set(consumerOrder.slice(3))).toEqual(
      new Set(['dashboard', 'search', 'reporting', 'analytics', 'activity', 'audit', 'journey', 'notification']),
    );
    expect(getPublishedBranchContext()?.branchSnapshotVersion).toBe('v2');
    expect(getPublishedBranchContext()?.activeBranchId).toBe('b2');
    expect(session).toBe('b2');
  });

  it('rolls back session, snapshot, and consumers on critical WhiteLabel failure', async () => {
    let session: string | null = 'b1';
    let current = makeSnapshot('b1', 'v1');
    const previousPayload = toBranchContextPayload(current, 'branch.context.ready');
    publishBranchContext(previousPayload);

    const observed: Record<string, string[]> = {
      whiteLabel: [],
      dashboard: [],
    };

    registerBranchConsumer({
      id: 'whiteLabel',
      getObservedVersion: () => observed.whiteLabel.at(-1) ?? null,
      refresh: async (payload) => {
        observed.whiteLabel.push(payload.branchSnapshotVersion);
        if (payload.event === 'branch.context.changed') {
          throw new Error('WL_CRITICAL_FAIL');
        }
      },
    });
    registerBranchConsumer({
      id: 'dashboard',
      getObservedVersion: () => observed.dashboard.at(-1) ?? null,
      refresh: async (payload) => {
        observed.dashboard.push(`${payload.event}:${payload.branchSnapshotVersion}`);
      },
    });

    const result = await runBranchContextRefresh({
      event: 'branch.context.changed',
      nextActiveBranchId: 'b2',
      previous: {
        activeBranchId: 'b1',
        branchSnapshot: current,
        payload: previousPayload,
      },
      hooks: {
        persistActiveBranchId: (id) => {
          session = id;
        },
        invalidateBranchCache: () => undefined,
        rebuildEffectiveBranchView: () => {
          current = makeSnapshot(session, 'v2');
          return current;
        },
        restoreActiveBranchId: (id) => {
          session = id;
        },
        restoreBranchSnapshot: (snap) => {
          if (snap) current = snap;
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.rolledBack).toBe(true);
    expect(session).toBe('b1');
    expect(current.branchSnapshotVersion).toBe('v1');
    expect(getPublishedBranchContext()?.event).toBe('branch.context.rollback');
    expect(getPublishedBranchContext()?.branchSnapshotVersion).toBe('v1');
    expect(observed.dashboard.some((entry) => entry.startsWith('branch.context.rollback:'))).toBe(
      true,
    );
    // Catalog tier must not partially complete after critical failure before publish
    expect(getPublishedBranchContext()?.activeBranchId).toBe('b1');
  });

  it('rejects superseded snapshots after synchronized publish (stale gate)', () => {
    const v1: BranchContextPayload = {
      activeBranchId: 'b1',
      branchSnapshotVersion: 'v1',
      tenantId: 't1',
      accessibleBranchIds: ['b1'],
      configuration: null,
      event: 'branch.context.ready',
    };
    const v2: BranchContextPayload = { ...v1, branchSnapshotVersion: 'v2', activeBranchId: 'b2' };

    publishBranchContext(v1);
    const gen1 = getBranchPublicationGeneration();
    publishBranchContext(v2);
    expect(getBranchPublicationGeneration()).toBeGreaterThan(gen1);

    expect(() => assertMayApplyBranchSnapshot('dashboard', v1)).toThrow(StaleBranchSnapshotError);
    expect(() => assertMayApplyBranchSnapshot('dashboard', v2)).not.toThrow();
    expect(() => assertMayApplyBranchSnapshot('journey', v1)).toThrow(StaleBranchSnapshotError);
    expect(() => assertMayApplyBranchSnapshot('journey', v2)).not.toThrow();
  });

  it('allows rollback payload even when version was superseded by failed candidate', async () => {
    let session: string | null = 'b1';
    let current = makeSnapshot('b1', 'v1');
    const previousPayload = toBranchContextPayload(current, 'branch.context.ready');
    publishBranchContext(previousPayload);

    registerBranchConsumer({
      id: 'whiteLabel',
      getObservedVersion: () => null,
      refresh: async (payload) => {
        if (payload.event === 'branch.context.changed') throw new Error('fail');
      },
    });

    await runBranchContextRefresh({
      event: 'branch.context.changed',
      nextActiveBranchId: 'b2',
      previous: {
        activeBranchId: 'b1',
        branchSnapshot: current,
        payload: previousPayload,
      },
      hooks: {
        persistActiveBranchId: (id) => {
          session = id;
        },
        invalidateBranchCache: () => undefined,
        rebuildEffectiveBranchView: () => {
          current = makeSnapshot('b2', 'v2-failed');
          return current;
        },
        restoreActiveBranchId: (id) => {
          session = id;
        },
        restoreBranchSnapshot: (snap) => {
          if (snap) current = snap;
        },
      },
    });

    expect(session).toBe('b1');
    expect(() =>
      assertMayApplyBranchSnapshot('search', {
        ...previousPayload,
        event: 'branch.context.rollback',
      }),
    ).not.toThrow();
    expect(() =>
      assertMayApplyBranchSnapshot('journey', {
        ...previousPayload,
        event: 'branch.context.rollback',
      }),
    ).not.toThrow();
  });

  it('marks non-critical consumer failures as degraded without rolling back', async () => {
    let session: string | null = 'b1';
    let current = makeSnapshot('b1', 'v1');
    publishBranchContext(toBranchContextPayload(current, 'branch.context.ready'));

    registerBranchConsumer({
      id: 'whiteLabel',
      getObservedVersion: () => null,
      refresh: async () => undefined,
    });
    registerBranchConsumer({
      id: 'dashboard',
      getObservedVersion: () => null,
      refresh: async () => {
        throw new Error('dashboard degraded');
      },
    });

    const result = await runBranchContextRefresh({
      event: 'branch.context.changed',
      nextActiveBranchId: 'b2',
      previous: {
        activeBranchId: 'b1',
        branchSnapshot: current,
        payload: toBranchContextPayload(current, 'branch.context.ready'),
      },
      hooks: {
        persistActiveBranchId: (id) => {
          session = id;
        },
        invalidateBranchCache: () => undefined,
        rebuildEffectiveBranchView: () => {
          current = makeSnapshot('b2', 'v2');
          return current;
        },
        restoreActiveBranchId: (id) => {
          session = id;
        },
        restoreBranchSnapshot: (snap) => {
          if (snap) current = snap;
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.degradedConsumers).toContain('dashboard');
    expect(session).toBe('b2');
    expect(getPublishedBranchContext()?.branchSnapshotVersion).toBe('v2');
  });

  it('single-flight: concurrent refreshes share one transaction', async () => {
    let builds = 0;
    let session: string | null = 'b1';
    let current = makeSnapshot('b1', 'v1');
    publishBranchContext(toBranchContextPayload(current, 'branch.context.ready'));

    registerBranchConsumer({
      id: 'whiteLabel',
      getObservedVersion: () => null,
      refresh: async () => {
        await new Promise((r) => setTimeout(r, 20));
      },
    });

    const hooks = {
      persistActiveBranchId: (id: string | null) => {
        session = id;
      },
      invalidateBranchCache: () => undefined,
      rebuildEffectiveBranchView: () => {
        builds += 1;
        current = makeSnapshot(session, `v${builds + 1}`);
        return current;
      },
      restoreActiveBranchId: (id: string | null) => {
        session = id;
      },
      restoreBranchSnapshot: (snap: BranchSnapshot | null) => {
        if (snap) current = snap;
      },
    };

    const previous = {
      activeBranchId: 'b1' as string | null,
      branchSnapshot: current,
      payload: toBranchContextPayload(current, 'branch.context.ready'),
    };

    const [a, b] = await Promise.all([
      runBranchContextRefresh({
        event: 'branch.context.changed',
        nextActiveBranchId: 'b2',
        previous,
        hooks,
      }),
      runBranchContextRefresh({
        event: 'branch.context.changed',
        nextActiveBranchId: 'b2',
        previous,
        hooks,
      }),
    ]);

    expect(a).toBe(b);
    expect(builds).toBe(1);
  });

  it('keeps consumers on the same published branchSnapshotVersion after success', async () => {
    const versions = new Map<string, string>();
    let session: string | null = 'b1';
    let current = makeSnapshot('b1', 'v1');
    publishBranchContext(toBranchContextPayload(current, 'branch.context.ready'));

    for (const id of getBranchRefreshOrderForTests()) {
      registerBranchConsumer({
        id,
        getObservedVersion: () => versions.get(id) ?? null,
        refresh: async (payload) => {
          versions.set(id, payload.branchSnapshotVersion);
        },
      });
    }

    await runBranchContextRefresh({
      event: 'branch.context.changed',
      nextActiveBranchId: 'b2',
      previous: {
        activeBranchId: 'b1',
        branchSnapshot: current,
        payload: toBranchContextPayload(current, 'branch.context.ready'),
      },
      hooks: {
        persistActiveBranchId: (id) => {
          session = id;
        },
        invalidateBranchCache: () => undefined,
        rebuildEffectiveBranchView: () => {
          current = makeSnapshot('b2', 'sync-v');
          return current;
        },
        restoreActiveBranchId: vi.fn(),
        restoreBranchSnapshot: vi.fn(),
      },
    });

    const published = getPublishedBranchContext()?.branchSnapshotVersion;
    expect(published).toBe('sync-v');
    for (const id of getBranchRefreshOrderForTests()) {
      expect(versions.get(id)).toBe(published);
    }
    expect(session).toBe('b2');
  });
});
