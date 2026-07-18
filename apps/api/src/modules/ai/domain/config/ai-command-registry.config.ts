import type { AiWorkspaceFeature } from './ai-plan-limits.config';
import type { AiSmartActionContext } from './ai-smart-actions.config';

export type AiCommandKind = 'navigate' | 'action' | 'ask';

export interface AiCommandDef {
  id: string;
  labelKey: string;
  kind: AiCommandKind;
  phrasesEn: string[];
  phrasesAr: string[];
  path?: string;
  smartActionId?: string;
  /** Built-in skill id (see ai-skill-registry.config). */
  skillId?: string;
  askPromptEn?: string;
  askPromptAr?: string;
  requiresContext?: Array<keyof AiSmartActionContext>;
  workspace?: AiWorkspaceFeature;
  priority: number;
}

export const AI_COMMAND_REGISTRY: AiCommandDef[] = [
  {
    id: 'book-appointment',
    labelKey: 'ai.commands.bookAppointment',
    kind: 'navigate',
    phrasesEn: ['book appointment', 'book an appointment', 'schedule appointment', 'new appointment'],
    phrasesAr: ['حجز موعد', 'احجز موعد', 'موعد جديد'],
    path: '/appointments',
    priority: 90,
  },
  {
    id: 'open-patients',
    labelKey: 'ai.commands.openPatients',
    kind: 'navigate',
    phrasesEn: ['open patient', 'open patients', 'find patient', 'patient list', 'go to patients'],
    phrasesAr: ['فتح المرضى', 'افتح المريض', 'قائمة المرضى'],
    path: '/patients',
    priority: 88,
  },
  {
    id: 'summarize-patient',
    labelKey: 'ai.actions.summarizePatient',
    kind: 'action',
    phrasesEn: ['summarize patient', 'summarize this patient', 'patient summary', 'summarize chart'],
    phrasesAr: ['لخص المريض', 'تلخيص المريض', 'ملخص المريض'],
    smartActionId: 'summarize-patient',
    requiresContext: ['patientId'],
    workspace: 'medical',
    priority: 95,
  },
  {
    id: 'draft-soap',
    labelKey: 'ai.actions.draftSoap',
    kind: 'action',
    phrasesEn: ['generate soap', 'generate soap note', 'draft soap', 'soap note'],
    phrasesAr: ['اكتب soap', 'مسودة soap', 'ملاحظة soap'],
    smartActionId: 'draft-soap',
    requiresContext: ['encounterId'],
    workspace: 'medical',
    priority: 94,
  },
  {
    id: 'summarize-encounter',
    labelKey: 'ai.actions.summarizeEncounter',
    kind: 'action',
    phrasesEn: ['summarize encounter', 'summarize visit', 'encounter summary'],
    phrasesAr: ['لخص الزيارة', 'تلخيص الزيارة'],
    smartActionId: 'summarize-encounter',
    requiresContext: ['encounterId'],
    workspace: 'medical',
    priority: 93,
  },
  {
    id: 'generate-followup',
    labelKey: 'ai.commands.generateFollowup',
    kind: 'action',
    phrasesEn: ['generate follow-up', 'generate follow up', 'suggest follow-up', 'follow up plan'],
    phrasesAr: ['اقتراح متابعة', 'خطة متابعة', 'متابعة'],
    smartActionId: 'suggest-followup-encounter',
    requiresContext: ['encounterId'],
    workspace: 'medical',
    priority: 92,
  },
  {
    id: 'generate-followup-patient',
    labelKey: 'ai.commands.generateFollowup',
    kind: 'action',
    phrasesEn: ['patient follow-up', 'follow up for patient'],
    phrasesAr: ['متابعة المريض'],
    smartActionId: 'suggest-followup-patient',
    requiresContext: ['patientId'],
    workspace: 'medical',
    priority: 91,
  },
  {
    id: 'explain-invoice',
    labelKey: 'ai.actions.explainInvoice',
    kind: 'action',
    phrasesEn: ['explain invoice', 'explain this invoice', 'invoice breakdown'],
    phrasesAr: ['اشرح الفاتورة', 'شرح الفاتورة'],
    smartActionId: 'explain-invoice',
    requiresContext: ['invoiceId'],
    workspace: 'billing',
    priority: 93,
  },
  {
    id: 'generate-revenue-report',
    labelKey: 'ai.commands.generateRevenueReport',
    kind: 'action',
    phrasesEn: ['generate revenue report', 'revenue report summary', 'executive revenue summary'],
    phrasesAr: ['تقرير الإيرادات', 'ملخص الإيرادات', 'تقرير إيرادات تنفيذي'],
    smartActionId: 'summarize-report',
    path: '/reports',
    workspace: 'reporting',
    priority: 88,
  },
  {
    id: 'generate-report',
    labelKey: 'ai.commands.generateReport',
    kind: 'navigate',
    phrasesEn: ['generate report', 'open reports', 'go to reports'],
    phrasesAr: ['إنشاء تقرير', 'فتح التقارير'],
    path: '/reports',
    priority: 85,
  },
  {
    id: 'summarize-report',
    labelKey: 'ai.actions.summarizeReport',
    kind: 'action',
    phrasesEn: ['summarize report', 'report summary', 'executive summary'],
    phrasesAr: ['لخص التقرير', 'ملخص تنفيذي'],
    smartActionId: 'summarize-report',
    workspace: 'reporting',
    priority: 84,
  },
  {
    id: 'show-overdue-invoices',
    labelKey: 'ai.commands.overdueInvoices',
    kind: 'ask',
    phrasesEn: ['show overdue invoices', 'overdue invoices', 'outstanding balances', 'unpaid invoices'],
    phrasesAr: ['الفواتير المتأخرة', 'المستحقات', 'فواتير غير مدفوعة'],
    path: '/billing/invoices',
    skillId: 'billing.outstanding',
    askPromptEn: 'outstanding balances',
    askPromptAr: 'المستحقات',
    workspace: 'billing',
    priority: 86,
  },
  {
    id: 'explain-dashboard',
    labelKey: 'ai.commands.explainDashboard',
    kind: 'action',
    phrasesEn: ['explain dashboard', 'dashboard insights', 'explain kpis', 'today activity'],
    phrasesAr: ['اشرح لوحة التحكم', 'رؤى لوحة التحكم', 'اشرح مؤشرات الأداء'],
    smartActionId: 'dashboard-insights',
    skillId: 'dashboard.snapshot',
    workspace: 'management',
    priority: 87,
  },
  {
    id: 'find-low-stock',
    labelKey: 'ai.commands.findLowStock',
    kind: 'action',
    phrasesEn: ['find low stock', 'low stock', 'stock risk', 'predict stock'],
    phrasesAr: ['مخزون منخفض', 'نفاد المخزون', 'مخاطر المخزون'],
    smartActionId: 'predict-stock',
    workspace: 'inventory',
    priority: 86,
  },
  {
    id: 'search-inventory',
    labelKey: 'ai.commands.searchInventory',
    kind: 'navigate',
    phrasesEn: ['open inventory', 'search inventory', 'go to inventory'],
    phrasesAr: ['فتح المخزون', 'بحث المخزون'],
    path: '/inventory',
    priority: 80,
  },
  {
    id: 'open-workflows',
    labelKey: 'ai.commands.openWorkflows',
    kind: 'navigate',
    phrasesEn: ['open workflow', 'open workflows', 'go to workflows'],
    phrasesAr: ['فتح سير العمل', 'سير العمل'],
    path: '/workflows',
    priority: 82,
  },
  {
    id: 'explain-workflow',
    labelKey: 'ai.actions.explainWorkflow',
    kind: 'action',
    phrasesEn: ['explain workflow', 'workflow status'],
    phrasesAr: ['اشرح سير العمل'],
    smartActionId: 'explain-workflow',
    requiresContext: ['workflowId'],
    workspace: 'workflow',
    priority: 81,
  },
  {
    id: 'open-analytics',
    labelKey: 'ai.commands.openAnalytics',
    kind: 'navigate',
    phrasesEn: ['open analytics', 'go to analytics', 'analytics dashboard'],
    phrasesAr: ['فتح التحليلات', 'لوحة التحليلات'],
    path: '/analytics',
    priority: 80,
  },
  {
    id: 'explain-trends',
    labelKey: 'ai.actions.explainTrends',
    kind: 'action',
    phrasesEn: ['explain trends', 'explain analytics', 'kpi trends'],
    phrasesAr: ['اشرح الاتجاهات', 'اتجاهات التحليلات'],
    smartActionId: 'explain-trends',
    workspace: 'analytics',
    priority: 79,
  },
  {
    id: 'create-invoice',
    labelKey: 'ai.commands.createInvoice',
    kind: 'navigate',
    phrasesEn: ['create invoice', 'new invoice'],
    phrasesAr: ['إنشاء فاتورة', 'فاتورة جديدة'],
    path: '/billing/invoices/new',
    priority: 78,
  },
  {
    id: 'optimize-schedule',
    labelKey: 'ai.actions.optimizeSchedule',
    kind: 'action',
    phrasesEn: ['optimize schedule', 'optimize today schedule'],
    phrasesAr: ['حسّن الجدول', 'تحسين الجدول'],
    smartActionId: 'optimize-schedule',
    workspace: 'reception',
    priority: 77,
  },
  {
    id: 'optimize-queue',
    labelKey: 'ai.actions.optimizeQueue',
    kind: 'action',
    phrasesEn: ['optimize queue', 'queue status', 'waiting room'],
    phrasesAr: ['تحسين الطابور', 'حالة الطابور'],
    smartActionId: 'queue-flow',
    workspace: 'reception',
    priority: 76,
  },
  {
    id: 'new-ai-chat',
    labelKey: 'ai.commands.newChat',
    kind: 'navigate',
    phrasesEn: ['new chat', 'new ai chat', 'start chat'],
    phrasesAr: ['محادثة جديدة', 'بدء محادثة'],
    path: '/ai/chat',
    priority: 70,
  },
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ');
}

