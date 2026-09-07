/**
 * Flexible Step 24 — Leads and Sales Pipeline constants.
 * Contract: docs/LEADS_AND_SALES_PIPELINE.md
 */

export const SALES_LEAD_PERMISSIONS = {
  view: 'sales-lead.view',
  manage: 'sales-lead.manage',
  assign: 'sales-lead.assign',
} as const;

export const SALES_LEAD_AUDIT_ACTIONS = {
  CREATED: 'sales_lead.created',
  UPDATED: 'sales_lead.updated',
  STAGE_CHANGED: 'sales_lead.stage_changed',
  OWNER_ASSIGNED: 'sales_lead.owner_assigned',
  OWNER_REASSIGNED: 'sales_lead.owner_reassigned',
  NOTE_ADDED: 'sales_lead.note_added',
  DEMO_UPDATED: 'sales_lead.demo_updated',
  WON: 'sales_lead.won',
  LOST: 'sales_lead.lost',
} as const;

export type SalesLeadAuditAction =
  (typeof SALES_LEAD_AUDIT_ACTIONS)[keyof typeof SALES_LEAD_AUDIT_ACTIONS];

export const SALES_LEAD_AUDIT_CATEGORY = 'sales_pipeline_management';
export const SALES_LEAD_AUDIT_RESOURCE_TYPE = 'platform_sales_lead';

/** Test-only failure-injection selectors (Model B). NODE_ENV==='test' AND exact match only. */
export const SALES_LEADS_FAILURE_INJECTION_ENV = 'SALES_LEADS_FAILURE_INJECTION';

export const SALES_LEADS_FAILURE_INJECTION_POINTS = [
  'before_commit',
  'after_idempotency_claim',
  'after_audit_staging_before_commit',
  'after_commit_before_response',
  'source_state_validation',
  'stage_transition_validation',
  'owner_assign_validation',
  'note_sanitization',
  'plan_fit_evaluation',
  'occ_conflict',
  'idempotency_claim_race',
  'won_side_effect_guard',
] as const;

export type SalesLeadsFailureInjectionPoint =
  (typeof SALES_LEADS_FAILURE_INJECTION_POINTS)[number];

export function isSalesLeadsFailureInjectionActive(
  point: SalesLeadsFailureInjectionPoint | string,
): boolean {
  if (process.env.NODE_ENV !== 'test') return false;
  if (!(SALES_LEADS_FAILURE_INJECTION_POINTS as readonly string[]).includes(point)) return false;
  return process.env[SALES_LEADS_FAILURE_INJECTION_ENV] === point;
}

export const SALES_LEAD_IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export const LEAD_STAGE_PATH = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'DEMO_SCHEDULED',
  'PROPOSAL',
] as const;

export const LEAD_TERMINAL_STAGES = ['WON', 'LOST'] as const;

export const MAX_SPECIALTY_KEYS = 16;
export const MAX_DESIRED_MODULE_KEYS = 32;
export const MAX_NOTE_BODY_CHARS = 2000;
