import type { AiRouteContext } from './ai-types';

export type AiModuleId =
  | 'dashboard'
  | 'patients'
  | 'scheduling'
  | 'queue'
  | 'emr'
  | 'dental'
  | 'beauty'
  | 'billing'
  | 'inventory'
  | 'reporting'
  | 'analytics'
  | 'workflow'
  | 'notifications'
  | 'settings'
  | 'ai'
  | 'general';

export function inferAiModule(pathname: string): AiModuleId {
  const p = pathname.toLowerCase();
  if (p === '/' || p.startsWith('/dashboard')) return 'dashboard';
  if (p.startsWith('/patients')) return 'patients';
  if (p.startsWith('/encounters')) return 'emr';
  if (p.startsWith('/appointments') || p.startsWith('/my-appointments')) return 'scheduling';
  if (p.startsWith('/queue')) return 'queue';
  if (p.startsWith('/dental')) return 'dental';
  if (p.startsWith('/beauty')) return 'beauty';
  if (p.startsWith('/billing')) return 'billing';
  if (p.startsWith('/inventory')) return 'inventory';
  if (p.startsWith('/reports')) return 'reporting';
  if (p.startsWith('/analytics')) return 'analytics';
  if (p.startsWith('/workflows')) return 'workflow';
  if (p.startsWith('/notifications')) return 'notifications';
  if (p.startsWith('/settings')) return 'settings';
  if (p.startsWith('/ai')) return 'ai';
  return 'general';
}

function inferAnalyticsDomain(pathname: string): string | undefined {
  const match = pathname.match(/^\/analytics\/([^/]+)/i);
  if (!match) return undefined;
  const domain = match[1];
  if (['export', 'builder'].includes(domain)) return undefined;
  return domain;
}

function inferReportId(pathname: string): string | undefined {
  const match = pathname.match(/^\/reports\/([^/]+)/i);
  if (!match) return undefined;
  const id = match[1];
  if (['category', 'builder', 'export'].includes(id)) return undefined;
  return id;
}

function inferInventoryItemId(pathname: string): string | undefined {
  const match = pathname.match(/^\/inventory\/items\/([^/]+)/i);
  return match?.[1];
}

export function parseAiRouteContext(
  pathname: string,
  params: Record<string, string | undefined>,
  searchParams?: URLSearchParams,
): AiRouteContext {
  const context: AiRouteContext = {
    path: pathname,
    module: inferAiModule(pathname),
  };

  const patientId =
    params.patientId ??
    (pathname.match(/\/(?:dental\/chart|beauty\/workspace|beauty\/present|beauty\/imaging)\/([^/]+)/i)?.[1]);

  if (patientId) context.patientId = patientId;
  if (params.encounterId) context.encounterId = params.encounterId;
  if (params.invoiceId) context.invoiceId = params.invoiceId;
  if (params.workflowId) context.workflowId = params.workflowId;

  const appointmentId =
    searchParams?.get('highlight') ??
    searchParams?.get('selected') ??
    (searchParams?.get('from') === 'appointment' ? searchParams?.get('appointmentId') : null) ??
    params.appointmentId;
  if (appointmentId) context.appointmentId = appointmentId;

  const inventoryItemId = params.itemId ?? inferInventoryItemId(pathname);
  if (inventoryItemId) context.inventoryItemId = inventoryItemId;

  const reportId = params.reportId ?? inferReportId(pathname);
  if (reportId) context.reportId = reportId;

  const analyticsDomain = inferAnalyticsDomain(pathname);
  if (analyticsDomain) context.analyticsDomain = analyticsDomain;

  if (context.module === 'dental' && context.patientId) context.dentalPatientId = context.patientId;
  if (context.module === 'beauty' && context.patientId) context.beautyPatientId = context.patientId;

  return context;
}
