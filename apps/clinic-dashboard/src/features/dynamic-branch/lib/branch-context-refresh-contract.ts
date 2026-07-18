import {
  BRANCH_CATALOG_TIER,
  BRANCH_CRITICAL_CONSUMERS,
  BRANCH_NAV_ROUTE_TIER,
  BRANCH_REFRESH_ORDER,
  type BranchConsumerId,
  type BranchContextEvent,
  type BranchContextPayload,
} from './branch-context-payload';
import {
  getRegisteredBranchConsumer,
  invokeBranchConsumer,
  publishBranchContext,
  StaleBranchSnapshotError,
} from './branch-context-bus';
import type { BranchSnapshot } from './branch-types';

export type BranchRefreshPhase =
  | 'idle'
  | 'validate'
  | 'persist'
  | 'invalidate-branch-cache'
  | 'rebuild-effective-branch-view'
  | 'refresh-white-label'
  | 'refresh-navigation-routing'
  | 'refresh-catalog-tier'
  | 'publish'
  | 'complete'
  | 'rollback';

export interface BranchRefreshStepRecord {
  phase: BranchRefreshPhase;
  consumerId?: BranchConsumerId;
  status: 'started' | 'ok' | 'missing' | 'degraded' | 'failed' | 'rolled-back';
  error?: string;
}

export interface BranchTransactionSnapshot {
  activeBranchId: string | null;
  branchSnapshot: BranchSnapshot | null;
  payload: BranchContextPayload | null;
}

export interface BranchContextRefreshHooks {
  /** Invalidate `booking.branch.snapshot` memory cache. */
  invalidateBranchCache: () => void;
  /** Rebuild EffectiveBranchView / BranchSnapshot for the (new) active selection. */
  rebuildEffectiveBranchView: () => BranchSnapshot;
  /** Persist validated selection (session). Called only after access validation. */
  persistActiveBranchId?: (branchId: string | null) => void;
  /** Restore session selection during rollback. */
  restoreActiveBranchId?: (branchId: string | null) => void;
  /** Restore prior BranchSnapshot into provider memory/cache. */
  restoreBranchSnapshot?: (snapshot: BranchSnapshot | null) => void;
}

export interface RunBranchContextRefreshInput {
  event: BranchContextEvent;
  /** Pre-transaction memory for atomic rollback (§20.4). */
  previous: BranchTransactionSnapshot;
  /** Candidate payload after branch rebuild (version must match rebuilt snapshot). */
  hooks: BranchContextRefreshHooks;
  /** Optional target used only for persist (after rebuild for switch). */
  nextActiveBranchId?: string | null;
  /**
   * When true, skip persist (config refresh with same activeBranchId).
   * Persist still runs for branch.context.changed when nextActiveBranchId is provided.
   */
  skipPersist?: boolean;
  onPhase?: (step: BranchRefreshStepRecord) => void;
}

export interface BranchContextRefreshResult {
  ok: boolean;
  rolledBack: boolean;
  payload: BranchContextPayload | null;
  steps: BranchRefreshStepRecord[];
  degradedConsumers: BranchConsumerId[];
  error?: Error;
}

let flight: Promise<BranchContextRefreshResult> | null = null;

export function isBranchRefreshInFlight(): boolean {
  return flight != null;
}

export function toBranchContextPayload(
  snapshot: BranchSnapshot,
  event: BranchContextEvent,
): BranchContextPayload {
  return {
    activeBranchId: snapshot.activeBranchId,
    branchSnapshotVersion: snapshot.branchSnapshotVersion,
    tenantId: snapshot.identity.tenantId,
    accessibleBranchIds: [...snapshot.accessibleBranchIds],
    configuration: snapshot.view.configuration,
    event,
  };
}

function record(
  steps: BranchRefreshStepRecord[],
  onPhase: RunBranchContextRefreshInput['onPhase'],
  step: BranchRefreshStepRecord,
): void {
  steps.push(step);
  onPhase?.(step);
}

