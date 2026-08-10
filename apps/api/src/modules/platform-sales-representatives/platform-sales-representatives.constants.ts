/**
 * Flexible Step 23 — Sales Representative Management constants.
 * Contract: docs/SALES_REPRESENTATIVE_MANAGEMENT.md
 */

export const SALES_REP_PERMISSIONS = {
  view: 'sales-representative.view',
  manage: 'sales-representative.manage',
} as const;

/** Only this role may be assigned through the sales-manage administration path (frozen). */
export const SALES_MANAGE_GRANTABLE_ROLE_KEYS = ['sales_representative'] as const;

/** Audit event catalog — A01..A16 (contract §10). Exact cardinality on success; no invented audits on failure/replay. */
export const SALES_AUDIT_ACTIONS = {
  A01_CREATED: 'sales_representative.created',
  A02_PROFILE_UPDATED: 'sales_representative.profile_updated',
  A03_REGION_UPDATED: 'sales_representative.region_updated',
  A04_TERRITORY_UPDATED: 'sales_representative.territory_updated',
  A05_MANAGER_ASSIGNED: 'sales_representative.manager_assigned',
  A06_MANAGER_REASSIGNED: 'sales_representative.manager_reassigned',
  A07_TARGET_UPDATED: 'sales_representative.target_updated',
  A08_ROLE_ASSIGNED: 'sales_representative.role_assigned',
  A09_ROLE_REMOVED: 'sales_representative.role_removed',
  A10_ACTIVATED: 'sales_representative.activated',
  A11_SUSPENDED: 'sales_representative.suspended',
  A12_REACTIVATED: 'sales_representative.reactivated',
  A13_SESSIONS_REVOKED: 'sales_representative.sessions_revoked',
  A14_OWNERSHIP_ASSIGNED: 'sales_representative.ownership_assigned',
  A15_OWNERSHIP_REASSIGNED: 'sales_representative.ownership_reassigned',
  A16_OWNERSHIP_REMOVED: 'sales_representative.ownership_removed',
} as const;

export type SalesAuditAction = (typeof SALES_AUDIT_ACTIONS)[keyof typeof SALES_AUDIT_ACTIONS];

export const SALES_AUDIT_CATEGORY = 'sales_representative_management';
export const SALES_AUDIT_RESOURCE_TYPE = 'platform_sales_representative';
export const SALES_OWNERSHIP_AUDIT_RESOURCE_TYPE = 'platform_sales_customer_ownership';

/** Test-only failure-injection selectors (Model B). NODE_ENV==='test' AND exact match only. Never documented for deployment. */
export const SALES_FAILURE_INJECTION_ENV = 'SALES_REPRESENTATIVES_FAILURE_INJECTION';

export const SALES_FAILURE_INJECTION_POINTS = [
  'before_commit',
  'after_idempotency_claim',
  'after_audit_staging_before_commit',
  'after_commit_before_response',
  'source_state_validation',
  'role_assignment',
  'manager_cycle_check',
  'ownership_assignment',
  'ownership_tenant_lookup',
  'step_up_validation',
  'suspend_session_revocation',
  'invitation_delivery',
  'password_hash',
  'occ_conflict',
  'idempotency_claim_race',
] as const;

export type SalesFailureInjectionPoint = (typeof SALES_FAILURE_INJECTION_POINTS)[number];

export function isSalesFailureInjectionActive(point: SalesFailureInjectionPoint | string): boolean {
  if (process.env.NODE_ENV !== 'test') return false;
  if (!(SALES_FAILURE_INJECTION_POINTS as readonly string[]).includes(point)) return false;
  return process.env[SALES_FAILURE_INJECTION_ENV] === point;
}

export const SALES_IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const SALES_MAX_MANAGER_CHAIN_DEPTH = 64;
