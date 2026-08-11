/**
 * Flexible Step 26 — productivity metrics + commission snapshot review types.
 * Commission rates are intentionally unconfigured; never invent amounts.
 */

export type Completeness =
  | 'COMPLETE'
  | 'PARTIAL'
  | 'UNAVAILABLE'
  | 'NOT_APPLICABLE';

export type CommissionSnapshotStatus = 'DRAFT' | 'FINALIZED' | 'SUPERSEDED';
export type CommissionReviewStatus = 'NONE' | 'IN_REVIEW' | 'REVIEWED' | 'REJECTED';
export type CommissionPaidStatus = 'UNPAID' | 'PAID';
export type CommissionCalculationStatus = 'UNCONFIGURED';

export type MetricId =
  | 'M01'
  | 'M02'
  | 'M03'
  | 'M04'
  | 'M05'
  | 'M06'
  | 'M07'
  | 'M08'
  | 'M09'
  | 'M10'
  | 'M11'
  | 'M12'
  | 'M13'
  | 'M14'
  | 'M15'
  | 'M16'
  | 'M17'
  | 'M18'
  | 'M19'
  | 'M20';

export type MetricKey =
  | 'leads_created'
  | 'activities'
  | 'demos_scheduled'
  | 'demos_completed'
  | 'trials_created'
  | 'won'
  | 'lost'
  | 'paid_conversions'
  | 'lead_to_won_rate'
  | 'trial_to_paid_rate'
  | 'time_to_convert_days'
  | 'active_customers'
  | 'cancellations'
  | 'plan_version_mix'
  | 'addon_sales'
  | 'target_progress'
  | 'converted_customers'
  | 'cancellation_attribution'
  | 'period_source_completeness'
  | 'reporting_completeness';

export interface MetricValue {
  id: MetricId;
  key: MetricKey;
  value: number | null;
  completeness: Completeness;
  numerator?: number | null;
  denominator?: number | null;
  explanation?: string | null;
  rankingEligible: boolean;
}

export interface PlanVersionAttribution {
  planVersionId: string;
  count: number;
}

export interface AddOnAttribution {
  addOnVersionId: string;
  count: number;
  basis: 'assignment_created' | 'conversion_disposition_migrate' | 'conversion_disposition_retain';
}

export interface CancellationAttribution {
  count: number;
  basis: 'ownership_at_cancel_history' | 'current_ownership_partial';
  completeness: Completeness;
}

export interface CompletenessBundle {
  metrics: Record<MetricKey, Completeness>;
  period_source_completeness: Completeness;
  reporting_completeness: Completeness;
  notes?: string[];
}

export interface ProductivityMetricsBundle {
  representativeId: string;
  periodKey: string;
  periodTimezone: string;
  periodStart: string;
  periodEnd: string;
  sourceCutoffAt: string;
  metrics: MetricValue[];
  metricsByKey: Record<MetricKey, MetricValue>;
  planVersionAttribution: PlanVersionAttribution[];
  addOnAttribution: AddOnAttribution[];
  cancellationAttribution: CancellationAttribution;
  completeness: CompletenessBundle;
}

export interface CommissionSnapshotDto {
  id: string;
  representativeId: string;
  periodKey: string;
  periodTimezone: string;
  periodStart: string;
  periodEnd: string;
  sourceCutoffAt: string;
  formulaVersion: string;
  calculationStatus: CommissionCalculationStatus;
  ruleReference: string | null;
  computedAmount: string | null;
  metrics: Record<string, unknown>;
  planVersionAttribution: PlanVersionAttribution[];
  addOnAttribution: AddOnAttribution[];
  completeness: CompletenessBundle;
  reconciliation: Record<string, unknown> | null;
  reviewStatus: CommissionReviewStatus;
  paidStatus: CommissionPaidStatus;
  paidReason: string | null;
  paidReference: string | null;
  paidAt: string | null;
  paidByPlatformUserId: string | null;
  status: CommissionSnapshotStatus;
  supersedesSnapshotId: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
}

export type ProductivityVisibilityScope =
  | { kind: 'all' }
  | { kind: 'team'; representativeIds: string[] }
  | { kind: 'own'; representativeId: string }
  | { kind: 'none' };
