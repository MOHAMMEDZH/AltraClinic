export type NormalizedOpsStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNHEALTHY'
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'RETRYABLE'
  | 'NON_RETRYABLE'
  | 'STALE'
  | 'UNKNOWN'
  | 'DISABLED';

export class OpsConsoleError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'OpsConsoleError';
  }
}

export type OpsSourceCard = {
  id: string;
  title: string;
  sourceStatus: string | null;
  normalizedStatus: NormalizedOpsStatus;
  sourceTimestamp: string | null;
  stale: boolean;
  correlationId: string | null;
  message: string | null;
  retryable: boolean;
};

export type OpsOverviewDto = {
  generatedAt: string;
  cards: OpsSourceCard[];
};

export type OpsHealthDto = {
  generatedAt: string;
  probes: OpsSourceCard[];
};

export type OpsJobRow = {
  ref: string;
  jobType: string;
  sourceQueue: string | null;
  sourceStatus: string | null;
  normalizedStatus: NormalizedOpsStatus;
  attempts: number | null;
  maxAttempts: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  nextRetryAt: string | null;
  retryable: boolean;
  stale: boolean;
  failureCategory: string | null;
  correlationId: string | null;
  tenantSummary: string | null;
};

export type OpsJobListDto = {
  items: OpsJobRow[];
  nextCursor: string | null;
};

export type OpsProvisioningRow = {
  requestId: string;
  tenantId: string | null;
  status: string;
  normalizedStatus: NormalizedOpsStatus;
  step: string | null;
  lastTransitionAt: string | null;
  attemptCount: number | null;
  failureCode: string | null;
  retryable: boolean;
  rowVersion: number;
  correlationId: string | null;
  stale: boolean;
};

export type OpsExpiryRow = {
  id: string;
  kind: 'subscription' | 'override';
  tenantId: string | null;
  expiresAt: string | null;
  state: string | null;
  jobSorStatus: 'DISABLED';
  normalizedStatus: NormalizedOpsStatus;
  correlationId: string | null;
  note: string;
};

export type OpsEntitlementHealthDto = {
  generatedAt: string;
  /** Process-local EER Map only — never claim global distributed cache health. */
  cacheTopology: 'process_local';
  localResolverHealth: NormalizedOpsStatus;
  localCacheAdapterStatus: NormalizedOpsStatus;
  thisInstanceLastInvalidationAt: string | null;
  /** Global invalidation mechanism evidence; UNKNOWN when no distributed SoR. */
  globalInvalidationHealth: NormalizedOpsStatus;
  invalidationBacklogCount: number | null;
  killSwitchOperational: NormalizedOpsStatus;
  note: string | null;
  /** @deprecated use local* fields — retained for brief UI compatibility */
  resolverHealth: NormalizedOpsStatus;
  cacheHealth: NormalizedOpsStatus;
  lastInvalidationAt: string | null;
  backlogCount: number | null;
};

export type OpsCompatibilityDto = {
  generatedAt: string;
  catalogItems: number;
  catalogTranslations: number;
  catalogAliases: number;
  catalogCompatibilityRules: number;
  catalogIdentityOk: boolean;
  validatorJobStatus: 'DISABLED' | 'UNKNOWN';
  normalizedStatus: NormalizedOpsStatus;
  note: string;
};

export type OpsIntegrationRow = {
  type: string;
  enabled: boolean;
  /** enabled | disabled — configuration enablement only */
  enabledState: 'enabled' | 'disabled';
  /** valid | invalid | unknown */
  configurationState: 'valid' | 'invalid' | 'unknown' | 'not_applicable';
  /** I-A wired SoR | I-B known absent | I-C unreachable */
  classification: 'I-A' | 'I-B' | 'I-C';
  sourceStatus: string | null;
  /** Runtime health — NEVER HEALTHY from enablement/config alone */
  runtimeHealth: NormalizedOpsStatus;
  /** @deprecated use runtimeHealth — retained briefly for UI compatibility */
  normalizedStatus: NormalizedOpsStatus;
  queueHealth: NormalizedOpsStatus | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  failureCategory: string | null;
  retryable: boolean;
  stale: boolean;
  correlationId: string | null;
};

export type OpsBackupRow = {
  ref: string;
  category: string | null;
  /** B-A metadata SoR | B-B absent | B-C request capability (not exposed in Step 22 UI) */
  classification: 'B-A' | 'B-B' | 'B-C';
  status: string | null;
  normalizedStatus: NormalizedOpsStatus;
  startedAt: string | null;
  endedAt: string | null;
  verificationState: string | null;
  retentionCategory: string | null;
  failureCategory: string | null;
  stale: boolean;
  correlationId: string | null;
  /** Always false in Step 22 responses — storage paths redacted. */
  storagePathExposed: false;
};

export type OpsActionResult = {
  accepted: boolean;
  replayed: boolean;
  action: string;
  targetId: string;
  correlationId: string;
  result: string;
  sourceEffect: string;
};
