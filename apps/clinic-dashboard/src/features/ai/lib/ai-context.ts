import type { AiRouteContext } from './ai-types';
export { parseAiRouteContext, inferAiModule } from './ai-route-context';

export function contextSummary(context: AiRouteContext | undefined, locale: string): string | null {
  if (!context) return null;
  const parts: string[] = [];
  const ar = locale.startsWith('ar');

  if (context.module) {
    parts.push(ar ? moduleLabelAr(context.module) : moduleLabelEn(context.module));
  }
  if (context.patientId) {
    parts.push(ar ? `مريض نشط` : `Active patient`);
  }
  if (context.encounterId) parts.push(ar ? `زيارة نشطة` : `Active encounter`);
  if (context.appointmentId) parts.push(ar ? `موعد محدد` : `Selected appointment`);
  if (context.invoiceId) parts.push(ar ? `فاتورة نشطة` : `Active invoice`);
  if (context.workflowId) parts.push(ar ? `سير عمل نشط` : `Active workflow`);
  if (context.inventoryItemId) parts.push(ar ? `صنف مخزون` : `Inventory item`);
  if (context.reportId) parts.push(ar ? `تقرير` : `Report`);
  if (context.analyticsDomain) {
    parts.push(ar ? `تحليلات: ${context.analyticsDomain}` : `Analytics: ${context.analyticsDomain}`);
  }

  return parts.length ? parts.join(' · ') : null;
}

function moduleLabelEn(module: string) {
  const map: Record<string, string> = {
    dashboard: 'Dashboard',
    patients: 'Patients',
    scheduling: 'Scheduling',
    queue: 'Queue',
    emr: 'EMR',
    dental: 'Dental',
    beauty: 'Beauty',
    billing: 'Billing',
    inventory: 'Inventory',
    reporting: 'Reporting',
    analytics: 'Analytics',
    workflow: 'Workflow',
  };
  return map[module] ?? module;
}

function moduleLabelAr(module: string) {
  const map: Record<string, string> = {
    dashboard: 'لوحة التحكم',
    patients: 'المرضى',
    scheduling: 'المواعيد',
    queue: 'الطابور',
    emr: 'السجل الطبي',
    dental: 'الأسنان',
    beauty: 'التجميل',
    billing: 'الفوترة',
    inventory: 'المخزون',
    reporting: 'التقارير',
    analytics: 'التحليلات',
    workflow: 'سير العمل',
  };
  return map[module] ?? module;
}

export function buildContextualSystemPrompt(context: AiRouteContext | undefined, workspaceId?: string): string {
  const lines = ['You are a healthcare ERP assistant. Be concise, clinical, and actionable.'];
  if (workspaceId) lines.push(`Workspace: ${workspaceId}.`);
  if (context?.module) lines.push(`Module: ${context.module}.`);
  if (context?.patientId) lines.push(`Current patient id: ${context.patientId}.`);
  if (context?.encounterId) lines.push(`Current encounter id: ${context.encounterId}.`);
  if (context?.appointmentId) lines.push(`Current appointment id: ${context.appointmentId}.`);
  if (context?.invoiceId) lines.push(`Current invoice id: ${context.invoiceId}.`);
  if (context?.workflowId) lines.push(`Current workflow id: ${context.workflowId}.`);
  if (context?.inventoryItemId) lines.push(`Current inventory item id: ${context.inventoryItemId}.`);
  if (context?.reportId) lines.push(`Current report id: ${context.reportId}.`);
  if (context?.analyticsDomain) lines.push(`Analytics domain: ${context.analyticsDomain}.`);
  if (context?.path) lines.push(`Current route: ${context.path}.`);
  return lines.join(' ');
}