export function scoreCommandPhrase(query: string, phrase: string): number {
  const q = normalizeText(query);
  const p = normalizeText(phrase);
  if (!q || !p) return 0;
  if (q === p) return 100;
  if (p.startsWith(q) || q.startsWith(p)) return 88;
  if (p.includes(q) || q.includes(p)) return 72;

  const qTokens = q.split(' ').filter(Boolean);
  const pTokens = p.split(' ').filter(Boolean);
  if (qTokens.length === 0 || pTokens.length === 0) return 0;

  let overlap = 0;
  for (const token of qTokens) {
    if (pTokens.some((pt) => pt === token || pt.startsWith(token) || token.startsWith(pt))) {
      overlap += 1;
    }
  }
  if (overlap === 0) return 0;
  return Math.min(68, 35 + overlap * 12);
}

export function scoreCommandDef(query: string, def: AiCommandDef, useAr: boolean): number {
  const phrases = useAr ? def.phrasesAr : def.phrasesEn;
  let best = 0;
  for (const phrase of phrases) {
    best = Math.max(best, scoreCommandPhrase(query, phrase));
  }
  if (best > 0) return best + def.priority / 100;
  return 0;
}

export function contextSatisfied(
  ctx: AiSmartActionContext,
  requires?: Array<keyof AiSmartActionContext>,
): boolean {
  if (!requires?.length) return true;
  return requires.every((key) => {
    const value = ctx[key];
    return typeof value === 'string' ? value.length > 0 : Boolean(value);
  });
}
