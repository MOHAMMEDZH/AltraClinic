/**
 * Step 17 runtime-management provenance — derived from Step 16 history (no new schema).
 *
 * NEVER_MANAGED → LEGACY only.
 * All other classifications never use legacy fallback.
 */

export type RuntimeProvenance =
  | 'NEVER_MANAGED'
  | 'AUTHORITATIVE_ACTIVE'
  | 'AUTHORITATIVE_PENDING_SUCCESSOR'
  | 'AUTHORITATIVE_SUSPENDED'
  | 'AUTHORITATIVE_TERMINAL'
  | 'AUTHORITATIVE_INVALID'
  | 'AUTHORITATIVE_PENDING_ACTIVATION';

export type RuntimeAuthorityProbe = {
  provenance: RuntimeProvenance;
  source: 'SNAPSHOT' | 'LEGACY';
  code: string;
  errorCode?: string;
  configId?: string;
  snapshotId?: string;
  fingerprint?: string;
  lifecycle?: string;
  platformTenantId?: string;
  /** True when predecessor handoff supplied the runtime-effective snapshot. */
  predecessorHandoff?: boolean;
};

export type CommercialHistoryFacts = {
  platformTenantId: string;
  configCount: number;
  snapshotCount: number;
  fingerprintCount: number;
  terminalConfigCount: number;
  activatedConfigCount: number;
  currentCount: number;
  currents: Array<{
    id: string;
    lifecycle: string;
    predecessorId: string | null;
    platformTenantId: string;
    snapshot: { id: string; fingerprint: string } | null;
  }>;
};

const TERMINAL_LIFECYCLES = new Set(['CANCELLED', 'EXPIRED', 'SUPERSEDED']);

