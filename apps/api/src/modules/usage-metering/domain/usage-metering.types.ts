/** Supplemental Capability U01 — Usage Metering typed contracts. */

export type UsageValueType = 'integer' | 'decimal';
export type UsageAggregation = 'gauge' | 'sum';
export type UsagePeriodType = 'LIFETIME' | 'CALENDAR_MONTH';
export type UsageEnforcementMode = 'INFORMATIONAL' | 'WARNING' | 'SOFT' | 'HARD';
export type UsageReconciliationMode = 'LIVE_AGGREGATE' | 'LEDGER_PROJECTION';
export type UsageRetentionClass = 'OPERATIONAL_90D';
export type UsagePrivacyClass = 'OPERATIONAL_AGGREGATE';

export type UsageObservationOperation = 'INCREMENT' | 'DECREMENT' | 'SET' | 'RECONCILE' | 'RESERVE' | 'RELEASE';

export type UsageDriftClass =
  | 'IN_SYNC'
  | 'DRIFT_WARNING'
  | 'DRIFT_CORRECTABLE'
  | 'DRIFT_BLOCKED'
  | 'SOURCE_UNAVAILABLE';

export type UsageStaleClass = 'FRESH' | 'STALE' | 'SOURCE_UNAVAILABLE';
export type UsageSourceClass = 'OBSERVATION' | 'RECONCILE' | 'RESERVATION' | 'AGGREGATE';

export type UsageMeterDefinition = {
  meterKey: string;
  limitKey: string;
  valueType: UsageValueType;
  aggregation: UsageAggregation;
  periodType: UsagePeriodType;
  enforcementMode: UsageEnforcementMode;
  sourceOwner: string;
  reconciliationMode: UsageReconciliationMode;
  retentionClass: UsageRetentionClass;
  privacyClass: UsagePrivacyClass;
};

export type UsageObservationInput = {
  observationId?: string;
  tenantId: string;
  meterKey: string;
  operation: UsageObservationOperation;
  value: string;
  occurredAt: string;
  source: string;
  sourceEventId: string;
  schemaVersion: string;
  correlationId?: string;
};

export type UsagePeriodBounds = {
  periodType: UsagePeriodType;
  periodStart: Date;
  periodEnd: Date;
  usageMonth?: string;
};

export type UsageEnforcementDecision = {
  allowed: boolean;
  code: string;
  meterKey: string;
  limitKey: string;
  enforcementMode: UsageEnforcementMode;
  limitState: 'CONFIGURED' | 'UNLIMITED' | 'UNCONFIGURED';
  currentValue: string;
  projectedValue: string;
  limitValue?: string;
  thresholdState?: 'ok' | 'warning' | 'exceeded';
  staleClass: UsageStaleClass;
  evaluatedAt: string;
  notes?: string[];
};

export type UsageMeterProjection = {
  meterKey: string;
  limitKey: string;
  valueType: UsageValueType;
  periodType: UsagePeriodType;
  periodStart: string;
  periodEnd: string;
  currentValue: string;
  reservedValue: string;
  projectedValue: string;
  limitState: string;
  limitValue?: string;
  enforcementMode: UsageEnforcementMode;
  thresholdState?: string;
  staleClass: UsageStaleClass;
  driftClass?: UsageDriftClass;
  lastObservationAt?: string | null;
  lastReconciledAt?: string | null;
  privacyClass: UsagePrivacyClass;
};

export type UsageExplainProjection = UsageMeterProjection & {
  decision: UsageEnforcementDecision;
  sourceOwner: string;
  reconciliationMode: UsageReconciliationMode;
};

export class UsageMeteringError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number = 400,
  ) {
    super(message);
    this.name = 'UsageMeteringError';
  }
}
