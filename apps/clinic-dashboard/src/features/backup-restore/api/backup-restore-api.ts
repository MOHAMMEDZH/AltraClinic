import { apiRequest } from '@/lib/api-client';

export type BackupRestoreJobKind = 'backup' | 'restore' | 'verification';

export type BackupRestoreJobStatus =
  | 'created'
  | 'queued'
  | 'validating'
  | 'waiting'
  | 'running'
  | 'paused'
  | 'cancelling'
  | 'cancelled'
  | 'completed'
  | 'failed'
  | 'verification_pending'
  | 'verified'
  | 'retrying'
  | 'dead_letter'
  | 'expired';

export interface BackupRestoreJobProgress {
  percent: number;
  phase: string | null;
  step: number;
  stepCount: number;
  statusMessage: string | null;
  updatedAt: string | null;
}

export interface BackupRestoreJob {
  id: string;
  tenantId: string;
  branchId: string | null;
  kind: BackupRestoreJobKind;
  typeId: string;
  status: BackupRestoreJobStatus;
  priority: string;
  initiatedByUserId: string;
  ownerUserId: string;
  idempotencyKey: string;
  correlationId: string;
  attemptCount: number;
  maxAttempts: number;
  lastError: string | null;
  failureClass: string | null;
  cancelReason: string | null;
  progress: BackupRestoreJobProgress;
  metadata: Record<string, unknown>;
  leasedAt: string | null;
  leaseOwner: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  deadLetteredAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  transitionCount?: number;
}

export interface StaticCatalogEntry {
  typeId: string;
  displayName: string;
  category: string;
  ownerModule: string;
  registrationKind: string;
  status: string;
  requiredLicense: string;
  featureFlag: string | null;
  version: string;
  adapterAttached: boolean;
  executable: boolean;
}

export interface EffectiveBackupRestoreView {
  tenantId: string | null;
  branchId: string | null;
  extensionKind: string;
  featureEnabled: boolean;
  allowBackupRestore: boolean;
  visible: boolean;
  types: readonly StaticCatalogEntry[];
  meta: {
    catalogCount: number;
    executableCount: number;
    staticCatalogIsRuntimeAuthority: boolean;
  };
}

export interface BackupSnapshot {
  id: string;
  backupJobId: string;
  tenantId: string;
  branchId: string | null;
  recoveryPointId: string | null;
  checksumSha256: string | null;
  sizeBytes: number | null;
  encryptionClass: string;
  compression: string;
  storageKey: string | null;
  storageProvider: string;
  verificationStatus: string;
  createdAt: string;
  expiresAt: string | null;
  manifest: {
    schemaVersion: string;
    typeId: string;
    resourceCount: number;
    entityCounts: Record<string, number>;
    compression: string;
    encryptionClass: string;
    encryptionAlgorithm: string;
    keyReference: string | null;
  };
}

export interface VerificationResult {
  id: string;
  tenantId: string;
  snapshotId: string;
  requestId: string | null;
  status: string;
  stagesCompleted: string[];
  checksumExpected: string | null;
  checksumActual: string | null;
  failureReason: string | null;
  correlationId: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  transitionCount?: number;
}

export interface RetentionEvaluation {
  id: string;
  tenantId: string;
  evaluatedAt: string;
  policy: Record<string, unknown>;
  expiredSnapshotIds: string[];
  orphanedSnapshotIds: string[];
  retainedSnapshotIds: string[];
  legalHoldSnapshotIds: string[];
  correlationId: string;
  details: Record<string, unknown>;
}

export interface CleanupPlan {
  id: string;
  tenantId: string;
  createdAt: string;
  priority: string;
  estimatedReclaimedBytes: number;
  executed: boolean;
  itemCount: number;
  items: Array<{ snapshotId: string; reason: string; estimatedBytes: number }>;
  correlationId: string;
}

export interface RecoveryPoint {
  id: string;
  snapshotId: string;
  label: string | null;
  capturedAt: string;
  verified: boolean;
  verificationStatus: string;
  expiresAt: string | null;
  restoreAvailable: boolean;
  sizeBytes: number | null;
  typeId: string;
}

export interface RestoreResult {
  id: string;
  tenantId: string;
  jobId: string;
  snapshotId: string;
  recoveryPointId: string | null;
  restoreMode: 'drill' | 'controlled';
  target: Record<string, unknown>;
  status: string;
  objectsRestored: number;
  bytesRestored: number;
  warnings: string[];
  validation: { valid: boolean; reasons: string[] };
  durationMs: number | null;
  failureReason: string | null;
  correlationId: string;
  createdAt: string;
  completedAt: string | null;
}

