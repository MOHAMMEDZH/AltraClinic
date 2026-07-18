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
}

export const AI_PROMPT_CATEGORIES: AiPromptCategoryDef[] = [
  { id: 'medical', labelKey: 'ai.context.modules.emr' },
  { id: 'dental', labelKey: 'ai.context.modules.dental' },
  { id: 'beauty', labelKey: 'ai.context.modules.beauty' },
  { id: 'reception', labelKey: 'ai.context.modules.scheduling' },
  { id: 'billing', labelKey: 'ai.context.modules.billing' },
  { id: 'inventory', labelKey: 'ai.context.modules.inventory' },
  { id: 'analytics', labelKey: 'ai.context.modules.analytics' },
  { id: 'workflow', labelKey: 'ai.context.modules.workflow' },
  { id: 'reporting', labelKey: 'ai.context.modules.reporting' },
  { id: 'management', labelKey: 'ai.workspaces.management' },
  { id: 'admin', labelKey: 'ai.workspaces.superAdmin' },
];

export const AI_PROMPT_ROLE_OPTIONS = [
  'owner',
  'general_manager',
  'branch_manager',
  'doctor',
  'dentist',
  'nurse',
  'specialist',
  'receptionist',
  'accountant',
  'cashier',
  'inventory_manager',
] as const;
