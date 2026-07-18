import { SubscriptionPlanType } from '../../../subscription/domain/value-objects/subscription-plan.vo';
import { UNLIMITED } from '../../../subscription/domain/config/plan-limits.config';

export type AiWorkspaceFeature =
  | 'chat'
  | 'medical'
  | 'dental'
  | 'beauty'
  | 'reception'
  | 'billing'
  | 'inventory'
  | 'analytics'
  | 'workflow'
  | 'reporting'
  | 'management'
  | 'admin';

export interface AiPlanLimits {
  planName: SubscriptionPlanType;
  /** Max inference requests per user per UTC day. */
  maxMessagesPerUserPerDay: number;
  /** Max tokens consumed tenant-wide per UTC day. */
  maxTokensPerTenantPerDay: number;
  /** Max inference requests per user per minute (burst protection). */
  maxRequestsPerMinute: number;
  /** Whether file/image attachments are allowed in chat. */
  attachmentsEnabled: boolean;
  /** Legacy flag — external LLMs are off when AI_BUILTIN_ONLY is true (default). */
  externalProvidersEnabled: boolean;
  /** Workspace features included in this plan. */
  workspaces: AiWorkspaceFeature[] | 'all';
  /** Whether users can create/edit custom prompt library entries. */
  customPromptsEnabled: boolean;
}

const LITE_AI: AiPlanLimits = {
  planName: 'lite',
  maxMessagesPerUserPerDay: 25,
  maxTokensPerTenantPerDay: 50_000,
  maxRequestsPerMinute: 5,
  attachmentsEnabled: false,
  externalProvidersEnabled: false,
  workspaces: ['chat'],
  customPromptsEnabled: false,
};

const PRO_AI: AiPlanLimits = {
  planName: 'pro',
  maxMessagesPerUserPerDay: 100,
  maxTokensPerTenantPerDay: 250_000,
  maxRequestsPerMinute: 15,
  attachmentsEnabled: true,
  externalProvidersEnabled: true,
  workspaces: ['chat', 'medical', 'dental', 'beauty', 'reporting'],
  customPromptsEnabled: false,
};

/** Extended tier alias used by some tenants (maps to business UI tier). */
export const BUSINESS_AI: AiPlanLimits = {
  planName: 'pro',
  maxMessagesPerUserPerDay: 200,
  maxTokensPerTenantPerDay: 500_000,
  maxRequestsPerMinute: 30,
  attachmentsEnabled: true,
  externalProvidersEnabled: true,
  workspaces: [
    'chat',
    'medical',
    'dental',
    'beauty',
    'reception',
    'billing',
    'inventory',
    'analytics',
    'workflow',
    'reporting',
    'management',
  ],
  customPromptsEnabled: false,
};

const ENTERPRISE_AI: AiPlanLimits = {
  planName: 'enterprise',
  maxMessagesPerUserPerDay: UNLIMITED,
  maxTokensPerTenantPerDay: UNLIMITED,
  maxRequestsPerMinute: 60,
  attachmentsEnabled: true,
  externalProvidersEnabled: true,
  workspaces: 'all',
  customPromptsEnabled: true,
};

export const AI_PLAN_LIMITS: Record<SubscriptionPlanType, AiPlanLimits> = {
  lite: LITE_AI,
  pro: PRO_AI,
  enterprise: ENTERPRISE_AI,
};

export function getAiPlanLimits(planName: SubscriptionPlanType): AiPlanLimits {
  return AI_PLAN_LIMITS[planName] ?? LITE_AI;
}

export function resolveAiPlanLimits(rawPlanName?: string | null, canonical?: SubscriptionPlanType): AiPlanLimits {
  const normalized = String(rawPlanName ?? canonical ?? 'lite').trim().toLowerCase();
  if (normalized === 'business') return BUSINESS_AI;
  if (canonical) return getAiPlanLimits(canonical);
  const alias: Record<string, SubscriptionPlanType> = {
    lite: 'lite',
    pro: 'pro',
    professional: 'pro',
    enterprise: 'enterprise',
    basic: 'lite',
    standard: 'pro',
    premium: 'enterprise',
  };
  return getAiPlanLimits(alias[normalized] ?? 'lite');
}

export function workspaceToAiFeature(workspaceId: string | null | undefined): AiWorkspaceFeature {
  const map: Record<string, AiWorkspaceFeature> = {
    medical: 'medical',
    dental: 'dental',
    beauty: 'beauty',
    reception: 'reception',
    billing: 'billing',
    inventory: 'inventory',
    analytics: 'analytics',
    workflow: 'workflow',
    reporting: 'reporting',
    management: 'management',
    super_admin: 'admin',
  };
  if (!workspaceId) return 'chat';
  return map[workspaceId] ?? 'chat';
}

export function aiWorkspaceAllowed(limits: AiPlanLimits, workspaceId: string | null | undefined): boolean {
  if (limits.workspaces === 'all') return true;
  return limits.workspaces.includes(workspaceToAiFeature(workspaceId));
}