export interface BackupRestoreHealth {
  ready: boolean;
  dormant: boolean;
  featureFlag: { name: string; enabled: boolean };
  flags: {
    centerEnabled: boolean;
    backupCenterEnabled: boolean;
    restoreEnabled: boolean;
    verifyEnabled: boolean;
    schedulerEnabled: boolean;
  };
  jobEngine: {
    ready: boolean;
    repositoryReady: boolean;
    configurationReady: boolean;
    featureFlagsReady: boolean;
    jobsByStatus: Record<string, number>;
  };
  backupEngine: Record<string, unknown>;
  verificationEngine: Record<string, unknown>;
  retentionEngine: Record<string, unknown>;
  restoreEngine: Record<string, unknown>;
  queue: { name: string; wired: boolean };
  worker: { wired: boolean; status: string };
  scheduler: { wired: boolean; status: string };
  effectiveView: {
    visible: boolean;
    types: number;
    allowBackupRestore: boolean;
    featureEnabled: boolean;
  };
  licensing: {
    tenantGate: string;
    capabilities: string[];
  };
  phase: string;
}

function authOpts(token: string, tenantId: string) {
  return { token, tenantId };
}

export async function fetchBackupRestoreCatalog(token: string, tenantId: string) {
  return apiRequest<{ catalog: EffectiveBackupRestoreView; types: StaticCatalogEntry[] }>(
    '/backup-restore/catalog',
    authOpts(token, tenantId),
  );
}

export async function fetchBackupRestoreHealth(token: string, tenantId: string) {
  return apiRequest<BackupRestoreHealth>('/backup-restore/health', authOpts(token, tenantId));
}

export async function listBackupRestoreJobs(
  token: string,
  tenantId: string,
  params: { kind?: BackupRestoreJobKind; status?: BackupRestoreJobStatus; limit?: number; offset?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.kind) q.set('kind', params.kind);
  if (params.status) q.set('status', params.status);
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  const qs = q.toString();
  return apiRequest<{ jobs: BackupRestoreJob[] }>(
    `/backup-restore/jobs${qs ? `?${qs}` : ''}`,
    authOpts(token, tenantId),
  );
}

export async function fetchBackupRestoreJob(token: string, tenantId: string, jobId: string) {
  return apiRequest<{ job: BackupRestoreJob }>(`/backup-restore/jobs/${jobId}`, authOpts(token, tenantId));
}

export async function cancelBackupRestoreJob(token: string, tenantId: string, jobId: string) {
  return apiRequest<{ job: BackupRestoreJob }>(`/backup-restore/jobs/${jobId}/cancel`, {
    ...authOpts(token, tenantId),
    method: 'POST',
  });
}

export async function createBackup(
  token: string,
  tenantId: string,
  body: {
    typeId: string;
    targetId?: string;
    description?: string;
    compression?: string;
    encryptionClass?: string;
    idempotencyKey?: string;
  },
) {
  return apiRequest<{ job: BackupRestoreJob; snapshot?: BackupSnapshot; result?: unknown }>(
    '/backup-restore/backups',
    {
      ...authOpts(token, tenantId),
      method: 'POST',
      body,
      headers: body.idempotencyKey ? { 'idempotency-key': body.idempotencyKey } : undefined,
    },
  );
}

export async function createRestore(
  token: string,
  tenantId: string,
  body: {
    typeId: string;
    snapshotId: string;
    restoreMode: 'drill' | 'controlled';
    restoreTargetKind?: string;
    recoveryPointId?: string;
    approvedByUserId?: string;
    idempotencyKey?: string;
  },
) {
  return apiRequest<{ job: BackupRestoreJob; result?: RestoreResult }>('/backup-restore/restores', {
    ...authOpts(token, tenantId),
    method: 'POST',
    body,
    headers: body.idempotencyKey ? { 'idempotency-key': body.idempotencyKey } : undefined,
  });
}

export async function listSnapshots(token: string, tenantId: string) {
  return apiRequest<{ snapshots: BackupSnapshot[] }>('/backup-restore/snapshots', authOpts(token, tenantId));
}

export async function fetchSnapshot(token: string, tenantId: string, snapshotId: string) {
  return apiRequest<{ snapshot: BackupSnapshot }>(
    `/backup-restore/snapshots/${snapshotId}`,
    authOpts(token, tenantId),
  );
}

export async function listVerificationResults(token: string, tenantId: string) {
  return apiRequest<{ results: VerificationResult[] }>('/backup-restore/verification', authOpts(token, tenantId));
}

export async function listRetention(token: string, tenantId: string) {
  return apiRequest<{ evaluations: RetentionEvaluation[]; cleanupPlans: CleanupPlan[] }>(
    '/backup-restore/retention',
    authOpts(token, tenantId),
  );
}

export async function listRecoveryPoints(token: string, tenantId: string) {
  return apiRequest<{ recoveryPoints: RecoveryPoint[] }>(
    '/backup-restore/recovery-points',
    authOpts(token, tenantId),
  );
}
