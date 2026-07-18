import { hasPermission } from '@booking/permissions';

export type AiPermAction = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'export' | 'manage';

export function buildAiPermCheck(roles: string[]) {
  return (action: AiPermAction) => hasPermission(roles, 'api.ai', action);
}

export function canViewAi(perm: ReturnType<typeof buildAiPermCheck>) {
  return perm('view');
}

export function canCreateAiModels(perm: ReturnType<typeof buildAiPermCheck>) {
  return perm('create');
}

export function canApproveAiModels(perm: ReturnType<typeof buildAiPermCheck>) {
  return perm('approve');
}

export function canManageAi(perm: ReturnType<typeof buildAiPermCheck>) {
  return perm('manage');
}

export const AI_MODEL_TYPES = ['summary', 'search', 'insight', 'recommendation', 'prediction', 'assistant'] as const;
export type AiModelType = (typeof AI_MODEL_TYPES)[number];

export const AI_MODEL_STATUSES = ['draft', 'validated', 'deployed', 'retired'] as const;
export type AiModelStatus = (typeof AI_MODEL_STATUSES)[number];

export type AiWorkspaceId =
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
  | 'super_admin';

export type AiFeatureKey =
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
  | 'admin'
  | 'custom_prompts'
  | 'multi_model';
