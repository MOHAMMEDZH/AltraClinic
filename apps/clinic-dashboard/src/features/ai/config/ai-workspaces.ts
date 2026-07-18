import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Building2,
  FileBarChart,
  GitBranch,
  Package,
  Receipt,
  Shield,
  Smile,
  Sparkles,
  Stethoscope,
  Users,
} from 'lucide-react';
import type { AiWorkspaceId } from './ai-config';

export interface AiWorkspaceDef {
  id: AiWorkspaceId;
  icon: LucideIcon;
  labelKey: string;
  subtitleKey: string;
  promptKeys: string[];
}

export const AI_WORKSPACES: AiWorkspaceDef[] = [
  {
    id: 'medical',
    icon: Stethoscope,
    labelKey: 'ai.workspaces.medical',
    subtitleKey: 'ai.workspaces.medicalHint',
    promptKeys: ['ai.prompts.medical.summary', 'ai.prompts.medical.soap', 'ai.prompts.medical.risk'],
  },
  {
    id: 'dental',
    icon: Smile,
    labelKey: 'ai.workspaces.dental',
    subtitleKey: 'ai.workspaces.dentalHint',
    promptKeys: ['ai.prompts.dental.chart', 'ai.prompts.dental.treatment', 'ai.prompts.dental.perio'],
  },
  {
    id: 'beauty',
    icon: Sparkles,
    labelKey: 'ai.workspaces.beauty',
    subtitleKey: 'ai.workspaces.beautyHint',
    promptKeys: ['ai.prompts.beauty.session', 'ai.prompts.beauty.progress', 'ai.prompts.beauty.followup'],
  },
  {
    id: 'reception',
    icon: Users,
    labelKey: 'ai.workspaces.reception',
    subtitleKey: 'ai.workspaces.receptionHint',
    promptKeys: ['ai.prompts.reception.schedule', 'ai.prompts.reception.slots', 'ai.prompts.reception.noshow'],
  },
  {
    id: 'billing',
    icon: Receipt,
    labelKey: 'ai.workspaces.billing',
    subtitleKey: 'ai.workspaces.billingHint',
    promptKeys: ['ai.prompts.billing.outstanding', 'ai.prompts.billing.revenue', 'ai.prompts.billing.summary'],
  },
  {
    id: 'inventory',
    icon: Package,
    labelKey: 'ai.workspaces.inventory',
    subtitleKey: 'ai.workspaces.inventoryHint',
    promptKeys: ['ai.prompts.inventory.lowStock', 'ai.prompts.inventory.purchase', 'ai.prompts.inventory.expiry'],
  },
  {
    id: 'analytics',
    icon: BarChart3,
    labelKey: 'ai.workspaces.analytics',
    subtitleKey: 'ai.workspaces.analyticsHint',
    promptKeys: ['ai.prompts.analytics.explainKpi', 'ai.prompts.analytics.trends', 'ai.prompts.analytics.growth'],
  },
  {
    id: 'workflow',
    icon: GitBranch,
    labelKey: 'ai.workspaces.workflow',
    subtitleKey: 'ai.workspaces.workflowHint',
    promptKeys: ['ai.prompts.workflow.bottleneck', 'ai.prompts.workflow.sla', 'ai.prompts.workflow.automation'],
  },
  {
    id: 'reporting',
    icon: FileBarChart,
    labelKey: 'ai.workspaces.reporting',
    subtitleKey: 'ai.workspaces.reportingHint',
    promptKeys: ['ai.prompts.reporting.revenue', 'ai.prompts.reporting.appointments', 'ai.prompts.reporting.branches'],
  },
  {
    id: 'management',
    icon: Building2,
    labelKey: 'ai.workspaces.management',
    subtitleKey: 'ai.workspaces.managementHint',
    promptKeys: ['ai.prompts.management.overview', 'ai.prompts.management.staff', 'ai.prompts.management.performance'],
  },
  {
    id: 'super_admin',
    icon: Shield,
    labelKey: 'ai.workspaces.superAdmin',
    subtitleKey: 'ai.workspaces.superAdminHint',
    promptKeys: ['ai.prompts.admin.models', 'ai.prompts.admin.usage', 'ai.prompts.admin.limits'],
  },
];

export const AI_COMMAND_ACTIONS = [
  { id: 'book-appointment', labelKey: 'ai.commands.bookAppointment', path: '/appointments' },
  { id: 'open-patients', labelKey: 'ai.commands.openPatients', path: '/patients' },
  { id: 'generate-report', labelKey: 'ai.commands.generateReport', path: '/reports' },
  { id: 'create-invoice', labelKey: 'ai.commands.createInvoice', path: '/billing/invoices/new' },
  { id: 'open-analytics', labelKey: 'ai.commands.openAnalytics', path: '/analytics' },
  { id: 'open-workflows', labelKey: 'ai.commands.openWorkflows', path: '/workflows' },
  { id: 'search-inventory', labelKey: 'ai.commands.searchInventory', path: '/inventory' },
  { id: 'new-ai-chat', labelKey: 'ai.commands.newChat', path: '/ai/chat' },
] as const;
