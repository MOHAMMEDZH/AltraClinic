import type { AiWorkspaceFeature } from './ai-plan-limits.config';

export interface AiSmartActionContext {
  path?: string;
  patientId?: string;
  encounterId?: string;
  invoiceId?: string;
  workflowId?: string;
  appointmentId?: string;
  inventoryItemId?: string;
  reportId?: string;
  analyticsDomain?: string;
  module?: string;
}

export interface AiSmartActionDef {
  id: string;
  workspace: AiWorkspaceFeature;
  labelKey: string;
  promptEn: string;
  promptAr: string;
  priority: number;
  match: (ctx: AiSmartActionContext) => boolean;
}

const pathIncludes = (ctx: AiSmartActionContext, segment: string) =>
  (ctx.path ?? '').toLowerCase().includes(segment);

const onSpecialtyRoute = (ctx: AiSmartActionContext) =>
  pathIncludes(ctx, '/dental') || pathIncludes(ctx, '/beauty');

const onPatientChart = (ctx: AiSmartActionContext) =>
  Boolean(ctx.patientId) && !ctx.encounterId && !onSpecialtyRoute(ctx);

export const AI_SMART_ACTION_CATALOG: AiSmartActionDef[] = [
  {
    id: 'summarize-encounter',
    workspace: 'medical',
    labelKey: 'ai.actions.summarizeEncounter',
    promptEn: 'Summarize this encounter including diagnoses, medications, and follow-up items.',
    promptAr: 'لخص هذه الزيارة بما في ذلك التشخيصات والأدوية وخطوات المتابعة.',
    priority: 10,
    match: (ctx) => Boolean(ctx.encounterId),
  },
  {
    id: 'draft-soap',
    workspace: 'medical',
    labelKey: 'ai.actions.draftSoap',
    promptEn: 'Draft a SOAP note for this encounter based on available clinical context.',
    promptAr: 'اكتب ملاحظة SOAP لهذه الزيارة بناءً على السياق السريري المتاح.',
    priority: 9,
    match: (ctx) => Boolean(ctx.encounterId),
  },
  {
    id: 'suggest-followup-encounter',
    workspace: 'medical',
    labelKey: 'ai.actions.suggestFollowup',
    promptEn: 'Suggest follow-up appointments and care instructions for this encounter.',
    promptAr: 'اقترح مواعيد متابعة وتعليمات رعاية لهذه الزيارة.',
    priority: 8,
    match: (ctx) => Boolean(ctx.encounterId),
  },
  {
    id: 'summarize-patient',
    workspace: 'medical',
    labelKey: 'ai.actions.summarizePatient',
    promptEn: 'Summarize this patient chart including allergies, problems, and recent visits.',
    promptAr: 'لخص ملف هذا المريض بما في ذلك الحساسية والمشاكل والزيارات الأخيرة.',
    priority: 10,
    match: onPatientChart,
  },
  {
    id: 'explain-history',
    workspace: 'medical',
    labelKey: 'ai.actions.explainHistory',
    promptEn: 'Explain this patient history timeline in plain language for handoff.',
    promptAr: 'اشرح الجدول الزمني لتاريخ المريض بلغة مبسطة للتسليم.',
    priority: 9,
    match: onPatientChart,
  },
  {
    id: 'suggest-followup-patient',
    workspace: 'medical',
    labelKey: 'ai.actions.suggestFollowup',
    promptEn: 'Suggest follow-up care and screening based on this patient profile.',
    promptAr: 'اقترح رعاية متابعة وفحوصات بناءً على ملف هذا المريض.',
    priority: 8,
    match: onPatientChart,
  },
  {
    id: 'explain-invoice',
    workspace: 'billing',
    labelKey: 'ai.actions.explainInvoice',
    promptEn: 'Explain this invoice line items, payments, and outstanding balance.',
    promptAr: 'اشرح بنود هذه الفاتورة والمدفوعات والرصيد المتبقي.',
    priority: 10,
    match: (ctx) => Boolean(ctx.invoiceId),
  },
  {
    id: 'suggest-payment',
    workspace: 'billing',
    labelKey: 'ai.actions.suggestPayment',
    promptEn: 'Suggest payment collection options for this outstanding invoice.',
    promptAr: 'اقترح خيارات تحصيل الدفع لهذه الفاتورة المستحقة.',
    priority: 9,
    match: (ctx) => Boolean(ctx.invoiceId),
  },
  {
    id: 'explain-workflow',
    workspace: 'workflow',
    labelKey: 'ai.actions.explainWorkflow',
    promptEn: 'Explain this workflow instance status, blockers, and next steps.',
    promptAr: 'اشرح حالة سير العمل هذا والعوائق والخطوات التالية.',
    priority: 10,
    match: (ctx) => Boolean(ctx.workflowId),
  },
  {
    id: 'workflow-next-step',
    workspace: 'workflow',
    labelKey: 'ai.actions.suggestWorkflowStep',
    promptEn: 'Recommend the next workflow action to unblock this instance.',
    promptAr: 'اقترح إجراء سير العمل التالي لإزالة العائق من هذه الحالة.',
    priority: 9,
    match: (ctx) => Boolean(ctx.workflowId),
  },
  {
    id: 'explain-trends',
    workspace: 'analytics',
    labelKey: 'ai.actions.explainTrends',
    promptEn: 'Explain the key trends on this analytics view and what changed recently.',
    promptAr: 'اشرح الاتجاهات الرئيسية في عرض التحليلات وما الذي تغير مؤخراً.',
    priority: 10,
    match: (ctx) => pathIncludes(ctx, '/analytics'),
  },
  {
    id: 'forecast-kpi',
    workspace: 'analytics',
    labelKey: 'ai.actions.forecastKpi',
    promptEn: 'Forecast near-term KPI movement based on current analytics signals.',
    promptAr: 'توقع حركة مؤشرات الأداء قصيرة الأجل بناءً على إشارات التحليلات الحالية.',
    priority: 9,
    match: (ctx) => pathIncludes(ctx, '/analytics'),
  },
  {
    id: 'predict-stock',
    workspace: 'inventory',
    labelKey: 'ai.actions.predictStock',
    promptEn: 'Predict stock-outs and replenishment needs for this inventory view.',
    promptAr: 'توقع نفاد المخزون واحتياجات إعادة التوريد لهذا العرض.',
    priority: 10,
    match: (ctx) => pathIncludes(ctx, '/inventory'),
  },
  {
    id: 'expiry-risk',
    workspace: 'inventory',
    labelKey: 'ai.actions.expiryRisk',
    promptEn: 'Highlight expiry risk items and suggest disposal or transfer actions.',
    promptAr: 'أبرز أصناف مخاطر الانتهاء واقترح إجراءات التخلص أو النقل.',
    priority: 9,
    match: (ctx) => pathIncludes(ctx, '/inventory'),
  },
  {
    id: 'optimize-schedule',
    workspace: 'reception',
    labelKey: 'ai.actions.optimizeSchedule',
    promptEn: 'Optimize today schedule to reduce gaps and waiting time.',
    promptAr: 'حسّن جدول اليوم لتقليل الفجوات ووقت الانتظار.',
    priority: 10,
    match: (ctx) => pathIncludes(ctx, '/appointments'),
  },
  {
    id: 'reduce-noshow',
    workspace: 'reception',
    labelKey: 'ai.actions.reduceNoShows',
    promptEn: 'Suggest actions to reduce no-shows for upcoming appointments.',
    promptAr: 'اقترح إجراءات لتقليل عدم الحضور للمواعيد القادمة.',
    priority: 9,
    match: (ctx) => pathIncludes(ctx, '/appointments'),
  },
  {
    id: 'queue-flow',
    workspace: 'reception',
    labelKey: 'ai.actions.optimizeQueue',
    promptEn: 'Analyze waiting-room queue flow and suggest room assignments.',
    promptAr: 'حلل تدفق طابور الانتظار واقترح توزيع الغرف.',
    priority: 10,
    match: (ctx) => pathIncludes(ctx, '/queue'),
  },
  {
    id: 'summarize-report',
    workspace: 'reporting',
    labelKey: 'ai.actions.summarizeReport',
    promptEn: 'Summarize the most relevant insights for this reporting view.',
    promptAr: 'لخص أهم الرؤى لعرض التقارير هذا.',
    priority: 10,
    match: (ctx) => pathIncludes(ctx, '/reports'),
  },
  {
    id: 'compare-periods',
    workspace: 'reporting',
    labelKey: 'ai.actions.comparePeriods',
    promptEn: 'Compare performance between the current and previous reporting period.',
    promptAr: 'قارن الأداء بين فترة التقرير الحالية والسابقة.',
    priority: 9,
    match: (ctx) => pathIncludes(ctx, '/reports'),
  },
  {
    id: 'dental-chart',
    workspace: 'dental',
    labelKey: 'ai.actions.explainDentalChart',
    promptEn: 'Explain the dental chart findings and suggested treatment priorities.',
    promptAr: 'اشرح نتائج مخطط الأسنان وأولويات العلاج المقترحة.',
    priority: 11,
    match: (ctx) => pathIncludes(ctx, '/dental'),
  },
  {
    id: 'beauty-session',
    workspace: 'beauty',
    labelKey: 'ai.actions.summarizeBeautySession',
    promptEn: 'Summarize this beauty session plan, parameters, and aftercare.',
    promptAr: 'لخص خطة جلسة التجميل والمعاملات والرعاية اللاحقة.',
    priority: 11,
    match: (ctx) => pathIncludes(ctx, '/beauty'),
  },
  {
    id: 'dashboard-insights',
    workspace: 'management',
    labelKey: 'ai.actions.dashboardInsights',
    promptEn: 'Summarize today operational KPIs and flag items needing attention on this dashboard.',
    promptAr: 'لخص مؤشرات التشغيل اليوم وأبرز العناصر التي تحتاج انتباهاً في لوحة التحكم.',
    priority: 9,
    match: (ctx) => pathIncludes(ctx, '/dashboard'),
  },
  {
    id: 'billing-insights',
    workspace: 'billing',
    labelKey: 'ai.actions.billingInsights',
    promptEn: 'Summarize billing performance, outstanding AR, and collection risks.',
    promptAr: 'لخص أداء الفوترة والمستحقات ومخاطر التحصيل.',
    priority: 8,
    match: (ctx) => pathIncludes(ctx, '/billing') && !ctx.invoiceId,
  },
  {
    id: 'workflow-bottleneck',
    workspace: 'workflow',
    labelKey: 'ai.actions.workflowBottleneck',
    promptEn: 'Identify workflow bottlenecks and SLA risks across active instances.',
    promptAr: 'حدد اختناقات سير العمل ومخاطر SLA عبر الحالات النشطة.',
    priority: 8,
    match: (ctx) => pathIncludes(ctx, '/workflows') && !ctx.workflowId,
  },
  {
    id: 'notification-digest',
    workspace: 'management',
    labelKey: 'ai.actions.notificationDigest',
    promptEn: 'Summarize unread notifications and prioritize required actions.',
    promptAr: 'لخص الإشعارات غير المقروءة ورتب الإجراءات المطلوبة.',
    priority: 8,
    match: (ctx) => pathIncludes(ctx, '/notifications'),
  },
  {
    id: 'general-help',
    workspace: 'chat',
    labelKey: 'ai.actions.generalHelp',
    promptEn: 'How can the AI assistant help me on this page?',
    promptAr: 'كيف يمكن للمساعد الذكي مساعدتي في هذه الصفحة؟',
    priority: 1,
    match: () => true,
  },
];

export function resolveSmartActions(ctx: AiSmartActionContext, max = 4): AiSmartActionDef[] {
  const matched = AI_SMART_ACTION_CATALOG.filter((action) => action.match(ctx))
    .sort((a, b) => b.priority - a.priority);

  const specific = matched.filter((a) => a.id !== 'general-help').slice(0, max);
  if (specific.length > 0) return specific;

  const general = matched.find((a) => a.id === 'general-help');
  return general ? [general] : [];
}

export function workspaceFeatureToId(feature: AiWorkspaceFeature): string | null {
  const map: Record<AiWorkspaceFeature, string | null> = {
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
    admin: 'super_admin',
    chat: null,
  };
  return map[feature] ?? null;
}
