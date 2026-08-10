/**
 * Phase 43e — Restore Engine domain types (pipeline / recovery / results).
 * Additive only. No scheduler / workers / cleanup / snapshot deletion.
 */

export const RESTORE_PIPELINE_STAGES = [
  'validate_restore_request',
  'load_snapshot',
  'validate_verification_status',
  'resolve_recovery_point',
  'load_manifest',
  'validate_restore_target',
  'prepare_restore',
  'restore_data',
  'validate_restore',
  'finalize_restore',
  'complete_job',
] as const;

export type RestorePipelineStage = (typeof RESTORE_PIPELINE_STAGES)[number];

export type RestoreTargetKind =
  | 'original'
  | 'alternate'
  | 'tenant_sandbox'
  | 'temporary_validation'
  | 'custom';

export type RestoreCompletionStatus = 'completed' | 'failed' | 'cancelled';

export type RecoveryPointSelectionMode =
  | 'latest_verified'
  | 'explicit_recovery_point'
  | 'snapshot_identifier';

export interface ResolvedRestoreTarget {
  kind: RestoreTargetKind;
  targetId: string;
  displayName: string;
  /** Logical destination key — never a live connection string. */
  destinationKey: string;
  compatible: boolean;
  mode: 'drill' | 'controlled';
}

export interface ResolvedRecoveryPoint {
  selectionMode: RecoveryPointSelectionMode;
  recoveryPointId: string | null;
  snapshotId: string;
  verified: boolean;
  label: string | null;
  capturedAt: Date | null;
}

export interface RestoreValidationResult {
  valid: boolean;
  licenseOk: boolean;
  permissionsOk: boolean;
  featureFlagsOk: boolean;
  tenantOwnershipOk: boolean;
  verificationStatusOk: boolean;
  manifestOk: boolean;
  storageAvailable: boolean;
  restorePolicyOk: boolean;
  reasons: readonly string[];
}

export interface RestoredObjectSummary {
  resourceType: string;
  resourceId: string;
  entityCount: number;
}

export interface RestoreResultRecord {
  id: string;
  tenantId: string;
  branchId: string | null;
  jobId: string;
  snapshotId: string;
  recoveryPointId: string | null;
  restoreMode: 'drill' | 'controlled';
  target: ResolvedRestoreTarget;
  status: RestoreCompletionStatus;
  stagesCompleted: readonly RestorePipelineStage[];
  objectsRestored: number;
  bytesRestored: number;
  restoredObjects: readonly RestoredObjectSummary[];
  warnings: readonly string[];
  validation: RestoreValidationResult;
  durationMs: number;
  failureReason: string | null;
  correlationId: string;
  createdAt: Date;
  completedAt: Date | null;
  details: Readonly<Record<string, unknown>>;
}

export interface LogicalRestoreScratchRecord {
  restoreId: string;
  tenantId: string;
  destinationKey: string;
  payloadSchemaVersion: string | null;
  logicalDataKeys: readonly string[];
  entityCounts: Readonly<Record<string, number>>;
  restoredAt: Date;
}
