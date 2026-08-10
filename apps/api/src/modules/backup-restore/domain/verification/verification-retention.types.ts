/**
 * Phase 43d — Verification & Retention domain types.
 * Additive. No restore / cleanup execution / deletion.
 */

import type { BackupManifest } from '../backup/backup-engine.types';

export const VERIFICATION_PIPELINE_STAGES = [
  'load_snapshot',
  'load_manifest',
  'validate_metadata',
  'validate_storage_reference',
  'verify_checksum',
  'verify_compression_metadata',
  'verify_encryption_metadata',
  'validate_manifest',
  'update_verification_result',
  'complete_verification',
] as const;

export type VerificationPipelineStage = (typeof VERIFICATION_PIPELINE_STAGES)[number];

/** Brief verification lifecycle states. */
export type VerificationLifecycleStatus =
  | 'pending'
  | 'running'
  | 'verified'
  | 'verification_failed'
  | 'expired'
  | 'corrupted'
  | 'unknown';

export interface VerificationTransitionRecord {
  from: VerificationLifecycleStatus;
  to: VerificationLifecycleStatus;
  at: Date;
  actorId: string;
  reason?: string | null;
}

export interface VerificationResultRecord {
  id: string;
  tenantId: string;
  branchId: string | null;
  snapshotId: string;
  backupJobId: string | null;
  requestId: string | null;
  status: VerificationLifecycleStatus;
  checksumExpected: string | null;
  checksumActual: string | null;
  stagesCompleted: readonly VerificationPipelineStage[];
  failureReason: string | null;
  transitions: readonly VerificationTransitionRecord[];
  startedAt: Date | null;
  completedAt: Date | null;
  correlationId: string;
  createdAt: Date;
  updatedAt: Date;
  details: Readonly<Record<string, unknown>>;
}

export type RetentionMode =
  | 'forever'
  | 'by_days'
  | 'by_count'
  | 'by_policy'
  | 'legal_hold';

export interface RetentionPolicyEvaluationInput {
  mode: RetentionMode;
  retainDays?: number;
  retainCount?: number;
  legalHold?: boolean;
  tenantOverrideDays?: number | null;
  inheritFromPolicyId?: string | null;
}

export interface RetentionEvaluationRecord {
  id: string;
  tenantId: string;
  evaluatedAt: Date;
  policy: RetentionPolicyEvaluationInput;
  expiredSnapshotIds: readonly string[];
  orphanedSnapshotIds: readonly string[];
  retainedSnapshotIds: readonly string[];
  legalHoldSnapshotIds: readonly string[];
  correlationId: string;
  details: Readonly<Record<string, unknown>>;
}

export type CleanupPlanPriority = 'low' | 'normal' | 'high';

export interface CleanupPlanItem {
  snapshotId: string;
  reason: 'expired' | 'orphaned' | 'policy_violation';
  sizeBytes: number;
  expiresAt: Date | null;
}

export interface CleanupPlanRecord {
  id: string;
  tenantId: string;
  createdAt: Date;
  correlationId: string;
  priority: CleanupPlanPriority;
  items: readonly CleanupPlanItem[];
  estimatedReclaimedBytes: number;
  /** Always false in 43d — planning only. */
  executed: false;
  details: Readonly<Record<string, unknown>>;
}

export interface ManifestValidationIssue {
  code: string;
  message: string;
  field?: string;
}

export interface ManifestValidationResult {
  valid: boolean;
  issues: readonly ManifestValidationIssue[];
  schemaVersion: string | null;
  manifest: BackupManifest | null;
}
