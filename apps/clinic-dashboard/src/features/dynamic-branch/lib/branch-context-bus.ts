import type {
  BranchConsumerId,
  BranchContextEvent,
  BranchContextPayload,
} from './branch-context-payload';

export class StaleBranchSnapshotError extends Error {
  readonly name = 'StaleBranchSnapshotError';
  constructor(
    readonly consumerId: BranchConsumerId,
    readonly observedVersion: string,
    readonly incomingVersion: string,
  ) {
    super(
      `Stale branch snapshot rejected for ${consumerId}: observed=${observedVersion} incoming=${incomingVersion}`,
    );
  }
}

export interface BranchConsumerAdapter {
  id: BranchConsumerId;
  /**
   * Clear provider-local caches and schedule a rebuild against `payload`.
   * Must call {@link assertMayApplyBranchSnapshot} before applying.
   */
  refresh: (payload: BranchContextPayload) => Promise<void>;
  /** Last version this consumer successfully applied; null if never applied. */
  getObservedVersion: () => string | null;
}

type Listener = (payload: BranchContextPayload) => void;

const consumers = new Map<BranchConsumerId, BranchConsumerAdapter>();
const listeners = new Set<Listener>();
const supersededVersions = new Set<string>();

let published: BranchContextPayload | null = null;
/** Monotonic publication counter — synchronized publish (§22 / M1). */
let publicationGeneration = 0;

export function getPublishedBranchContext(): BranchContextPayload | null {
  return published;
}

export function getBranchPublicationGeneration(): number {
  return publicationGeneration;
}

export function getSupersededBranchVersionsForTests(): string[] {
  return [...supersededVersions];
}

/**
 * Version gate (§21.5 / §22): reject snapshots that have been superseded by a later publish.
 * Rollback events are always allowed so recovery can restore the prior version.
 */
export function assertMayApplyBranchSnapshot(
  consumerId: BranchConsumerId,
  incoming: BranchContextPayload,
): void {
  if (incoming.event === 'branch.context.rollback') return;
  if (supersededVersions.has(incoming.branchSnapshotVersion)) {
    throw new StaleBranchSnapshotError(
      consumerId,
      published?.branchSnapshotVersion ?? incoming.branchSnapshotVersion,
      incoming.branchSnapshotVersion,
    );
  }
}

export function registerBranchConsumer(adapter: BranchConsumerAdapter): () => void {
  consumers.set(adapter.id, adapter);
  syncBranchRuntimeProbeToWindow();
  return () => {
    const current = consumers.get(adapter.id);
    if (current === adapter) {
      consumers.delete(adapter.id);
      syncBranchRuntimeProbeToWindow();
    }
  };
}

export function getRegisteredBranchConsumer(
  id: BranchConsumerId,
): BranchConsumerAdapter | undefined {
  return consumers.get(id);
}

export function listRegisteredBranchConsumers(): BranchConsumerId[] {
  return [...consumers.keys()];
}

/** Test helper — clears registry + publication state. */
export function resetBranchContextBus(): void {
  consumers.clear();
  listeners.clear();
  supersededVersions.clear();
  published = null;
  publicationGeneration = 0;
}

export function subscribeBranchContext(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Synchronized snapshot publication (§22 / M1).
 * Only the DynamicBranchProvider orchestrator may call this.
 */
export function publishBranchContext(payload: BranchContextPayload): void {
  const previousVersion = published?.branchSnapshotVersion ?? null;

  if (
    previousVersion != null &&
    previousVersion !== payload.branchSnapshotVersion &&
    payload.event !== 'branch.context.rollback'
  ) {
    supersededVersions.add(previousVersion);
  }

  if (payload.event === 'branch.context.rollback') {
    // Failed candidate (if any) stays superseded; restored version is current again.
    supersededVersions.delete(payload.branchSnapshotVersion);
  }

  published = {
    ...payload,
    accessibleBranchIds: [...payload.accessibleBranchIds],
  };
  publicationGeneration += 1;
  syncBranchRuntimeProbeToWindow();
  for (const listener of listeners) {
    listener(published);
  }
}

export function clearPublishedBranchContext(
  event: BranchContextEvent = 'branch.context.cleared',
): void {
  if (!published) {
    publicationGeneration += 1;
    return;
  }
  if (published.branchSnapshotVersion) {
    supersededVersions.add(published.branchSnapshotVersion);
  }
  published = {
    ...published,
    activeBranchId: null,
    accessibleBranchIds: [],
    configuration: null,
    event,
    branchSnapshotVersion: `${published.branchSnapshotVersion}:cleared`,
  };
  publicationGeneration += 1;
  syncBranchRuntimeProbeToWindow();
  for (const listener of listeners) {
    listener(published);
  }
}

export async function invokeBranchConsumer(
  id: BranchConsumerId,
  payload: BranchContextPayload,
): Promise<'ok' | 'missing'> {
  const adapter = consumers.get(id);
  if (!adapter) return 'missing';
  await adapter.refresh(payload);
  syncBranchRuntimeProbeToWindow();
  return 'ok';
}

/** Read-only probe for Phase 36c Playwright — not a configuration mutation surface. */
export interface BranchRuntimeProbe {
  activeBranchId: string | null;
  branchSnapshotVersion: string | null;
  tenantId: string | null;
  accessibleBranchIds: string[];
  event: string | null;
  publicationGeneration: number;
  consumerVersions: Partial<Record<BranchConsumerId, string | null>>;
}

export function getBranchRuntimeProbe(): BranchRuntimeProbe {
  const consumerVersions: BranchRuntimeProbe['consumerVersions'] = {};
  for (const [id, adapter] of consumers) {
    consumerVersions[id] = adapter.getObservedVersion();
  }
  return {
    activeBranchId: published?.activeBranchId ?? null,
    branchSnapshotVersion: published?.branchSnapshotVersion ?? null,
    tenantId: published?.tenantId ?? null,
    accessibleBranchIds: published ? [...published.accessibleBranchIds] : [],
    event: published?.event ?? null,
    publicationGeneration,
    consumerVersions,
  };
}

/** Syncs published branch context to window for runtime acceptance (36c). */
export function syncBranchRuntimeProbeToWindow(): void {
  if (typeof window === 'undefined') return;
  (window as Window & { __BOOKING_BRANCH_RUNTIME__?: BranchRuntimeProbe }).__BOOKING_BRANCH_RUNTIME__ =
    getBranchRuntimeProbe();
}
