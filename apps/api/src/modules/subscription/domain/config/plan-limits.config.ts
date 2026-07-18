import { SubscriptionPlanType } from '../value-objects/subscription-plan.vo';

/** Sentinel: -1 means unlimited. */
export const UNLIMITED = -1;

export interface PlanFeatures {
  /** AI model creation, validation, deployment */
  aiModels: boolean;
  /** Analytics dashboards + advanced reports */
  advancedAnalytics: boolean;
  /** Loyalty program: accounts, points, rewards */
  loyaltyProgram: boolean;
  /** Custom multi-step workflows */
  customWorkflows: boolean;
  /** Multi-currency invoicing */
  multiCurrency: boolean;
  /** Patient portal caregiver delegation */
  caregiverAccess: boolean;
  /** Commission rules management */
  commissionRules: boolean;
  /** Audit log export */
  auditExport: boolean;
  /** SMS staff invitations */
  smsInvites: boolean;
}

export interface PlanLimits {
  planName: SubscriptionPlanType;
  /** Max staff users (non-patient roles). -1 = unlimited. */
  maxUsers: number;
  /** Max users with doctor / dentist / specialist roles. -1 = unlimited. */
  maxDoctors: number;
  /** Max active branches. -1 = unlimited. */
  maxBranches: number;
  /** Max patient records. -1 = unlimited. */
  maxPatients: number;
  /** Max appointments created per calendar month. -1 = unlimited. */
  maxAppointmentsPerMonth: number;
  /** Max reports requested per calendar month. -1 = unlimited. */
  maxReportsPerMonth: number;
  /** Max storage in gigabytes. -1 = unlimited. */
  maxStorageGb: number;
  /** Max API requests per day (across all endpoints). -1 = unlimited. */
  maxApiRequestsPerDay: number;
  /** Max outbound emails per calendar month. -1 = unlimited. */
  maxEmailPerMonth: number;
  /** Max outbound SMS per calendar month. -1 = unlimited. */
  maxSmsPerMonth: number;
  /** Max outbound WhatsApp messages per calendar month. -1 = unlimited. */
  maxWhatsappPerMonth: number;
  /** Max push notifications per calendar month. -1 = unlimited. */
  maxPushPerMonth: number;
  /** Feature flags included in this plan. */
  features: PlanFeatures;
}

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

const LITE: PlanLimits = {
  planName: 'lite',
  maxUsers: 10,
  maxDoctors: 3,
  maxBranches: 1,
  maxPatients: 1_000,
  maxAppointmentsPerMonth: 500,
  maxReportsPerMonth: 10,
  maxStorageGb: 5,
  maxApiRequestsPerDay: 1_000,
  maxEmailPerMonth: 200,
  maxSmsPerMonth: 20,
  maxWhatsappPerMonth: 0,
  maxPushPerMonth: 500,
  features: {
    aiModels: false,
    advancedAnalytics: false,
    loyaltyProgram: false,
    customWorkflows: false,
    multiCurrency: false,
    caregiverAccess: false,
    commissionRules: false,
    auditExport: false,
    smsInvites: false,
  },
};

const PRO: PlanLimits = {
  planName: 'pro',
  maxUsers: 50,
  maxDoctors: 20,
  maxBranches: 5,
  maxPatients: 10_000,
  maxAppointmentsPerMonth: 5_000,
  maxReportsPerMonth: 100,
  maxStorageGb: 50,
  maxApiRequestsPerDay: 10_000,
  maxEmailPerMonth: 2_000,
  maxSmsPerMonth: 200,
  maxWhatsappPerMonth: 100,
  maxPushPerMonth: 5_000,
  features: {
    aiModels: false,
    advancedAnalytics: true,
    loyaltyProgram: true,
    customWorkflows: true,
    multiCurrency: false,
    caregiverAccess: true,
    commissionRules: true,
    auditExport: true,
    smsInvites: true,
  },
};

const ENTERPRISE: PlanLimits = {
  planName: 'enterprise',
  maxUsers: UNLIMITED,
  maxDoctors: UNLIMITED,
  maxBranches: UNLIMITED,
  maxPatients: UNLIMITED,
  maxAppointmentsPerMonth: UNLIMITED,
  maxReportsPerMonth: UNLIMITED,
  maxStorageGb: UNLIMITED,
  maxApiRequestsPerDay: UNLIMITED,
  maxEmailPerMonth: UNLIMITED,
  maxSmsPerMonth: UNLIMITED,
  maxWhatsappPerMonth: UNLIMITED,
  maxPushPerMonth: UNLIMITED,
  features: {
    aiModels: true,
    advancedAnalytics: true,
    loyaltyProgram: true,
    customWorkflows: true,
    multiCurrency: true,
    caregiverAccess: true,
    commissionRules: true,
    auditExport: true,
    smsInvites: true,
  },
};

export const PLAN_LIMITS: Record<SubscriptionPlanType, PlanLimits> = {
  lite: LITE,
  pro: PRO,
  enterprise: ENTERPRISE,
};

/** Maps legacy plan names stored in the DB to canonical plan names. */
const PLAN_NAME_ALIASES: Record<string, SubscriptionPlanType> = {
  lite:       'lite',
  pro:        'pro',
  enterprise: 'enterprise',
  // Legacy names written before the Lite/Pro/Enterprise rename
  basic:      'lite',
  standard:   'pro',
  premium:    'enterprise',
};

/**
 * Returns the plan limits for the given plan name.
 * Handles legacy aliases (basic → lite, standard → pro, premium → enterprise).
 * Defaults to `lite` (most restrictive) when the plan is unknown.
 */
export function getPlanLimits(planName: string): PlanLimits {
  const canonical = PLAN_NAME_ALIASES[String(planName ?? '').trim().toLowerCase()];
  return PLAN_LIMITS[canonical] ?? PLAN_LIMITS.lite;
}
