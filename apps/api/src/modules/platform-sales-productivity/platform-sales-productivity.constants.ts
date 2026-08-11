/**
 * Flexible Step 26 — Sales Productivity and Commission Snapshot constants.
 * Contract: docs/SALES_PRODUCTIVITY_AND_COMMISSION_SNAPSHOT.md
 */

export const SALES_PRODUCTIVITY_PERMISSIONS = {
  reportView: 'sales-report.view',
  reportExport: 'sales-report.export',
  snapshotView: 'commission-snapshot.view',
  snapshotReview: 'commission-snapshot.review',
  snapshotGenerate: 'commission-snapshot.generate',
  snapshotMarkPaid: 'commission-snapshot.mark-paid',
  representativeManage: 'sales-representative.manage',
} as const;

export const SALES_COMMISSION_AUDIT_ACTIONS = {
  GENERATED: 'sales_commission.generated',
  FINALIZED: 'sales_commission.finalized',
  SUPERSEDED: 'sales_commission.superseded',
  REVIEWED: 'sales_commission.reviewed',
  MARKED_PAID: 'sales_commission.marked_paid',
  EXPORTED: 'sales_commission.exported',
} as const;

export type SalesCommissionAuditAction =
  (typeof SALES_COMMISSION_AUDIT_ACTIONS)[keyof typeof SALES_COMMISSION_AUDIT_ACTIONS];

export const SALES_COMMISSION_AUDIT_CATEGORY = 'sales_commission_management';
export const SALES_COMMISSION_AUDIT_RESOURCE_TYPE = 'platform_sales_commission_snapshot';

export const SALES_COMMISSION_IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Durable idempotency operation namespaces (shared `platform_sales_idempotency` store). */
export const SALES_COMMISSION_OPERATIONS = {
  generate: 'sales_commission.generate',
  review: 'sales_commission.review',
  markPaid: 'sales_commission.mark_paid',
} as const;

/**
 * Frozen formula identity while rates remain unconfigured.
 * Never invent commission amounts; calculationStatus stays UNCONFIGURED.
 */
export const COMMISSION_FORMULA_VERSION = 'step26.unconfigured.v1';

export const DEFAULT_PERIOD_TIMEZONE = 'UTC';

/** Test-only failure-injection selectors (Model B). NODE_ENV==='test' AND exact match only. */
export const SALES_PRODUCTIVITY_FAILURE_INJECTION_ENV = 'SALES_PRODUCTIVITY_FAILURE_INJECTION';

export const SALES_PRODUCTIVITY_FAILURE_INJECTION_POINTS = [
  'after_idempotency_claim',
  'after_metrics_compute',
  'after_snapshot_insert',
  'after_audit_staging_before_commit',
  'before_commit',
  'after_commit_before_response',
  'occ_conflict',
  'idempotency_claim_race',
  'visibility_deny',
  'mark_paid_side_effect_guard',
] as const;

export type SalesProductivityFailureInjectionPoint =
  (typeof SALES_PRODUCTIVITY_FAILURE_INJECTION_POINTS)[number];

export function isSalesProductivityFailureInjectionActive(
  point: SalesProductivityFailureInjectionPoint | string,
): boolean {
  if (process.env.NODE_ENV !== 'test') return false;
  if (!(SALES_PRODUCTIVITY_FAILURE_INJECTION_POINTS as readonly string[]).includes(point)) {
    return false;
  }
  return process.env[SALES_PRODUCTIVITY_FAILURE_INJECTION_ENV] === point;
}