async function refreshCritical(
  payload: BranchContextPayload,
  steps: BranchRefreshStepRecord[],
  onPhase: RunBranchContextRefreshInput['onPhase'],
): Promise<void> {
  for (const id of BRANCH_CRITICAL_CONSUMERS) {
    record(steps, onPhase, { phase: 'refresh-white-label', consumerId: id, status: 'started' });
    const adapter = getRegisteredBranchConsumer(id);
    if (!adapter) {
      // WhiteLabel not mounted (tests / early boot) — treat as degraded only for non-mounted;
      // critical path requires success when registered. Unregistered = missing OK for vitest
      // but production AppProviders always mounts WL under branch.
      record(steps, onPhase, { phase: 'refresh-white-label', consumerId: id, status: 'missing' });
      continue;
    }
    try {
      await adapter.refresh(payload);
      record(steps, onPhase, { phase: 'refresh-white-label', consumerId: id, status: 'ok' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      record(steps, onPhase, {
        phase: 'refresh-white-label',
        consumerId: id,
        status: 'failed',
        error: message,
      });
      throw error instanceof Error ? error : new Error(message);
    }
  }
}

async function refreshTier(
  phase: BranchRefreshPhase,
  tier: readonly BranchConsumerId[],
  payload: BranchContextPayload,
  steps: BranchRefreshStepRecord[],
  onPhase: RunBranchContextRefreshInput['onPhase'],
  degraded: BranchConsumerId[],
): Promise<void> {
  await Promise.all(
    tier.map(async (id) => {
      record(steps, onPhase, { phase, consumerId: id, status: 'started' });
      try {
        const status = await invokeBranchConsumer(id, payload);
        record(steps, onPhase, { phase, consumerId: id, status });
        return { id, ok: true as const };
      } catch (error) {
        if (error instanceof StaleBranchSnapshotError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        record(steps, onPhase, { phase, consumerId: id, status: 'degraded', error: message });
        degraded.push(id);
        return { id, ok: false as const };
      }
    }),
  );
}

async function restoreConsumers(
  previousPayload: BranchContextPayload,
  steps: BranchRefreshStepRecord[],
  onPhase: RunBranchContextRefreshInput['onPhase'],
): Promise<void> {
  const rollbackPayload: BranchContextPayload = {
    ...previousPayload,
    event: 'branch.context.rollback',
  };

  for (const id of BRANCH_REFRESH_ORDER) {
    const adapter = getRegisteredBranchConsumer(id);
    if (!adapter) continue;
    try {
      await adapter.refresh(rollbackPayload);
      record(steps, onPhase, {
        phase: 'rollback',
        consumerId: id,
        status: 'rolled-back',
      });
    } catch (error) {
      record(steps, onPhase, {
        phase: 'rollback',
        consumerId: id,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * BranchContextRefreshContract runtime (§20–§21).
 *
 * Sequence (deterministic):
 * invalidate branch cache → rebuild EffectiveBranchView → critical WhiteLabel →
 * nav+route tier → dashboard/search/reporting/analytics tier → publish → complete.
 *
 * Single-flight: concurrent callers await the in-flight transaction.
 * Critical failure: restore previous session, snapshot, cache, consumer state — no partial publish.
 */
export async function runBranchContextRefresh(
  input: RunBranchContextRefreshInput,
): Promise<BranchContextRefreshResult> {
  if (flight) {
    return flight;
  }

  const run = (async (): Promise<BranchContextRefreshResult> => {
    const steps: BranchRefreshStepRecord[] = [];
    const degradedConsumers: BranchConsumerId[] = [];
    const { hooks, previous, event, onPhase, skipPersist, nextActiveBranchId } = input;

    try {
      // §20.1: Persist selection → Invalidate branch cache → Rebuild EffectiveBranchView → …
      if (!skipPersist && nextActiveBranchId !== undefined && hooks.persistActiveBranchId) {
        record(steps, onPhase, { phase: 'persist', status: 'started' });
        hooks.persistActiveBranchId(nextActiveBranchId);
        record(steps, onPhase, { phase: 'persist', status: 'ok' });
      }

      record(steps, onPhase, { phase: 'invalidate-branch-cache', status: 'started' });
      hooks.invalidateBranchCache();
      record(steps, onPhase, { phase: 'invalidate-branch-cache', status: 'ok' });

      record(steps, onPhase, { phase: 'rebuild-effective-branch-view', status: 'started' });
      const snapshot = hooks.rebuildEffectiveBranchView();
      record(steps, onPhase, { phase: 'rebuild-effective-branch-view', status: 'ok' });

      const payload = toBranchContextPayload(snapshot, event);

      await refreshCritical(payload, steps, onPhase);

      await refreshTier(
        'refresh-navigation-routing',
        BRANCH_NAV_ROUTE_TIER,
        payload,
        steps,
        onPhase,
        degradedConsumers,
      );

      await refreshTier(
        'refresh-catalog-tier',
        BRANCH_CATALOG_TIER,
        payload,
        steps,
        onPhase,
        degradedConsumers,
      );

      record(steps, onPhase, { phase: 'publish', status: 'started' });
      publishBranchContext(payload);
      record(steps, onPhase, { phase: 'publish', status: 'ok' });
      record(steps, onPhase, { phase: 'complete', status: 'ok' });

      return { ok: true, rolledBack: false, payload, steps, degradedConsumers };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      record(steps, onPhase, {
        phase: 'rollback',
        status: 'started',
        error: err.message,
      });

      if (hooks.restoreActiveBranchId) {
        hooks.restoreActiveBranchId(previous.activeBranchId);
      }
      if (hooks.restoreBranchSnapshot) {
        hooks.restoreBranchSnapshot(previous.branchSnapshot);
      }

      // Re-seed branch cache from previous snapshot when present
      if (previous.branchSnapshot) {
        // leave restore to restoreBranchSnapshot hook (provider writes cache)
      }

      if (previous.payload) {
        publishBranchContext({ ...previous.payload, event: 'branch.context.rollback' });
        await restoreConsumers(previous.payload, steps, onPhase);
      }

      record(steps, onPhase, { phase: 'rollback', status: 'rolled-back' });

      return {
        ok: false,
        rolledBack: true,
        payload: previous.payload,
        steps,
        degradedConsumers,
        error: err,
      };
    } finally {
      flight = null;
    }
  })();

  flight = run;
  return run;
}

/** Expose order for tests. */
export function getBranchRefreshOrderForTests(): readonly BranchConsumerId[] {
  return BRANCH_REFRESH_ORDER;
}