export function classifyRuntimeProvenance(facts: CommercialHistoryFacts): RuntimeAuthorityProbe {
  const { platformTenantId } = facts;

  if (
    facts.configCount === 0 &&
    facts.snapshotCount === 0 &&
    facts.fingerprintCount === 0 &&
    facts.terminalConfigCount === 0
  ) {
    return {
      provenance: 'NEVER_MANAGED',
      source: 'LEGACY',
      code: 'legacy_never_managed',
      platformTenantId,
    };
  }

  // Managed tenant: any Step 16 commercial history exists.
  if (facts.currentCount > 1) {
    return {
      provenance: 'AUTHORITATIVE_INVALID',
      source: 'SNAPSHOT',
      code: 'current_configuration_ambiguous',
      errorCode: 'current_configuration_ambiguous',
      platformTenantId,
    };
  }

  if (facts.currentCount === 0) {
    // Zero current after cancel/expire/supersede — terminal deny, never legacy.
    return {
      provenance: 'AUTHORITATIVE_TERMINAL',
      source: 'SNAPSHOT',
      code: 'runtime_terminal',
      errorCode: 'runtime_terminal',
      platformTenantId,
    };
  }

  const current = facts.currents[0]!;
  const snap = current.snapshot;

  if (current.lifecycle === 'SUSPENDED') {
    if (!snap) {
      return {
        provenance: 'AUTHORITATIVE_INVALID',
        source: 'SNAPSHOT',
        code: 'active_without_snapshot',
        errorCode: 'active_without_snapshot',
        configId: current.id,
        lifecycle: current.lifecycle,
        platformTenantId,
      };
    }
    return {
      provenance: 'AUTHORITATIVE_SUSPENDED',
      source: 'SNAPSHOT',
      code: 'runtime_suspended',
      errorCode: 'runtime_suspended',
      configId: current.id,
      snapshotId: snap.id,
      fingerprint: snap.fingerprint,
      lifecycle: current.lifecycle,
      platformTenantId,
    };
  }

  if (current.lifecycle === 'CANCELLED') {
    return {
      provenance: 'AUTHORITATIVE_TERMINAL',
      source: 'SNAPSHOT',
      code: 'runtime_cancelled',
      errorCode: 'runtime_cancelled',
      configId: current.id,
      snapshotId: snap?.id,
      fingerprint: snap?.fingerprint,
      lifecycle: current.lifecycle,
      platformTenantId,
    };
  }

  if (current.lifecycle === 'EXPIRED') {
    return {
      provenance: 'AUTHORITATIVE_TERMINAL',
      source: 'SNAPSHOT',
      code: 'runtime_expired',
      errorCode: 'runtime_expired',
      configId: current.id,
      snapshotId: snap?.id,
      fingerprint: snap?.fingerprint,
      lifecycle: current.lifecycle,
      platformTenantId,
    };
  }

  if (current.lifecycle === 'ACTIVE_COMMERCIAL') {
    if (!snap) {
      return {
        provenance: 'AUTHORITATIVE_INVALID',
        source: 'SNAPSHOT',
        code: 'active_without_snapshot',
        errorCode: 'active_without_snapshot',
        configId: current.id,
        lifecycle: current.lifecycle,
        platformTenantId,
      };
    }
    return {
      provenance: 'AUTHORITATIVE_ACTIVE',
      source: 'SNAPSHOT',
      code: 'snapshot_active',
      configId: current.id,
      snapshotId: snap.id,
      fingerprint: snap.fingerprint,
      lifecycle: current.lifecycle,
      platformTenantId,
    };
  }

  // DRAFT or SCHEDULED current
  if (current.lifecycle === 'DRAFT' || current.lifecycle === 'SCHEDULED') {
    if (current.predecessorId) {
      // Successor handoff — predecessor resolution done by caller.
      return {
        provenance: 'AUTHORITATIVE_PENDING_SUCCESSOR',
        source: 'SNAPSHOT',
        code: 'pending_successor_handoff',
        configId: current.id,
        lifecycle: current.lifecycle,
        platformTenantId,
        predecessorHandoff: true,
      };
    }
    // First Draft/Scheduled before any activation — managed, no legacy.
    if (facts.activatedConfigCount > 0 || facts.snapshotCount > 0) {
      // Orphaned: had activations but current has no predecessor link.
      return {
        provenance: 'AUTHORITATIVE_INVALID',
        source: 'SNAPSHOT',
        code: 'runtime_authority_orphaned',
        errorCode: 'runtime_authority_orphaned',
        configId: current.id,
        lifecycle: current.lifecycle,
        platformTenantId,
      };
    }
    return {
      provenance: 'AUTHORITATIVE_PENDING_ACTIVATION',
      source: 'SNAPSHOT',
      code: 'runtime_pending_activation',
      errorCode: 'runtime_pending_activation',
      configId: current.id,
      lifecycle: current.lifecycle,
      platformTenantId,
    };
  }

  if (TERMINAL_LIFECYCLES.has(current.lifecycle)) {
    return {
      provenance: 'AUTHORITATIVE_TERMINAL',
      source: 'SNAPSHOT',
      code: 'runtime_terminal',
      errorCode: 'runtime_terminal',
      configId: current.id,
      lifecycle: current.lifecycle,
      platformTenantId,
    };
  }

  return {
    provenance: 'AUTHORITATIVE_INVALID',
    source: 'SNAPSHOT',
    code: 'runtime_authority_undetermined',
    errorCode: 'runtime_authority_undetermined',
    configId: current.id,
    lifecycle: current.lifecycle,
    platformTenantId,
  };
}

export function isRuntimeDenyCode(code: string): boolean {
  return [
    'runtime_suspended',
    'runtime_cancelled',
    'runtime_expired',
    'runtime_terminal',
    'runtime_pending_activation',
    'runtime_authority_orphaned',
    'runtime_authority_undetermined',
    'runtime_predecessor_missing',
    'runtime_predecessor_loop',
    'runtime_predecessor_cross_tenant',
    'runtime_predecessor_ambiguous',
    'runtime_predecessor_inactive',
    'platform_tenant_suspended',
    'platform_tenant_archived',
    'platform_tenant_provisioning',
    'active_without_snapshot',
    'snapshot_malformed',
    'snapshot_fingerprint_mismatch',
    'snapshot_unsupported_schema',
    'snapshot_prohibited_field',
    'snapshot_tenant_mismatch',
    'snapshot_plan_missing',
    'snapshot_plan_business_rejected',
    'snapshot_plan_version_missing',
    'snapshot_fingerprint_missing',
    'snapshot_duplicate_addon',
    'snapshot_duplicate_override',
    'snapshot_missing',
    'snapshot_addon_incomplete',
    'snapshot_override_incomplete',
    'current_configuration_ambiguous',
    'composition_conflict',
    'tenant_not_found',
  ].includes(code);
}
