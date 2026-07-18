import { useEffect, useRef } from 'react';
import type { BranchConsumerId, BranchContextPayload } from '../lib/branch-context-payload';
import {
  assertMayApplyBranchSnapshot,
  getPublishedBranchContext,
  registerBranchConsumer,
  subscribeBranchContext,
  syncBranchRuntimeProbeToWindow,
} from '../lib/branch-context-bus';

/**
 * Registers a branch-context consumer with the BranchContextRefreshContract bus.
 * Configuration refresh only — adapters clear local caches / bump rebuild nonces.
 */
export function useRegisterBranchConsumer(
  id: BranchConsumerId,
  refreshLocal: (payload: BranchContextPayload) => void | Promise<void>,
): void {
  const refreshRef = useRef(refreshLocal);
  refreshRef.current = refreshLocal;
  const observedRef = useRef<string | null>(null);

  useEffect(() => {
    const published = getPublishedBranchContext();
    if (published) {
      observedRef.current = published.branchSnapshotVersion;
      syncBranchRuntimeProbeToWindow();
    }

    const unsubscribe = subscribeBranchContext((payload) => {
      observedRef.current = payload.branchSnapshotVersion;
      syncBranchRuntimeProbeToWindow();
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    return registerBranchConsumer({
      id,
      getObservedVersion: () => observedRef.current,
      refresh: async (payload) => {
        assertMayApplyBranchSnapshot(id, payload);
        await refreshRef.current(payload);
        observedRef.current = payload.branchSnapshotVersion;
        syncBranchRuntimeProbeToWindow();
      },
    });
  }, [id]);
}
