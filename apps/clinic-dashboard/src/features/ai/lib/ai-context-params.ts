import type { AiRouteContext } from './ai-types';

export function serializeAiRouteContext(context: AiRouteContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = value;
  }
  return out;
}

export function buildAiContextQueryParams(context: AiRouteContext): Record<string, string> {
  const params: Record<string, string> = { path: context.path };
  if (context.module) params.module = String(context.module);
  if (context.patientId) params.patientId = context.patientId;
  if (context.encounterId) params.encounterId = context.encounterId;
  if (context.appointmentId) params.appointmentId = context.appointmentId;
  if (context.invoiceId) params.invoiceId = context.invoiceId;
  if (context.workflowId) params.workflowId = context.workflowId;
  if (context.inventoryItemId) params.inventoryItemId = context.inventoryItemId;
  if (context.reportId) params.reportId = context.reportId;
  if (context.analyticsDomain) params.analyticsDomain = context.analyticsDomain;
  if (context.dentalPatientId) params.dentalPatientId = context.dentalPatientId;
  if (context.beautyPatientId) params.beautyPatientId = context.beautyPatientId;
  return params;
}
