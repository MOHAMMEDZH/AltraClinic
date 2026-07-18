export type AiPromptCategoryId =
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

export interface AiPromptCategoryDef {
  id: AiPromptCategoryId;
  labelKey: string;
  roles: string[];
}

export const AI_PROMPT_CATEGORIES: AiPromptCategoryDef[] = [
  { id: 'medical', labelKey: 'ai.context.modules.emr', roles: ['doctor', 'nurse', 'specialist', 'owner', 'general_manager'] },
  { id: 'dental', labelKey: 'ai.context.modules.dental', roles: ['dentist', 'doctor', 'owner', 'general_manager'] },
  { id: 'beauty', labelKey: 'ai.context.modules.beauty', roles: ['specialist', 'doctor', 'owner', 'general_manager'] },
  { id: 'reception', labelKey: 'ai.context.modules.scheduling', roles: ['receptionist', 'assistant', 'owner', 'general_manager'] },
  { id: 'billing', labelKey: 'ai.context.modules.billing', roles: ['accountant', 'cashier', 'owner', 'general_manager'] },
  { id: 'inventory', labelKey: 'ai.context.modules.inventory', roles: ['inventory_manager', 'owner', 'general_manager'] },
  { id: 'analytics', labelKey: 'ai.context.modules.analytics', roles: ['owner', 'general_manager', 'branch_manager'] },
  { id: 'workflow', labelKey: 'ai.context.modules.workflow', roles: ['owner', 'general_manager', 'branch_manager'] },
  { id: 'reporting', labelKey: 'ai.context.modules.reporting', roles: ['owner', 'general_manager', 'accountant'] },
  { id: 'management', labelKey: 'ai.workspaces.management', roles: ['owner', 'general_manager', 'branch_manager'] },
  { id: 'admin', labelKey: 'ai.workspaces.superAdmin', roles: ['owner', 'general_manager', 'super_admin'] },
];

export function isAiPromptCategory(value: string): value is AiPromptCategoryId {
  return AI_PROMPT_CATEGORIES.some((c) => c.id === value);
}
